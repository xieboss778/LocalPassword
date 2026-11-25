/**
 * Decoder for Google Authenticator's `otpauth-migration://offline?data=...` export.
 *
 * The `data` parameter is a base64-encoded protobuf `MigrationPayload`. This is a hand-written
 * decoder for the handful of wire types that message uses, so no protobuf dependency is added.
 *
 * Message shape (Google Authenticator, proto3):
 *   MigrationPayload { repeated OtpParameters otp_parameters = 1; int32 version = 2; ... }
 *   OtpParameters    { bytes secret = 1; string name = 2; string issuer = 3;
 *                      Algorithm algorithm = 4; DigitCount digits = 5; OtpType type = 6;
 *                      int64 counter = 7 }
 */

export type MigrationAlgorithm = "SHA1" | "SHA256" | "SHA512" | "MD5";
export type MigrationOtpType = "TOTP" | "HOTP";

export interface MigrationOtp {
  /** Raw HMAC secret; base32-encoded when turned into an otpauth URI. */
  readonly secret: Uint8Array;
  readonly name: string;
  readonly issuer: string;
  readonly algorithm: MigrationAlgorithm;
  readonly digits: 6 | 8;
  readonly type: MigrationOtpType;
  readonly counter: number;
}

const ALGORITHMS: Record<number, MigrationAlgorithm> = {
  0: "SHA1",
  1: "SHA1",
  2: "SHA256",
  3: "SHA512",
  4: "MD5",
};

/** Reads a protobuf varint starting at `offset`. */
function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let index = offset;
  while (index < bytes.length) {
    const byte = bytes[index++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) {
      return [value, index];
    }
    shift += 7;
  }
  throw new Error("Truncated protobuf varint.");
}

interface Field {
  readonly fieldNumber: number;
  readonly wireType: number;
  readonly value: number | Uint8Array;
}

function readFields(bytes: Uint8Array): Field[] {
  const fields: Field[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    let tag: number;
    [tag, offset] = readVarint(bytes, offset);
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      let value: number;
      [value, offset] = readVarint(bytes, offset);
      fields.push({ fieldNumber, wireType, value });
    } else if (wireType === 2) {
      let length: number;
      [length, offset] = readVarint(bytes, offset);
      const end = offset + length;
      if (end > bytes.length) {
        throw new Error("Truncated protobuf length-delimited field.");
      }
      fields.push({ fieldNumber, wireType, value: bytes.subarray(offset, end) });
      offset = end;
    } else {
      throw new Error(`Unsupported protobuf wire type ${wireType}.`);
    }
  }
  return fields;
}

function textOf(fields: Field[], fieldNumber: number): string {
  const field = fields.find((candidate) => candidate.fieldNumber === fieldNumber);
  if (field == null || typeof field.value === "number") {
    return "";
  }
  return new TextDecoder().decode(field.value);
}

function numberOf(fields: Field[], fieldNumber: number): number {
  const field = fields.find((candidate) => candidate.fieldNumber === fieldNumber);
  return field == null || typeof field.value !== "number" ? 0 : field.value;
}

function parseOtpParameters(bytes: Uint8Array): MigrationOtp | null {
  const fields = readFields(bytes);
  const secretField = fields.find((field) => field.fieldNumber === 1);
  if (secretField == null || typeof secretField.value === "number") {
    return null;
  }

  const typeValue = numberOf(fields, 6);
  const digitsValue = numberOf(fields, 5);

  return {
    secret: secretField.value,
    name: textOf(fields, 2),
    issuer: textOf(fields, 3),
    algorithm: ALGORITHMS[numberOf(fields, 4)] ?? "SHA1",
    digits: digitsValue === 2 ? 8 : 6,
    type: typeValue === 1 ? "HOTP" : "TOTP",
    counter: numberOf(fields, 7),
  };
}

/**
 * Decodes the `data` payload of a migration URI.
 *
 * @param payload Base64 (standard or URL-safe) protobuf bytes from the `data` query parameter.
 */
export function decodeMigrationPayload(payload: string): MigrationOtp[] {
  const bytes = base64ToBytes(payload);
  const otps: MigrationOtp[] = [];

  for (const field of readFields(bytes)) {
    if (field.fieldNumber !== 1 || typeof field.value === "number") {
      continue;
    }
    const otp = parseOtpParameters(field.value);
    if (otp != null) {
      otps.push(otp);
    }
  }

  return otps;
}

/**
 * Extracts the accounts from an `otpauth-migration://offline?data=...` URI.
 *
 * @throws If the URI is not a migration URI or carries no `data` parameter.
 */
export function parseMigrationUri(uri: string): MigrationOtp[] {
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith("otpauth-migration://")) {
    throw new Error("Not a Google Authenticator migration URI.");
  }

  const queryStart = trimmed.indexOf("?");
  if (queryStart === -1) {
    throw new Error("The migration URI has no data parameter.");
  }

  const params = new URLSearchParams(trimmed.slice(queryStart + 1));
  const data = params.get("data");
  if (data == null || data === "") {
    throw new Error("The migration URI has no data parameter.");
  }

  return decodeMigrationPayload(data);
}

/** Builds the `otpauth://` URI LocalPass stores in a login's TOTP field. */
export function toOtpauthUri(otp: MigrationOtp): string {
  const label = otp.issuer ? `${otp.issuer}:${otp.name}` : otp.name;
  const params = new URLSearchParams({
    secret: base32Encode(otp.secret),
    algorithm: otp.algorithm,
    digits: String(otp.digits),
  });
  if (otp.issuer !== "") {
    params.set("issuer", otp.issuer);
  }
  if (otp.type === "TOTP") {
    params.set("period", "30");
  } else {
    params.set("counter", String(otp.counter));
  }

  const host = otp.type === "TOTP" ? "totp" : "hotp";
  return `otpauth://${host}/${encodeURIComponent(label)}?${params.toString()}`;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, unpadded — the form `otpauth://` expects. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base64ToBytes(payload: string): Uint8Array {
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = globalThis.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
