import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";
import { LoginUriView } from "@localpass/common/vault/models/view/login-uri.view";

import { ItemKind } from "./item-kind";

/** 一个字段落在原生条目的哪个位置；`custom` 表示写进自定义字段。 */
export type FieldTarget =
  | "name"
  | "notes"
  | "loginUsername"
  | "loginPassword"
  | "loginTotp"
  | "loginUri"
  | "sshPrivateKey"
  | "sshPublicKey"
  | "cardholder"
  | "cardNumber"
  | "cardCode"
  | "cardExpMonth"
  | "cardExpYear"
  | "identityFirst"
  | "identityLast"
  | "identityIdNumber"
  | { custom: string };

export interface FieldSpec {
  readonly id: string;
  readonly labelKey: string;
  readonly target: FieldTarget;
  readonly password?: boolean;
  readonly multiline?: boolean;
}

/**
 * 8 类条目各自的字段清单——界面表单与读写映射的唯一来源。
 *
 * 借原生槽的那几类（令牌 / 许可证 / 服务器）把密钥放在 Login 的密码槽里，
 * 其余信息落到自定义字段，导出时仍然是标准字段。
 */
export const FIELDS: Readonly<Record<ItemKind, readonly FieldSpec[]>> = Object.freeze({
  [ItemKind.Login]: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "username", labelKey: "username", target: "loginUsername" },
    { id: "password", labelKey: "password", target: "loginPassword", password: true },
    { id: "totp", labelKey: "authenticatorKey", target: "loginTotp" },
    { id: "uri", labelKey: "uri", target: "loginUri" },
  ],
  [ItemKind.Token]: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "service", labelKey: "username", target: "loginUsername" },
    { id: "token", labelKey: "itemKindToken", target: "loginPassword", password: true },
    { id: "scope", labelKey: "itemKindTokenScope", target: { custom: "scope" } },
    { id: "env", labelKey: "itemKindTokenEnv", target: { custom: "env" } },
  ],
  [ItemKind.SshKey]: [
    { id: "name", labelKey: "name", target: "name" },
    {
      id: "privateKey",
      labelKey: "itemKindSshKey",
      target: "sshPrivateKey",
      password: true,
      multiline: true,
    },
    { id: "publicKey", labelKey: "itemKindSshKeyPublic", target: "sshPublicKey", multiline: true },
  ],
  [ItemKind.License]: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "software", labelKey: "username", target: "loginUsername" },
    { id: "serial", labelKey: "itemKindLicense", target: "loginPassword", password: true },
    { id: "seats", labelKey: "itemKindLicenseSeats", target: { custom: "seats" } },
  ],
  [ItemKind.Card]: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "cardholder", labelKey: "cardholderName", target: "cardholder" },
    { id: "number", labelKey: "number", target: "cardNumber" },
    { id: "expMonth", labelKey: "expirationMonth", target: "cardExpMonth" },
    { id: "expYear", labelKey: "expirationYear", target: "cardExpYear" },
    { id: "code", labelKey: "securityCode", target: "cardCode", password: true },
  ],
  [ItemKind.Identity]: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "firstName", labelKey: "firstName", target: "identityFirst" },
    { id: "lastName", labelKey: "lastName", target: "identityLast" },
    { id: "idNumber", labelKey: "identityNumber", target: "identityIdNumber", password: true },
  ],
  [ItemKind.Server]: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "host", labelKey: "itemKindServer", target: "loginUsername" },
    { id: "password", labelKey: "password", target: "loginPassword", password: true },
    { id: "protocol", labelKey: "itemKindServerProtocol", target: { custom: "protocol" } },
    { id: "sudo", labelKey: "itemKindServerSudo", target: { custom: "sudo" } },
  ],
  [ItemKind.Note]: [
    { id: "name", labelKey: "name", target: "name" },
    { id: "notes", labelKey: "notes", target: "notes", multiline: true },
  ],
});

export type FieldValues = Record<string, string>;

/** 把条目读成表单值。 */
export function readFieldValues(view: CipherView, kind: ItemKind): FieldValues {
  const values: FieldValues = {};
  for (const field of FIELDS[kind]) {
    values[field.id] = readField(view, field.target);
  }
  return values;
}

/** 把表单值写回条目（不改类型；调用方负责 setKind）。 */
export function applyFieldValues(view: CipherView, kind: ItemKind, values: FieldValues): void {
  for (const field of FIELDS[kind]) {
    writeField(view, field.target, values[field.id] ?? "");
  }
}

export function readField(view: CipherView, target: FieldTarget): string {
  switch (target) {
    case "name":
      return view.name ?? "";
    case "notes":
      return view.notes ?? "";
    case "loginUsername":
      return view.login.username ?? "";
    case "loginPassword":
      return view.login.password ?? "";
    case "loginTotp":
      return view.login.totp ?? "";
    case "loginUri":
      return view.login.uris[0]?.uri ?? "";
    case "sshPrivateKey":
      return view.sshKey.privateKey ?? "";
    case "sshPublicKey":
      return view.sshKey.publicKey ?? "";
    case "cardholder":
      return view.card.cardholderName ?? "";
    case "cardNumber":
      return view.card.number ?? "";
    case "cardCode":
      return view.card.code ?? "";
    case "cardExpMonth":
      return view.card.expMonth ?? "";
    case "cardExpYear":
      return view.card.expYear ?? "";
    case "identityFirst":
      return view.identity.firstName ?? "";
    case "identityLast":
      return view.identity.lastName ?? "";
    case "identityIdNumber":
      return view.identity.passportNumber ?? view.identity.licenseNumber ?? "";
    default:
      return customField(view, target.custom)?.value ?? "";
  }
}

export function writeField(view: CipherView, target: FieldTarget, value: string): void {
  switch (target) {
    case "name":
      view.name = value;
      return;
    case "notes":
      view.notes = value;
      return;
    case "loginUsername":
      view.login.username = value;
      return;
    case "loginPassword":
      view.login.password = value;
      return;
    case "loginTotp":
      view.login.totp = value;
      return;
    case "loginUri": {
      const uri = new LoginUriView();
      uri.uri = value;
      view.login.uris = value ? [uri] : [];
      return;
    }
    case "sshPrivateKey":
      view.sshKey.privateKey = value;
      return;
    case "sshPublicKey":
      view.sshKey.publicKey = value;
      return;
    case "cardholder":
      view.card.cardholderName = value;
      return;
    case "cardNumber":
      view.card.number = value;
      return;
    case "cardCode":
      view.card.code = value;
      return;
    case "cardExpMonth":
      view.card.expMonth = value;
      return;
    case "cardExpYear":
      view.card.expYear = value;
      return;
    case "identityFirst":
      view.identity.firstName = value;
      return;
    case "identityLast":
      view.identity.lastName = value;
      return;
    case "identityIdNumber":
      view.identity.passportNumber = value;
      return;
    default:
      writeCustomField(view, target.custom, value);
  }
}

function customField(view: CipherView, name: string): FieldView | undefined {
  return view.fields.find((field) => field.name === name);
}

function writeCustomField(view: CipherView, name: string, value: string): void {
  const existing = customField(view, name);
  if (existing) {
    existing.value = value;
    return;
  }
  if (!value) {
    return;
  }

  const created = new FieldView();
  created.name = name;
  created.value = value;
  created.type = FieldType.Text;
  view.fields = [...view.fields, created];
}
