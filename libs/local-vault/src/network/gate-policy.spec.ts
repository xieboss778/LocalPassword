import { BREACH_CHECK_HOST, LOCAL_VAULT_SENTINEL_HOST, NetworkGatePolicy } from "./gate-policy";

const policy = new NetworkGatePolicy({
  storageHosts: ["acct123.r2.cloudflarestorage.com"],
  breachCheckEnabled: true,
});

describe("NetworkGatePolicy", () => {
  it("allows the configured storage host", () => {
    const storageUrl = "https://acct123.r2.cloudflarestorage.com/vault/user-a/manifest.json";
    expect(policy.evaluate({ url: storageUrl })).toEqual({ action: "allow", reason: "storage" });
  });

  it("blocks the loopback sentinel before anything else", () => {
    expect(policy.evaluate({ url: `https://${LOCAL_VAULT_SENTINEL_HOST}/api/sync` })).toEqual({
      action: "block",
      reason: "sentinel-host",
    });
  });

  it("blocks every bitwarden.com host", () => {
    expect(policy.evaluate({ url: "https://api.bitwarden.com/sync" })).toEqual({
      action: "block",
      reason: "not-allowlisted",
    });
    expect(policy.evaluate({ url: "https://events.bitwarden.com/collect" }).action).toBe("block");
  });

  it("allows the breach check only when the user triggered it", () => {
    expect(policy.evaluate({ url: `https://${BREACH_CHECK_HOST}/range/abc` }).action).toBe("block");
    expect(
      policy.evaluate({ url: `https://${BREACH_CHECK_HOST}/range/abc`, userInitiated: true }),
    ).toEqual({ action: "allow", reason: "breach-check" });
  });

  it("respects the breach check opt-out", () => {
    const off = new NetworkGatePolicy({ storageHosts: [], breachCheckEnabled: false });
    const breachUrl = `https://${BREACH_CHECK_HOST}/range/abc`;
    expect(off.evaluate({ url: breachUrl, userInitiated: true }).action).toBe("block");
  });

  it("blocks malformed urls", () => {
    expect(policy.evaluate({ url: "not a url" })).toEqual({
      action: "block",
      reason: "invalid-url",
    });
  });
});
