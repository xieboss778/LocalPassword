import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { buildLocalAccessToken } from "./local-access-token";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;

function payloadOf(token: string) {
  const parts = token.split(".");
  expect(parts).toHaveLength(3);
  return JSON.parse(Utils.fromUrlB64ToUtf8(parts[1]));
}

describe("buildLocalAccessToken", () => {
  it("is a three-part token the client can decode", () => {
    const token = buildLocalAccessToken({ userId, email: "a@b.c", name: "Owner" });
    expect(token.split(".")).toHaveLength(3);
    expect(payloadOf(token).sub).toBe(userId);
  });

  it("marks the account as premium and verified", () => {
    const payload = payloadOf(
      buildLocalAccessToken({ userId, email: "a@b.c", name: "Owner" }),
    );
    expect(payload.premium).toBe(true);
    expect(payload.email_verified).toBe(true);
    expect(payload.email).toBe("a@b.c");
  });

  it("expires far enough in the future to survive a decade offline", () => {
    const issuedAt = new Date("2026-01-01T00:00:00Z");
    const payload = payloadOf(
      buildLocalAccessToken({ userId, email: "a@b.c", name: "Owner", issuedAt }),
    );

    expect(payload.iat).toBe(Math.floor(issuedAt.getTime() / 1000));
    expect(payload.exp - payload.iat).toBeGreaterThanOrEqual(10 * 365 * 24 * 60 * 60);
  });

  it("points the issuer at the sentinel host so no request looks real", () => {
    const payload = payloadOf(buildLocalAccessToken({ userId, email: "a@b.c", name: "Owner" }));
    expect(payload.iss).toBe("https://vault.local.invalid");
  });
});
