import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { dedupeImportCiphers, importFingerprint } from "./import-dedupe";
import { applyFieldValues } from "./item-fields";
import { ItemKind, setKind } from "./item-kind";

function login(name: string, username: string, password = "secret", uri?: string): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Login);
  applyFieldValues(view, ItemKind.Login, { name, username, password, uri: uri ?? "" });
  return view;
}

function note(name: string, notes: string): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Note);
  applyFieldValues(view, ItemKind.Note, { name, notes });
  return view;
}

function card(name: string, number: string): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Card);
  applyFieldValues(view, ItemKind.Card, { name, number });
  return view;
}

function sshKey(name: string, fingerprint: string): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.SshKey);
  applyFieldValues(view, ItemKind.SshKey, { name, fingerprint });
  return view;
}

function token(
  name: string,
  service: string,
  accessKeyId = "",
  secret = "token-secret",
): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Token);
  applyFieldValues(view, ItemKind.Token, { name, service, accessKeyId, token: secret });
  return view;
}

function license(
  name: string,
  software: string,
  edition = "",
  orderId = "",
  serial = "",
): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.License);
  applyFieldValues(view, ItemKind.License, { name, software, edition, orderId, serial });
  return view;
}

function server(
  name: string,
  host: string,
  port = "",
  protocol = "",
  loginUser = "",
  password = "",
): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Server);
  applyFieldValues(view, ItemKind.Server, { name, host, port, protocol, loginUser, password });
  return view;
}

