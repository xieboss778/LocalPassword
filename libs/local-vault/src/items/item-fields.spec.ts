import { UriMatchStrategy } from "@localpass/common/models/domain/domain-service";
import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";
import { LoginUriView } from "@localpass/common/vault/models/view/login-uri.view";

import {
  applyCustomFields,
  applyFieldValues,
  fieldGroups,
  FIELDS,
  formatCardExpiryInput,
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
      expiry: "08/30",
      code: "123",
    });

    expect(view.card.number).toBe("6225 8800 1234 5678");
    expect(view.card.expMonth).toBe("08");
    expect(view.card.expYear).toBe("2030");
    expect(readFieldValues(view, ItemKind.Card).code).toBe("123");
    expect(readFieldValues(view, ItemKind.Card).expiry).toBe("08/30");
  });

  it("formats card expiry input and displays legacy four-digit years as MM/YY", () => {
    expect(formatCardExpiryInput("1230")).toBe("12/30");
    expect(formatCardExpiryInput("12/30")).toBe("12/30");
    expect(formatCardExpiryInput("12a3456")).toBe("12/34");
    expect(formatCardExpiryInput("")).toBe("");

    const view = emptyView();
    view.card.expMonth = "8";
    view.card.expYear = "2030";
    expect(readFieldValues(view, ItemKind.Card).expiry).toBe("08/30");
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

  it("round-trips identity contact and address fields", () => {
    const view = emptyView();
    setKind(view, ItemKind.Identity);
    applyFieldValues(view, ItemKind.Identity, {
      name: "家庭地址",
      firstName: "波",
      lastName: "谢",
      phone: "+86 138 0000 0000",
      email: "bossxie@example.com",
      address: "上海市徐汇区漕河泾开发路 100 号 8F",
      postalCode: "200233",
      company: "LocalPass",
    });

    expect(view.identity.phone).toBe("+86 138 0000 0000");
    expect(view.identity.email).toBe("bossxie@example.com");
    expect(view.identity.address1).toBe("上海市徐汇区漕河泾开发路 100 号 8F");
    expect(view.identity.postalCode).toBe("200233");
    expect(view.identity.company).toBe("LocalPass");
    expect(readFieldValues(view, ItemKind.Identity)).toMatchObject({
      phone: "+86 138 0000 0000",
      email: "bossxie@example.com",
      address: "上海市徐汇区漕河泾开发路 100 号 8F",
      postalCode: "200233",
      company: "LocalPass",
    });
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

  it("keeps imported URIs that the two-slot form does not show", () => {
    const view = emptyView();
    setKind(view, ItemKind.Login);
    applyFieldValues(view, ItemKind.Login, {
      name: "GitHub",
      uri: "https://github.com",
      uri2: "https://gist.github.com",
    });
    const extra = new LoginUriView();
    extra.uri = "http://localhost:4180";
    view.login.uris.push(extra);

    applyFieldValues(view, ItemKind.Login, {
      name: "GitHub",
      username: "bossxie",
      uri: "https://github.com",
      uri2: "https://gist.github.com",
    });

    expect(view.login.uris.map((uri) => uri.uri)).toEqual([
      "https://github.com",
      "https://gist.github.com",
      "http://localhost:4180",
    ]);
  });

  it("preserves URI match settings when saving a different field or editing the URI", () => {
    const view = emptyView();
    applyFieldValues(view, ItemKind.Login, {
      uri: "https://one.example.test",
      uri2: "https://two.example.test",
    });
    view.login.uris[0].match = UriMatchStrategy.Exact;
    view.login.uris[1].match = UriMatchStrategy.Host;
    applyFieldValues(view, ItemKind.Login, {
      ...readFieldValues(view, ItemKind.Login),
      name: "updated",
      uri2: "https://new.example.test",
    });
    expect(view.login.uris.map((uri) => uri.match)).toEqual([
      UriMatchStrategy.Exact,
      UriMatchStrategy.Host,
    ]);
  });

  it("can save a login imported with a null URI list", () => {
    const view = emptyView();
    Object.assign(view.login, { uris: null });
    applyFieldValues(view, ItemKind.Login, { name: "updated" });
    expect(view.login.uris).toEqual([]);
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

  it("round-trips optional fields across Server, Token, License, SSH Key, Card, Identity, and Note", () => {
    const server = emptyView();
    setKind(server, ItemKind.Server);
    applyFieldValues(server, ItemKind.Server, {
      name: "Prod Bastion",
      host: "10.0.2.14",
      port: "2222",
      protocol: "SSH",
      loginUser: "ops",
      password: "secret",
      linkedSshId: "ssh-1",
      sudo: "NOPASSWD",
      region: "ap-east-1",
    });
    expect(readFieldValues(server, ItemKind.Server)).toMatchObject({
      host: "10.0.2.14",
      port: "2222",
      protocol: "SSH",
      loginUser: "ops",
      linkedSshId: "ssh-1",
      sudo: "NOPASSWD",
      region: "ap-east-1",
    });

    const token = emptyView();
    setKind(token, ItemKind.Token);
    applyFieldValues(token, ItemKind.Token, {
      name: "Cloudflare R2",
      service: "R2",
      accessKeyId: "AKIA-SYNTH",
      token: "tok-123",
      scope: "Bucket.Write",
      expires: "2027-01-01",
      env: "Production",
      totp: "JBSWY3DP",
    });
    expect(readFieldValues(token, ItemKind.Token)).toMatchObject({
      accessKeyId: "AKIA-SYNTH",
      expires: "2027-01-01",
      env: "Production",
      totp: "JBSWY3DP",
    });

    const license = emptyView();
    setKind(license, ItemKind.License);
    applyFieldValues(license, ItemKind.License, {
      name: "JetBrains",
      software: "RustRover",
      edition: "Pro",
      serial: "XXXX-YYYY",
      licensedEmail: "alex@example.test",
      seats: "2",
      purchased: "2026-01-01",
      expires: "2027-06-01",
      orderId: "ORD-9001",
    });
    expect(readFieldValues(license, ItemKind.License)).toMatchObject({
      software: "RustRover",
      edition: "Pro",
      serial: "XXXX-YYYY",
      licensedEmail: "alex@example.test",
      seats: "2",
      purchased: "2026-01-01",
      expires: "2027-06-01",
      orderId: "ORD-9001",
    });

    const ssh = emptyView();
    setKind(ssh, ItemKind.SshKey);
    applyFieldValues(ssh, ItemKind.SshKey, {
      name: "id_ed25519",
      algorithm: "Ed25519 · 256-bit",
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
      publicKey: "ssh-ed25519 AAAA",
      fingerprint: "SHA256:abcd1234",
      passphrase: "pass",
      hosts: "git.example.test",
    });
    expect(readFieldValues(ssh, ItemKind.SshKey)).toMatchObject({
      algorithm: "Ed25519 · 256-bit",
      fingerprint: "SHA256:abcd1234",
      passphrase: "pass",
      hosts: "git.example.test",
    });

    // Clearing optional custom fields removes them from view.fields
    applyFieldValues(ssh, ItemKind.SshKey, {
      name: "id_ed25519",
      algorithm: "",
      privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
      publicKey: "ssh-ed25519 AAAA",
      fingerprint: "SHA256:abcd1234",
      passphrase: "",
      hosts: "",
    });
    expect(readFieldValues(ssh, ItemKind.SshKey)).toMatchObject({
      algorithm: "",
      passphrase: "",
      hosts: "",
    });
    expect(ssh.fields.map((field) => field.name)).toEqual(["lp:kind"]);

    const card = emptyView();
    setKind(card, ItemKind.Card);
    applyFieldValues(card, ItemKind.Card, {
      name: "Corp Card",
      brand: "Visa",
      cardholder: "Alex",
      number: "4111 1111 1111 1111",
      expiry: "09/29",
      code: "321",
      pin: "4567",
      billingZip: "94107",
    });
    expect(readFieldValues(card, ItemKind.Card)).toMatchObject({
      brand: "Visa",
      pin: "4567",
      billingZip: "94107",
    });

    const identity = emptyView();
    setKind(identity, ItemKind.Identity);
    applyFieldValues(identity, ItemKind.Identity, {
      name: "ID",
      firstName: "Alex",
      lastName: "Chen",
      idType: "Passport",
    });
    expect(readFieldValues(identity, ItemKind.Identity)).toMatchObject({
      idType: "Passport",
    });

    const note = emptyView();
    setKind(note, ItemKind.Note);
    applyFieldValues(note, ItemKind.Note, {
      name: "Recovery Codes",
      category: "Recovery Keys",
      notes: "1234-5678",
    });
    expect(readFieldValues(note, ItemKind.Note)).toMatchObject({
      category: "Recovery Keys",
    });
  });
});
