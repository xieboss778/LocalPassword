import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";

import {
  applyCustomFields,
  applyFieldValues,
  fieldGroups,
  FIELDS,
  readCustomFields,
  readFieldValues,
} from "./item-fields";
import { ItemKind, setKind } from "./item-kind";

function emptyView(): CipherView {
  return new CipherView();
}

describe("item field mapping", () => {
  it("gives every kind a name field and no duplicate ids", () => {
    for (const kind of Object.values(ItemKind)) {
      const fields = FIELDS[kind];
      expect(fields.length).toBeGreaterThan(1);
      expect(fields[0].id).toBe("name");
      const ids = new Set(fields.map((field) => field.id));
      expect(ids.size).toBe(fields.length);
    }
  });

  it("round-trips a login", () => {
    const view = emptyView();
    setKind(view, ItemKind.Login);
    applyFieldValues(view, ItemKind.Login, {
      name: "GitHub",
      username: "bossxie",
      password: "hunter2",
      totp: "JBSWY3DP",
      uri: "https://github.com",
    });

    expect(view.name).toBe("GitHub");
    expect(view.login.username).toBe("bossxie");
    expect(view.login.uris[0].uri).toBe("https://github.com");
    expect(readFieldValues(view, ItemKind.Login)).toMatchObject({
      name: "GitHub",
      username: "bossxie",
      password: "hunter2",
      totp: "JBSWY3DP",
      uri: "https://github.com",
    });
  });

  it("keeps SSH keys in their native slot", () => {
    const view = emptyView();
    setKind(view, ItemKind.SshKey);
    applyFieldValues(view, ItemKind.SshKey, {
      name: "id_ed25519",
      privateKey: "-----BEGIN-----",
      publicKey: "ssh-ed25519 AAAA",
    });

    expect(view.type).toBe(5); // CipherType.SshKey
    expect(view.sshKey.privateKey).toBe("-----BEGIN-----");
    expect(view.fields).toHaveLength(1); // 只有 lp:kind 标记
  });

  it("stores token extras as custom fields", () => {
    const view = emptyView();
    setKind(view, ItemKind.Token);
    applyFieldValues(view, ItemKind.Token, {
      name: "Cloudflare",
      service: "生产",
      token: "t0ken",
      scope: "Zone.Read",
      env: "prod",
    });

    expect(view.login.username).toBe("生产");
    expect(view.login.password).toBe("t0ken");
    expect(readFieldValues(view, ItemKind.Token).scope).toBe("Zone.Read");
    expect(view.fields.map((field) => field.name)).toEqual(["lp:kind", "scope", "env"]);
  });

  it("does not add empty custom fields", () => {
    const view = emptyView();
    applyFieldValues(view, ItemKind.Server, { name: "跳板机", host: "10.0.2.14:22" });

    expect(view.fields.map((field) => field.name)).toEqual([]);
  });

  it("round-trips a card", () => {
    const view = emptyView();
    setKind(view, ItemKind.Card);
    applyFieldValues(view, ItemKind.Card, {
      name: "招行储蓄卡",
      cardholder: "XIE",
      number: "6225 8800 1234 5678",
      expMonth: "08",
      expYear: "2030",
      code: "123",
    });

    expect(view.card.number).toBe("6225 8800 1234 5678");
    expect(readFieldValues(view, ItemKind.Card).code).toBe("123");
  });

  it("round-trips an identity document number", () => {
    const view = emptyView();
    setKind(view, ItemKind.Identity);
    applyFieldValues(view, ItemKind.Identity, {
      name: "本人身份证",
      firstName: "波",
      lastName: "谢",
      idNumber: "110101199001011234",
    });

    expect(view.identity.passportNumber).toBe("110101199001011234");
    expect(readFieldValues(view, ItemKind.Identity).idNumber).toBe("110101199001011234");
  });

  it("round-trips a note", () => {
    const view = emptyView();
    setKind(view, ItemKind.Note);
    applyFieldValues(view, ItemKind.Note, { name: "恢复码", notes: "A1B2-C3D4" });

    expect(view.notes).toBe("A1B2-C3D4");
    expect(readFieldValues(view, ItemKind.Note).notes).toBe("A1B2-C3D4");
  });

  it("keeps the login notes and second URI", () => {
    const view = emptyView();
    setKind(view, ItemKind.Login);
    applyFieldValues(view, ItemKind.Login, {
      name: "GitHub",
      username: "bossxie",
      uri: "https://github.com",
      uri2: "https://gist.github.com",
      notes: "恢复码在抽屉里",
    });

    expect(view.login.uris.map((uri) => uri.uri)).toEqual([
      "https://github.com",
      "https://gist.github.com",
    ]);
    expect(readFieldValues(view, ItemKind.Login)).toMatchObject({
      uri: "https://github.com",
      uri2: "https://gist.github.com",
      notes: "恢复码在抽屉里",
    });
  });

  it("collapses a blank first URI instead of keeping an empty matcher", () => {
    const view = emptyView();
    setKind(view, ItemKind.Login);
    applyFieldValues(view, ItemKind.Login, {
      name: "GitHub",
      uri: "",
      uri2: "https://gist.github.com",
    });

    expect(view.login.uris.map((uri) => uri.uri)).toEqual(["https://gist.github.com"]);
  });

  it("groups fields for the form, with the item section first", () => {
    const groups = fieldGroups(ItemKind.Login);

    expect(groups.map((group) => group.key)).toEqual(["item", "login", "uri", "options"]);
    expect(groups[0].fields.map((field) => field.id)).toEqual(["name"]);
    expect(groups[1].labelKey).toBe("loginInformation");
    expect(groups[2].labelKey).toBe("autofillOptions");
    expect(groups[3].labelKey).toBe("additionalOptions");
  });

  it("reads user-defined custom fields and skips reserved slots", () => {
    const view = emptyView();
    setKind(view, ItemKind.Token);
    applyFieldValues(view, ItemKind.Token, {
      name: "Cloudflare",
      service: "生产",
      token: "t0ken",
      scope: "Zone.Read",
    });
    const linked = new FieldView();
    linked.name = "关联字段";
    linked.value = "x";
    linked.type = FieldType.Linked;
    const hidden = new FieldView();
    hidden.name = "恢复码";
    hidden.value = "A1B2";
    hidden.type = FieldType.Hidden;
    view.fields = [...view.fields, linked, hidden];

    expect(readCustomFields(view, ItemKind.Token)).toEqual([
      { name: "恢复码", value: "A1B2", hidden: true },
    ]);
  });

  it("replaces user-defined custom fields while preserving reserved ones", () => {
    const view = emptyView();
    setKind(view, ItemKind.Token);
    applyFieldValues(view, ItemKind.Token, {
      name: "Cloudflare",
      scope: "Zone.Read",
      token: "t0ken",
    });

    applyCustomFields(view, ItemKind.Token, [
      { name: "恢复码", value: "A1B2", hidden: true },
      { name: "", value: "无名", hidden: false },
    ]);

    expect(view.fields.map((field) => field.name)).toEqual(["lp:kind", "scope", "恢复码"]);
    expect(view.fields.find((field) => field.name === "恢复码")?.type).toBe(FieldType.Hidden);
    expect(readFieldValues(view, ItemKind.Token).scope).toBe("Zone.Read");
  });
});