function identityItem(
  name: string,
  firstName: string,
  lastName: string,
  email = "",
  phone = "",
  idNumber = "",
  address = "",
): CipherView {
  const view = new CipherView();
  setKind(view, ItemKind.Identity);
  applyFieldValues(view, ItemKind.Identity, {
    name,
    firstName,
    lastName,
    email,
    phone,
    idNumber,
    address,
  });
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

  it("skips and counts duplicates within the import file", () => {
    const result = dedupeImportCiphers(
      [
        login("GitHub", "bossxie"),
        login("GitHub", "bossxie", "rotated"),
        login("GitLab", "bossxie"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers.map((cipher) => cipher.name)).toEqual(["GitHub", "GitLab"]);
  });

  it("counts vault and in-file duplicates together", () => {
    const result = dedupeImportCiphers(
      [login("GitHub", "bossxie"), login("GitHub", "bossxie"), login("GitLab", "bossxie")],
      [login("GitHub", "bossxie")],
    );

    expect(result.duplicateCount).toBe(2);
    expect(result.ciphers.map((cipher) => cipher.name)).toEqual(["GitLab"]);
  });

  it("reads a CSV login whose imported URI list is null without throwing", () => {
    const first = login("CSV Dup", "dupuser");
    const second = login("CSV Dup", "dupuser");
    // 通用 CSV 导入器不带 URI 时留下 null，指纹和搜索读取都必须容忍这种形状。
    (first.login as unknown as { uris: null }).uris = null;
    (second.login as unknown as { uris: null }).uris = null;

    const result = dedupeImportCiphers([first, second], []);

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers.map((cipher) => cipher.name)).toEqual(["CSV Dup"]);
  });

  it("matches in-file logins on the primary URI as well as the username", () => {
    const result = dedupeImportCiphers(
      [
        login("Work", "bossxie", "secret", "https://example.com/login"),
        login("Work", "bossxie", "rotated", "http://example.com/login/"),
        login("Work", "bossxie", "secret", "https://other.example/login"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers).toHaveLength(2);
  });

  it("keeps logins without a username or URI instead of collapsing them by name", () => {
    const result = dedupeImportCiphers([login("Work", ""), login("Work", "")], []);

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(2);
  });

  it("keeps distinct notes that share a name, since notes carry no identity", () => {
    const result = dedupeImportCiphers(
      [note("Recovery", "codes for A"), note("Recovery", "codes for B")],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(2);
  });

  it("keeps distinct cards that share a name and the last four digits", () => {
    const result = dedupeImportCiphers(
      [card("Visa", "4111 1111 1111 1234"), card("Visa", "5500 0000 0000 1234")],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(2);
  });

  it("still compares weak identities against the existing vault", () => {
    const result = dedupeImportCiphers(
      [note("Recovery", "codes for A")],
      [note("Recovery", "codes for B")],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers).toHaveLength(0);
  });

  it("dedupes SSH keys within the file by their key fingerprint", () => {
    const result = dedupeImportCiphers(
      [
        sshKey("Work key", "SHA256:aaa"),
        sshKey("Work key", "SHA256:aaa"),
        sshKey("Home key", "SHA256:bbb"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers.map((cipher) => cipher.name)).toEqual(["Work key", "Home key"]);
  });

  it("keeps tokens with the same name and service but different access key ids", () => {
    const result = dedupeImportCiphers(
      [
        token("AWS", "Amazon Web Services", "AKIA-OLD"),
        token("AWS", "Amazon Web Services", "AKIA-NEW"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(2);
  });

  it("dedupes tokens when normalized name, service and access key id all match", () => {
    const result = dedupeImportCiphers(
      [
        token("AWS", "Amazon Web Services", "AKIA123", "secret-one"),
        token("aws ", "amazon  web services", "akia123", "secret-two"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers).toHaveLength(1);
  });

  it("keeps a token without an access key id apart from one that has it", () => {
    const result = dedupeImportCiphers(
      [token("AWS", "Amazon Web Services"), token("AWS", "Amazon Web Services", "AKIA123")],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(2);
  });

  it("still compares tokens against the vault by the name and service fingerprint", () => {
    const result = dedupeImportCiphers(
      [token("AWS", "Amazon Web Services", "AKIA-NEW")],
      [token("AWS", "Amazon Web Services", "AKIA-OLD")],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers).toHaveLength(0);
  });

  it("keeps licenses with the same name and software but a different edition or order id", () => {
    const result = dedupeImportCiphers(
      [
        license("JetBrains", "IntelliJ IDEA", "Personal", "ORDER-1"),
        license("JetBrains", "IntelliJ IDEA", "Enterprise", "ORDER-1"),
        license("JetBrains", "IntelliJ IDEA", "Personal", "ORDER-2"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(3);
  });

  it("ignores the license serial when deduping within a file", () => {
    const result = dedupeImportCiphers(
      [
        license("JetBrains", "IntelliJ IDEA", "Personal", "ORDER-1", "SERIAL-A"),
        license("JetBrains", "IntelliJ IDEA", "personal", "order-1", "SERIAL-B"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers).toHaveLength(1);
  });

  it("keeps servers with the same name and host but a different port, protocol or login user", () => {
    const result = dedupeImportCiphers(
      [
        server("Prod", "db.example.com", "22", "SSH", "deploy"),
        server("Prod", "db.example.com", "2222", "SSH", "deploy"),
        server("Prod", "db.example.com", "22", "SFTP", "deploy"),
        server("Prod", "db.example.com", "22", "SSH", "root"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(4);
  });

  it("ignores the server password when deduping within a file", () => {
    const result = dedupeImportCiphers(
      [
        server("Prod", "db.example.com", " 22 ", "ssh", "Deploy", "password-a"),
        server("Prod", "db.example.com", "22", "SSH", "deploy", "password-b"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers).toHaveLength(1);
  });

  it("keeps identities with the same name but a different email or phone", () => {
    const result = dedupeImportCiphers(
      [
        identityItem("Alice", "Alice", "Wang", "alice@example.com", "555-0100"),
        identityItem("Alice", "Alice", "Wang", "alice@work.example", "555-0100"),
        identityItem("Alice", "Alice", "Wang", "alice@example.com", "555-0199"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(0);
    expect(result.ciphers).toHaveLength(3);
  });

  it("ignores identity PII numbers and address when deduping within a file", () => {
    const result = dedupeImportCiphers(
      [
        identityItem("Alice", "Alice", "Wang", "alice@example.com", "555-0100", "ID-A", "Addr A"),
        identityItem("Alice", "Alice", "Wang", "alice@example.com", "555-0100", "ID-B", "Addr B"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(1);
    expect(result.ciphers).toHaveLength(1);
  });

  it("still dedupes entries whose extra in-file identifiers are all empty", () => {
    const result = dedupeImportCiphers(
      [
        token("AWS", "Amazon Web Services"),
        token("AWS", "Amazon Web Services"),
        license("JetBrains", "IntelliJ IDEA"),
        license("JetBrains", "IntelliJ IDEA"),
        server("Prod", "db.example.com"),
        server("Prod", "db.example.com"),
        identityItem("Alice", "Alice", "Wang"),
        identityItem("Alice", "Alice", "Wang"),
      ],
      [],
    );

    expect(result.duplicateCount).toBe(4);
    expect(result.ciphers.map((cipher) => cipher.name)).toEqual([
      "AWS",
      "JetBrains",
      "Prod",
      "Alice",
    ]);
  });

  it("remaps folder and collection relationships after dropping an in-file duplicate", () => {
    const ciphers = [
      login("GitHub", "bossxie"),
      login("GitHub", "bossxie"),
      login("GitLab", "bossxie"),
    ];

    const result = dedupeImportCiphers(
      ciphers,
      [],
      [
        [0, 0],
        [1, 0],
        [2, 1],
      ],
      [
        [0, 3],
        [1, 4],
        [2, 5],
      ],
    );

    expect(result.folderRelationships).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(result.collectionRelationships).toEqual([
      [0, 3],
      [1, 5],
    ]);
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
