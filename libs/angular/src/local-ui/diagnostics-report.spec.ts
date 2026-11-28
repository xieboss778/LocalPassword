import { buildDiagnosticReport, parseRuntimeVersions } from "./diagnostics-report";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) LocalPass/2026.11.0 Chrome/140.0.7339.80 Electron/38.2.0 Safari/537.36";

function report(overrides: Partial<Parameters<typeof buildDiagnosticReport>[0]> = {}) {
  return buildDiagnosticReport({
    appVersion: "2026.11.0",
    client: "desktop",
    device: "macos",
    locale: "zh-CN",
    theme: "dark",
    itemCount: 12,
    folderCount: 3,
    trashCount: 2,
    syncConfigured: true,
    syncPending: false,
    userAgent: USER_AGENT,
    generatedAt: new Date("2026-11-28T09:30:00.000Z"),
    ...overrides,
  });
}

describe("buildDiagnosticReport", () => {
  it("includes versions, platform, settings, aggregate counts and sync status", () => {
    expect(report()).toBe(
      [
        "LocalPass diagnostics v1",
        "app: LocalPass 2026.11.0",
        "client: desktop",
        "device: macos",
        "electron: 38.2.0",
        "chromium: 140.0.7339.80",
        "locale: zh-CN",
        "theme: dark",
        "vault: 12 items, 3 folders, 2 in trash",
        "sync: configured (up to date)",
        "generated: 2026-11-28T09:30:00.000Z",
        "excluded: item names, URLs, usernames, notes, passwords, TOTP secrets, tokens, ciphertext",
      ].join("\n"),
    );
  });

  it("describes an unconfigured and a pending sync", () => {
    expect(report({ syncConfigured: false, syncPending: true })).toContain("sync: not configured");
    expect(report({ syncPending: true })).toContain("sync: configured (pending changes)");
  });

  it("only extracts version numbers from the user agent", () => {
    expect(parseRuntimeVersions(USER_AGENT)).toEqual({
      electron: "38.2.0",
      chromium: "140.0.7339.80",
    });
    expect(report()).not.toContain("Mozilla");
    expect(report()).not.toContain("AppleWebKit");
  });

  it("omits the Electron line when the runtime does not report one", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
    expect(parseRuntimeVersions(ua)).toEqual({ electron: null, chromium: null });
    expect(report({ userAgent: ua })).not.toContain("electron:");
    expect(report({ userAgent: ua })).toContain("chromium: n/a");
  });

  it("prefers the Electron version exposed by the preload bridge", () => {
    expect(report({ electronVersion: "38.2.0" })).toContain("electron: 38.2.0");
  });

  it("reports the extension's native messaging permission when provided", () => {
    expect(
      report({ client: "extension", device: "chrome", nativeMessagingPermission: false }),
    ).toContain("native messaging permission: not granted");
    expect(report().includes("native messaging permission")).toBe(false);
  });
});
