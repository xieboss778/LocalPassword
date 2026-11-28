import { resolveImportType } from "./import-landing-desktop-v2.component";

describe("resolveImportType (desktop)", () => {
  it("uses the LocalPass CSV importer for Bitwarden CSV exports", () => {
    expect(resolveImportType("vault.csv", "localpassjson")).toBe("localpasscsv");
  });

  it("keeps LocalPass JSON files on the JSON importer", () => {
    expect(resolveImportType("vault.json", "localpassjson")).toBe("localpassjson");
  });

  it("selects the Windows 1Password importer for Windows CSV exports", () => {
    const windowsExportHeader = '"UUID","TITLE","SCOPE","SECTION 1: NAME"';

    expect(resolveImportType("vault.csv", "1password1pux", windowsExportHeader)).toBe(
      "1passwordwincsv",
    );
  });

  it("keeps the selected Mac 1Password importer for Mac CSV exports", () => {
    const macExportHeader = '"Title","Type","Created Date","Modified Date"';

    expect(resolveImportType("vault.csv", "1password1pux", macExportHeader)).toBe(
      "1passwordmaccsv",
    );
  });
});
