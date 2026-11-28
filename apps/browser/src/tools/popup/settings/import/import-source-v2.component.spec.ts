import { resolveImportType } from "./import-source-v2.component";

const chrome = { mac: false, safari: false, firefox: false };
const macChrome = { mac: true, safari: false, firefox: false };

describe("resolveImportType", () => {
  it("routes 1Password archives to their dedicated importers", () => {
    expect(resolveImportType("onepassword", "export.1pux", chrome)).toBe("1password1pux");
    expect(resolveImportType("onepassword", "export.1pif", chrome)).toBe("1password1pif");
  });

  it("routes 1Password CSV by the platform that produced it", () => {
    expect(resolveImportType("onepassword", "export.csv", macChrome)).toBe("1passwordmaccsv");
    expect(resolveImportType("onepassword", "export.csv", chrome)).toBe("1passwordwincsv");
  });

  it("routes Bitwarden CSV and JSON through the compatible LocalPass importers", () => {
    expect(resolveImportType("bitwarden", "export.csv", chrome)).toBe("localpasscsv");
    expect(resolveImportType("bitwarden", "export.json", chrome)).toBe("localpassjson");
  });

  it("routes generic CSV by browser family", () => {
    expect(resolveImportType("generic", "passwords.csv", chrome)).toBe("chromecsv");
    expect(resolveImportType("generic", "passwords.csv", { ...chrome, safari: true })).toBe(
      "safaricsv",
    );
    expect(resolveImportType("generic", "passwords.csv", { ...chrome, firefox: true })).toBe(
      "firefoxcsv",
    );
  });

  it("defaults LocalPass backups to the password-protected JSON importer", () => {
    expect(resolveImportType("localpass", "backup.json", chrome)).toBe("localpassjson");
  });
});
