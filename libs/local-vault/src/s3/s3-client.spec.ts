import { S3Client, S3PreconditionFailedError, S3RequestError } from "./s3-client";

const config = {
  endpoint: "https://acct123.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "vault",
  credentials: { accessKeyId: "AKIA", secretAccessKey: "secret" },
};

function clientWith(response: Response | ((request: Request) => Response)) {
  const requests: Request[] = [];
  const client = new S3Client(
    config,
    async (request) => {
      requests.push(request);
      return typeof response === "function" ? response(request) : response;
    },
    () => new Date("2026-11-24T10:00:00Z"),
  );
  return { client, requests };
}

describe("S3Client", () => {
  it("addresses the bucket as a subdomain and encodes the key", async () => {
    const { client, requests } = clientWith(new Response("", { status: 200 }));

    await client.putObject("user-a/manifest.json", "{}");

    expect(requests[0].url).toBe(
      "https://vault.acct123.r2.cloudflarestorage.com/user-a/manifest.json",
    );
    expect(requests[0].method).toBe("PUT");
  });

  it("uses path-style addressing when asked to", async () => {
    const { client, requests } = (() => {
      const requests: Request[] = [];
      const pathStyleClient = new S3Client({ ...config, forcePathStyle: true }, async (request) => {
        requests.push(request);
        return new Response("", { status: 200 });
      });
      return { client: pathStyleClient, requests };
    })();

    await client.putObject("user-a/account.json", "{}");

    expect(requests[0].url).toBe(
      "https://acct123.r2.cloudflarestorage.com/vault/user-a/account.json",
    );
  });

  it("signs the request and sends the conditional header", async () => {
    const { client, requests } = clientWith(new Response("", { status: 200 }));

    await client.putObject("user-a/manifest.json", "{}", { ifMatch: "abc" });

    expect(requests[0].headers.get("if-match")).toBe('"abc"');
    expect(requests[0].headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
    expect(requests[0].headers.get("x-amz-content-sha256")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("raises a precondition error when another device wrote first", async () => {
    const { client } = clientWith(new Response("PreconditionFailed", { status: 412 }));

    const write = client.putObject("user-a/manifest.json", "{}", { ifMatch: "abc" });

    await expect(write).rejects.toBeInstanceOf(S3PreconditionFailedError);
  });

  it("returns other failures as request errors", async () => {
    const { client } = clientWith(new Response("nope", { status: 403 }));

    await expect(client.getObject("user-a/manifest.json")).rejects.toBeInstanceOf(S3RequestError);
  });

  it("returns null for a missing object", async () => {
    const { client } = clientWith(new Response("", { status: 404 }));

    await expect(client.getObject("user-a/manifest.json")).resolves.toBeNull();
  });

  it("blocks the placeholder sentinel host without sending a request", async () => {
    const requests: Request[] = [];
    const client = new S3Client(
      { ...config, endpoint: "https://vault.local.invalid" },
      async (request) => {
        requests.push(request);
        return new Response("", { status: 200 });
      },
    );

    await expect(client.getObject("user-a/manifest.json")).rejects.toThrow(
      "S3 request blocked: not-allowlisted",
    );
    expect(requests).toHaveLength(0);
  });

  it("refuses to follow redirects that would leave the configured storage host", async () => {
    const { client, requests } = clientWith(new Response("", { status: 200 }));

    await client.putObject("user-a/manifest.json", "{}");

    expect(requests[0].redirect).toBe("error");
  });

  it("reads the body and the etag", async () => {
    const { client } = clientWith(
      new Response('{"snapshot":"abc"}', { status: 200, headers: { etag: '"etag-1"' } }),
    );

    const object = await client.getObject("user-a/manifest.json");

    expect(new TextDecoder().decode(object.body)).toBe('{"snapshot":"abc"}');
    expect(object.etag).toBe("etag-1");
  });

  it("walks every page of list-objects-v2", async () => {
    const pages = [
      "<ListBucketResult><IsTruncated>true</IsTruncated><Contents>" +
        '<Key>user-a/a.json</Key><ETag>"e1"</ETag><Size>3</Size>' +
        "</Contents><NextContinuationToken>next</NextContinuationToken></ListBucketResult>",
      "<ListBucketResult><IsTruncated>false</IsTruncated><Contents>" +
        '<Key>user-a/b.json</Key><ETag>"e2"</ETag><Size>4</Size>' +
        "</Contents></ListBucketResult>",
    ];
    let page = 0;
    const { client, requests } = clientWith(() => new Response(pages[page++], { status: 200 }));

    const objects = await client.listObjects("user-a/");

    expect(objects.map((o) => o.key)).toEqual(["user-a/a.json", "user-a/b.json"]);
    expect(objects[0].etag).toBe("e1");
    expect(requests[1].url).toContain("continuation-token=next");
  });

  it("deletes without a body", async () => {
    const { client, requests } = clientWith(new Response(null, { status: 204 }));

    await client.deleteObject("user-a/snapshots/old.json");

    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
  });
});
