import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { dedupeImportCiphers, importFingerprint } from "./import-dedupe";
import { applyFieldValues } from "./item-fields";
import { ItemKind, setKind } from "./item-kind";

function login(name: string, username: string, password = "secret"): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Login);
  applyFieldValues(view, ItemKind.Login, { name, username, password });
  return view;
}

describe("dedupeImportCiphers", () => {
  it("skips entries matching an existing name and username, ignoring case and spacing", () => {
    const existing = login("GitHub", "BossXie");
    const incoming = [login("github ", "bossxie", "new-secret"), login("GitLab", "bossxie")];

    const result = dedupeImportCiphers(incoming, [existing]);

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers.map((cipher) => cipher.name)).toEqual(["GitLab"]);
  });

  it("keeps same-name entries with a different username", () => {
    const existing = login("GitHub", "bossxie");
    const incoming = [login("GitHub", "another-user")];

    const result = dedupeImportCiphers(incoming, [existing]);

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(1);
  });

  it("ignores entries already in the trash", () => {
    const existing = login("GitHub", "bossxie");
    existing.deletedDate = new Date();

    const result = dedupeImportCiphers([login("GitHub", "bossxie")], [existing]);

    expect(result.duplicateCount).toBe(0);
  });

  it("keeps duplicates within the import file, since only the local vault is compared", () => {
    const result = dedupeImportCiphers(
      [login("GitHub", "bossxie"), login("GitHub", "bossxie")],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(2);
  });

  it("remaps folder and collection relationships to the filtered list", () => {
    const existing = login("GitHub", "bossxie");
    const keptOne = login("GitLab", "bossxie");
    const keptTwo = login("Example", "bossxie");
    const ciphers = [login("GitHub", "bossxie"), keptOne, keptTwo];

    const result = dedupeImportCiphers(
      ciphers,
      [existing],
      [
        [0, 0],
        [1, 0],
        [2, 1],
      ],
      [
        [1, 4],
        [2, 5],
      ],
    );

    expect(result.folderRelationships).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(result.collectionRelationships).toEqual([
      [0, 4],
      [1, 5],
    ]);
  });

  it("uses the last four digits to distinguish cards, without exposing the full number", () => {
    const first = new CipherView();
    setKind(first, ItemKind.Card);
    applyFieldValues(first, ItemKind.Card, { name: "Visa", number: "4111 1111 1111 1234" });

    expect(importFingerprint(first)).toContain("1234");
    expect(importFingerprint(first)).not.toContain("4111");
  });
});
