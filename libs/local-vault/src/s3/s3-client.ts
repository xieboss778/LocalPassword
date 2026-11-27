import { AwsCredentials, encodeRfc3986, signRequest } from "./sigv4";

/** Everything the settings page collects before a connection test. */
export interface S3ClientConfig {
  /** Storage endpoint, e.g. `https://abc123.r2.cloudflarestorage.com`. */
  readonly endpoint: string;
  /** `auto` for R2; the region name for any other S3-compatible service. */
  readonly region: string;
  readonly bucket: string;
  readonly credentials: AwsCredentials;
  /** MinIO and most self-hosted gateways only speak path-style addressing. */
  readonly forcePathStyle?: boolean;
}

export class S3RequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`S3 request failed with status ${status}`);
    this.name = "S3RequestError";
  }
}

/** Raised when a conditional write lost the race and the caller has to merge and retry. */
export class S3PreconditionFailedError extends S3RequestError {
  constructor(body: string) {
    super(412, body);
    this.name = "S3PreconditionFailedError";
  }
}

export interface S3Object {
  readonly key: string;
  readonly body: Uint8Array;
  /** ETag without quotes, when the service returns one. */
  readonly etag: string | null;
}

export interface S3ObjectInfo {
  readonly key: string;
  readonly etag: string | null;
  readonly size: number | null;
}

export type FetchLike = (request: Request) => Promise<Response>;

/**
 * A small S3 client for encrypted vault backups: GET, conditional PUT, DELETE and ListObjectsV2.
 *
 * It signs every request with SigV4 itself, so it adds no dependency and works unchanged against
 * Cloudflare R2, MinIO, Backblaze B2, Alibaba OSS and Tencent COS.
 */
export class S3Client {
  constructor(
    private readonly config: S3ClientConfig,
    private readonly fetchFn: FetchLike = (request) => fetch(request),
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Fully qualified key; leading slashes are dropped so callers can paste paths. */
  keyFor(path: string): string {
    return path.replace(/^\/+/, "");
  }

  /**
   * Uploads an object.
   *
   * @throws S3PreconditionFailedError when `ifMatch` no longer matches the stored ETag, which
   *   means another device wrote first.
   */
  async putObject(
    path: string,
    body: Uint8Array | string,
    options: { ifMatch?: string; ifNoneMatch?: string; contentType?: string } = {},
  ): Promise<string | null> {
    const headers: Record<string, string> = {
      "content-type": options.contentType ?? "application/octet-stream",
    };
    if (options.ifMatch != null && options.ifMatch !== "") {
      headers["if-match"] = `"${options.ifMatch}"`;
    }
    if (options.ifNoneMatch != null) {
      headers["if-none-match"] = options.ifNoneMatch;
    }

    const response = await this.send("PUT", path, body, headers);
    return etagOf(response.headers.get("etag"));
  }

  /** Reads an object, or null when it does not exist. */
  async getObject(path: string): Promise<S3Object | null> {
    let response: Response;
    try {
      response = await this.send("GET", path);
    } catch (error) {
      if (error instanceof S3RequestError && error.status === 404) {
        return null;
      }
      throw error;
    }

    return {
      key: this.keyFor(path),
      body: new Uint8Array(await response.arrayBuffer()),
      etag: etagOf(response.headers.get("etag")),
    };
  }

  /** Reads an object as UTF-8 text, or null when it does not exist. */
  async getText(path: string): Promise<{ text: string; etag: string | null } | null> {
    const object = await this.getObject(path);
    if (object == null) {
      return null;
    }
    return { text: new TextDecoder().decode(object.body), etag: object.etag };
  }

  /** Deletes an object. Deleting something that is not there is not an error in S3. */
  async deleteObject(path: string): Promise<void> {
    await this.send("DELETE", path);
  }

  /** Lists every key under a prefix, following continuation tokens. */
  async listObjects(prefix: string): Promise<S3ObjectInfo[]> {
    const results: S3ObjectInfo[] = [];
    let continuationToken: string | null = null;

    do {
      const query = new URLSearchParams({ "list-type": "2", prefix: this.keyFor(prefix) });
      if (continuationToken != null) {
        query.set("continuation-token", continuationToken);
      }

      const response = await this.send("GET", "", undefined, {}, `?${query.toString()}`);
      const xml = await response.text();

      for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const block = match[1];
        results.push({
          key: textOf(block, "Key") ?? "",
          etag: etagOf(textOf(block, "ETag")),
          size: Number(textOf(block, "Size") ?? 0),
        });
      }

      continuationToken = xml.includes("<IsTruncated>true</IsTruncated>")
        ? (textOf(xml, "NextContinuationToken") ?? null)
        : null;
    } while (continuationToken != null);

    return results;
  }

  private async send(
    method: string,
    path: string,
    body?: Uint8Array | string,
    extraHeaders: Record<string, string> = {},
    query: string = "",
  ): Promise<Response> {
    const url = this.urlFor(path, query);
    const signed = await signRequest(
      {
        method,
        url,
        headers: extraHeaders,
        payload: body ?? new Uint8Array(0),
        region: this.config.region,
        date: this.now(),
      },
      this.config.credentials,
    );

    const request = new Request(signed.url, {
      method,
      headers: signed.headers,
      body: method === "GET" || method === "DELETE" ? undefined : (body as BodyInit),
    });

    const response = await this.fetchFn(request);
    if (response.ok) {
      return response;
    }

    const text = await response.text();
    if (response.status === 412) {
      throw new S3PreconditionFailedError(text);
    }
    throw new S3RequestError(response.status, text);
  }

  private urlFor(path: string, query: string): string {
    const endpoint = new URL(this.config.endpoint);
    const key = path === "" ? "" : this.keyFor(path);

    if (this.config.forcePathStyle) {
      const parts = [endpoint.pathname.replace(/\/$/, ""), this.config.bucket, key];
      endpoint.pathname = parts
        .filter((part) => part !== "")
        .map(encodePath)
        .join("/");
    } else {
      endpoint.hostname = `${this.config.bucket}.${endpoint.hostname}`;
      endpoint.pathname = key === "" ? "/" : `/${encodePath(key)}`;
    }

    return `${endpoint.origin}${endpoint.pathname}${query}`;
  }
}

function encodePath(key: string): string {
  return key.split("/").map(encodeRfc3986).join("/");
}

function etagOf(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value.replace(/^"|"$/g, "");
}

function textOf(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match == null ? null : decodeXml(match[1]);
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
