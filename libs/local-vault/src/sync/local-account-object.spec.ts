import { of } from "rxjs";

import { UserId } from "@localpass/common/types/guid";

import { LocalAccountObjectReader, isLocalAccountObject } from "./local-account-object";

describe("isLocalAccountObject", () => {
  const anchor = {
    version: 2,
    userId: "5b0f6c1e-2d3a-4f5b-8c7d-9e0a1b2c3d4e",
    email: "owner@example.com",
    updatedAt: "2026-01-02T03:04:05.000Z",
    unlock: { salt: "owner@example.com", kdf: { kdfType: 0 }, masterKeyWrappedUserKey: "w" },
    wrappedPrivateKey: "p",
  };

  it("accepts the anchor the reader writes", () => {
    expect(isLocalAccountObject(anchor)).toBe(true);
  });

  it("rejects objects that cannot restore an account", () => {
    expect(isLocalAccountObject(null)).toBe(false);
    expect(isLocalAccountObject("account.json")).toBe(false);
    expect(isLocalAccountObject({ ...anchor, version: 1 })).toBe(false);
    expect(isLocalAccountObject({ ...anchor, userId: undefined })).toBe(false);
    expect(isLocalAccountObject({ ...anchor, email: "" })).toBe(false);
    expect(isLocalAccountObject({ ...anchor, unlock: { salt: "s" } })).toBe(false);
  });
});

describe("LocalAccountObjectReader", () => {
  const userId = "5b0f6c1e-2d3a-4f5b-8c7d-9e0a1b2c3d4e" as UserId;

  it("records the account id so another device can adopt it", async () => {
    const reader = new LocalAccountObjectReader(
      { accounts$: of({ [userId]: { email: "owner@example.com" } }) } as any,
      {
        masterPasswordUnlockData$: () =>
          of({
            salt: "owner@example.com",
            kdf: { kdfType: 0, iterations: 600_000 },
            masterKeyWrappedUserKey: { encryptedString: "wrapped-user-key" },
          }),
      } as any,
      {
        accountCryptographicState$: () => of({ V1: { private_key: "wrapped-private-key" } }),
      } as any,
      () => new Date("2026-01-02T03:04:05.000Z"),
    );

    await expect(reader.read(userId)).resolves.toEqual({
      version: 2,
      userId,
      email: "owner@example.com",
      updatedAt: "2026-01-02T03:04:05.000Z",
      unlock: {
        salt: "owner@example.com",
        kdf: { kdfType: 0, iterations: 600_000 },
        masterKeyWrappedUserKey: "wrapped-user-key",
      },
      wrappedPrivateKey: "wrapped-private-key",
    });
  });
});
