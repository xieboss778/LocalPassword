import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";

import {
  defaultKindOf,
  isItemKind,
  isSecretCarrier,
  ItemKind,
  KIND_FIELD,
  kindOf,
  nativeTypeOf,
  setKind,
  withoutKindField,
} from "./item-kind";

function cipherWith(type: CipherType, fields: FieldView[] = []): CipherView {
  const cipher = new CipherView();
  cipher.type = type;
  cipher.fields = fields;
  return cipher;
}

function kindField(value: string): FieldView {
  const field = new FieldView();
  field.name = KIND_FIELD;
  field.value = value;
  field.type = FieldType.Text;
  return field;
}

describe("item kinds", () => {
  it("maps every kind to a native cipher type", () => {
    expect(nativeTypeOf(ItemKind.Login)).toBe(CipherType.Login);
    expect(nativeTypeOf(ItemKind.Token)).toBe(CipherType.Login);
    expect(nativeTypeOf(ItemKind.SshKey)).toBe(CipherType.SshKey);
    expect(nativeTypeOf(ItemKind.License)).toBe(CipherType.Login);
    expect(nativeTypeOf(ItemKind.Card)).toBe(CipherType.Card);
    expect(nativeTypeOf(ItemKind.Identity)).toBe(CipherType.Identity);
    expect(nativeTypeOf(ItemKind.Server)).toBe(CipherType.Login);
    expect(nativeTypeOf(ItemKind.Note)).toBe(CipherType.SecureNote);
  });

  it("falls back to the native type when there is no marker", () => {
    expect(defaultKindOf(CipherType.Login)).toBe(ItemKind.Login);
    expect(defaultKindOf(CipherType.SecureNote)).toBe(ItemKind.Note);
    expect(defaultKindOf(CipherType.SshKey)).toBe(ItemKind.SshKey);
    expect(defaultKindOf(CipherType.Passport)).toBe(ItemKind.Identity);
    expect(defaultKindOf(CipherType.BankAccount)).toBe(ItemKind.Card);
  });

  it("reads a marker planted on a login item", () => {
    const cipher = cipherWith(CipherType.Login, [kindField(ItemKind.Token)]);

    expect(kindOf(cipher)).toBe(ItemKind.Token);
  });

  it("ignores an unknown marker and uses the native type", () => {
    const cipher = cipherWith(CipherType.Login, [kindField("from-the-future")]);

    expect(kindOf(cipher)).toBe(ItemKind.Login);
  });

  it("ignores a marker that contradicts the native type", () => {
    // 外部工具把卡片改成登录，标记却还写着 card。
    const cipher = cipherWith(CipherType.Login, [kindField(ItemKind.Card)]);

    expect(kindOf(cipher)).toBe(ItemKind.Login);
  });

  it("writes the marker and retargets the native type", () => {
    const cipher = cipherWith(CipherType.Login);

    setKind(cipher, ItemKind.SshKey);

    expect(cipher.type).toBe(CipherType.SshKey);
    expect(kindOf(cipher)).toBe(ItemKind.SshKey);
  });

  it("updates an existing marker instead of adding a second one", () => {
    const cipher = cipherWith(CipherType.Login);

    setKind(cipher, ItemKind.Server);
    setKind(cipher, ItemKind.Token);

    const markers = cipher.fields.filter((field) => field.name === KIND_FIELD);
    expect(markers).toHaveLength(1);
    expect(markers[0].value).toBe(ItemKind.Token);
  });

  it("keeps unrelated custom fields untouched", () => {
    const other = new FieldView();
    other.name = "备用邮箱";
    other.value = "backup@example.com";
    const cipher = cipherWith(CipherType.Login, [other]);

    setKind(cipher, ItemKind.Token);

    expect(cipher.fields).toHaveLength(2);
    expect(withoutKindField(cipher.fields)).toEqual([other]);
  });

  it("treats the borrowed password slot as a secret", () => {
    expect(isSecretCarrier(ItemKind.Token)).toBe(true);
    expect(isSecretCarrier(ItemKind.License)).toBe(true);
    expect(isSecretCarrier(ItemKind.Server)).toBe(true);
    expect(isSecretCarrier(ItemKind.SshKey)).toBe(false);
    expect(isSecretCarrier(ItemKind.Login)).toBe(false);
  });

  it("validates markers", () => {
    expect(isItemKind("token")).toBe(true);
    expect(isItemKind("TOKEN")).toBe(false);
    expect(isItemKind(3)).toBe(false);
  });
});
