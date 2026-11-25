import {
  base32Encode,
  decodeMigrationPayload,
  parseMigrationUri,
  toOtpauthUri,
} from "./otpauth-migration";

function varint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  bytes.push(remaining);
  return bytes;
}

function fieldNumber(number: number, wireType: number): number[] {
  return varint((number << 3) | wireType);
}

function bytesField(number: number, value: Uint8Array): number[] {
  return [...fieldNumber(number, 2), ...varint(value.length), ...Array.from(value)];
}

function stringField(number: number, value: string): number[] {
  return bytesField(number, new TextEncoder().encode(value));
}

function varintField(number: number, value: number): number[] {
  return [...fieldNumber(number, 0), ...varint(value)];
}

type OtpSpec = {
  secret: string;
  name: string;
  issuer: string;
  algorithm?: number;
  digits?: number;
  type?: number;
  counter?: number;
};

function encodeOtp(spec: OtpSpec): number[] {
  return [
    ...bytesField(1, new TextEncoder().encode(spec.secret)),
    ...stringField(2, spec.name),
    ...stringField(3, spec.issuer),
    ...varintField(4, spec.algorithm ?? 1),
    ...varintField(5, spec.digits ?? 1),
    ...varintField(6, spec.type ?? 2),
    ...varintField(7, spec.counter ?? 0),
  ];
}

function encodePayload(otps: OtpSpec[]): string {
  const body: number[] = [];
  for (const otp of otps) {
    body.push(...bytesField(1, new Uint8Array(encodeOtp(otp))));
  }
  body.push(...varintField(2, 1));

  const binary = String.fromCharCode(...body);
  const base64 = Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

describe("decodeMigrationPayload", () => {
  it("reads every account in the payload", () => {
    const payload = encodePayload([
      { secret: "abcdefgh", name: "owner@example.com", issuer: "GitHub" },
      { secret: "ijklmnop", name: "owner@example.com", issuer: "Google" },
    ]);

    const otps = decodeMigrationPayload(payload);

    expect(otps).toHaveLength(2);
    expect(otps[0].issuer).toBe("GitHub");
    expect(otps[1].issuer).toBe("Google");
    expect(new TextDecoder().decode(otps[0].secret)).toBe("abcdefgh");
  });

  it("maps the algorithm, digit count and type enums", () => {
    const payload = encodePayload([
      {
        secret: "s",
        name: "n",
        issuer: "i",
        algorithm: 2,
        digits: 2,
        type: 1,
        counter: 42,
      },
    ]);

    const [otp] = decodeMigrationPayload(payload);

    expect(otp.algorithm).toBe("SHA256");
    expect(otp.digits).toBe(8);
    expect(otp.type).toBe("HOTP");
    expect(otp.counter).toBe(42);
  });

  it("throws on a truncated payload", () => {
    expect(() => decodeMigrationPayload("AQ")).toThrow();
  });
});

describe("parseMigrationUri", () => {
  it("rejects a URI that is not a migration URI", () => {
    expect(() => parseMigrationUri("otpauth://totp/a?secret=JBSWY3DP")).toThrow();
  });

  it("rejects a migration URI without data", () => {
    expect(() => parseMigrationUri("otpauth-migration://offline")).toThrow();
  });

  it("decodes the data parameter", () => {
    const payload = encodePayload([{ secret: "abc", name: "n", issuer: "Issuer" }]);

    const [otp] = parseMigrationUri(`otpauth-migration://offline?data=${payload}`);

    expect(otp.issuer).toBe("Issuer");
  });
});

describe("toOtpauthUri", () => {
  it("builds a TOTP URI with the base32 secret and issuer", () => {
    const uri = toOtpauthUri({
      secret: new TextEncoder().encode("Hello"),
      name: "owner@example.com",
      issuer: "GitHub",
      algorithm: "SHA1",
      digits: 6,
      type: "TOTP",
      counter: 0,
    });

    expect(uri.startsWith("otpauth://totp/GitHub%3Aowner%40example.com?")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DP");
    expect(uri).toContain("issuer=GitHub");
    expect(uri).toContain("period=30");
  });

  it("builds an HOTP URI with the counter", () => {
    const uri = toOtpauthUri({
      secret: new Uint8Array([1, 2, 3]),
      name: "n",
      issuer: "",
      algorithm: "SHA1",
      digits: 6,
      type: "HOTP",
      counter: 7,
    });

    expect(uri.startsWith("otpauth://hotp/n?")).toBe(true);
    expect(uri).toContain("counter=7");
  });
});

describe("base32Encode", () => {
  it("matches the RFC 4648 vector without padding", () => {
    expect(base32Encode(new TextEncoder().encode("Hello"))).toBe("JBSWY3DP");
  });
});
