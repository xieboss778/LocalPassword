/**
 * AWS Signature V4 signing for S3-compatible storage (Cloudflare R2, MinIO, B2, OSS, COS).
 *
 * Pure WebCrypto implementation: no SDK, no extra dependency. The low-level `signCanonical`
 * mirrors the algorithm published in the AWS SigV4 test suite, and `signRequest` adds the
 * S3-required `x-amz-content-sha256` header on top of it.
 */

export interface AwsCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export interface SignRequestParams {
  readonly method: string;
  readonly url: string;
  /** Extra headers to sign, e.g. `if-match` for conditional manifest updates. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly payload?: Uint8Array | string;
  readonly region: string;
  /** Defaults to `s3`. */
  readonly service?: string;
  readonly date?: Date;
}

export interface SignedRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
}

export interface CanonicalSignParams {
  readonly method: string;
  readonly host: string;
  readonly path: string;
  readonly query: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly payloadHash: string;
  readonly date: Date;
  readonly region: string;
  readonly service: string;
  readonly credentials: AwsCredentials;
}

export interface CanonicalSignature {
  readonly canonicalRequest: string;
  readonly stringToSign: string;
  readonly signedHeaders: string;
  readonly signature: string;
  readonly authorization: string;
}

const ALGORITHM = "AWS4-HMAC-SHA256";
const AMZ_DATE_HEADER = "x-amz-date";
const CONTENT_SHA_HEADER = "x-amz-content-sha256";

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  // The WebCrypto typings want an ArrayBuffer; a Uint8Array view is a BufferSource at runtime.
  const buffer = data as unknown as ArrayBuffer;
  return toHex(await globalThis.crypto.subtle.digest("SHA-256", buffer));
}

async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    key as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = new TextEncoder().encode(data) as unknown as ArrayBuffer;
  const signature = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, payload);
  return new Uint8Array(signature);
}

export function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso.slice(0, 15) + "Z", dateStamp: iso.slice(0, 8) };
}

/** RFC 3986 encoding — differs from encodeURIComponent for `!'()*`. */
export function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

export function canonicalPath(pathname: string): string {
  if (pathname === "" || pathname === "/") {
    return "/";
  }
  return pathname.split("/").map(encodeRfc3986).join("/");
}

export function canonicalQuery(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const pairs: Array<[string, string]> = [];
  params.forEach((value, key) => pairs.push([encodeRfc3986(key), encodeRfc3986(value)]));
  pairs.sort(([ak, av], [bk, bv]) =>
    ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1,
  );
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

export async function signCanonical(params: CanonicalSignParams): Promise<CanonicalSignature> {
  const { amzDate, dateStamp } = toAmzDate(params.date);
  const headers: Record<string, string> = { ...params.headers };
  delete headers[AMZ_DATE_HEADER];
  headers[AMZ_DATE_HEADER] = amzDate;

  const lower = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), v.trim()] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const canonicalHeaders = lower.map(([k, v]) => `${k}:${v}\n`).join("");
  const signedHeaders = lower.map(([k]) => k).join(";");
  const canonicalRequest = [
    params.method.toUpperCase(),
    params.path,
    params.query,
    canonicalHeaders,
    signedHeaders,
    params.payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join("\n");

  let signingKey: Uint8Array = new TextEncoder().encode(
    "AWS4" + params.credentials.secretAccessKey,
  );
  for (const part of [dateStamp, params.region, params.service, "aws4_request"]) {
    signingKey = await hmacSha256(signingKey, part);
  }
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authorization =
    `${ALGORITHM} Credential=${params.credentials.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { canonicalRequest, stringToSign, signedHeaders, signature, authorization };
}

/**
 * Signs a request for S3 and returns the headers to send. `x-amz-content-sha256` is always
 * included, which R2 and MinIO require for PUT/GET.
 */
export async function signRequest(
  params: SignRequestParams,
  credentials: AwsCredentials,
): Promise<SignedRequest> {
  const url = new URL(params.url);
  const payload =
    params.payload === undefined
      ? new Uint8Array(0)
      : typeof params.payload === "string"
        ? new TextEncoder().encode(params.payload)
        : params.payload;

  const headers: Record<string, string> = { ...(params.headers ?? {}) };
  headers["host"] = url.host;
  headers[CONTENT_SHA_HEADER] = await sha256Hex(payload);

  // Capture the clock once: two `new Date()` calls could straddle a second boundary and
  // produce a header timestamp that does not match the one that was signed.
  const date = params.date ?? new Date();
  const { amzDate } = toAmzDate(date);
  const signed = await signCanonical({
    method: params.method,
    host: url.host,
    path: canonicalPath(url.pathname),
    query: canonicalQuery(url.search),
    headers,
    payloadHash: headers[CONTENT_SHA_HEADER],
    date,
    region: params.region,
    service: params.service ?? "s3",
    credentials,
  });

  return {
    url: url.toString(),
    headers: { ...headers, [AMZ_DATE_HEADER]: amzDate, authorization: signed.authorization },
  };
}
