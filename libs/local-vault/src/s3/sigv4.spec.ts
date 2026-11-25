import { canonicalPath, canonicalQuery, signCanonical, signRequest } from "./sigv4";

// AWS SigV4 test suite, case "get-vanilla":
// https://docs.aws.amazon.com/general/latest/gr/signature-v4-test-suite.html
const AWS_VECTOR = {
  credentials: {
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  },
  date: new Date("2015-08-30T12:36:00Z"),
  expectedSignature: "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
  expectedAuthorization:
    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
    "SignedHeaders=host;x-amz-date, " +
    "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
};

describe("signCanonical", () => {
  it("reproduces the AWS get-vanilla signature", async () => {
    const result = await signCanonical({
      method: "GET",
      host: "example.amazonaws.com",
      path: "/",
      query: "",
      headers: { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z" },
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      date: AWS_VECTOR.date,
      region: "us-east-1",
      service: "service",
      credentials: AWS_VECTOR.credentials,
    });

    expect(result.signature).toBe(AWS_VECTOR.expectedSignature);
    expect(result.authorization).toBe(AWS_VECTOR.expectedAuthorization);
  });

  it("changes the signature when the payload changes", async () => {
    const base = {
      method: "PUT",
      host: "bucket.r2.cloudflarestorage.com",
      path: "/vault/account.json",
      query: "",
      headers: { host: "bucket.r2.cloudflarestorage.com" },
      date: new Date("2026-11-24T00:00:00Z"),
      region: "auto",
      service: "s3",
      credentials: { accessKeyId: "AKIA", secretAccessKey: "secret" },
    };

    const a = await signCanonical({ ...base, payloadHash: "aa" });
    const b = await signCanonical({ ...base, payloadHash: "bb" });
    expect(a.signature).not.toBe(b.signature);
    expect(a.signature).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("canonical path and query", () => {
  it("keeps slashes and encodes segments", () => {
    expect(canonicalPath("/")).toBe("/");
    const encodedUser = encodeURIComponent("用户");
    expect(canonicalPath("/vault/用户/account.json")).toBe(`/vault/${encodedUser}/account.json`);
  });

  it("sorts query parameters by key then value", () => {
    expect(canonicalQuery("?list-type=2&prefix=vault%2F&max-keys=10")).toBe(
      "list-type=2&max-keys=10&prefix=vault%2F",
    );
  });
});

describe("signRequest", () => {
  it("adds the content hash and authorization headers", async () => {
    const signed = await signRequest(
      {
        method: "PUT",
        url: "https://acct.r2.cloudflarestorage.com/vault-1/user-a/manifest.json",
        payload: '{"snapshot":"abc"}',
        region: "auto",
        date: new Date("2026-11-24T10:00:00Z"),
      },
      { accessKeyId: "AKIA", secretAccessKey: "secret" },
    );

    expect(signed.headers["x-amz-content-sha256"]).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.headers["x-amz-date"]).toBe("20261124T100000Z");
    expect(signed.headers.authorization).toContain("Credential=AKIA/20261124/auto/s3/aws4_request");
    expect(signed.headers.authorization).toContain(
      "SignedHeaders=host;x-amz-content-sha256;x-amz-date",
    );
  });
});
