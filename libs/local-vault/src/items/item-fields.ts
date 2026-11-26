import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";
import { LoginUriView } from "@localpass/common/vault/models/view/login-uri.view";

import { ItemKind, KIND_FIELD, withoutKindField } from "./item-kind";

/** 一个字段落在原生条目的哪个位置；`custom` 表示写进自定义字段。 */
export type FieldTarget =
  | "name"
  | "notes"
  | "loginUsername"
  | "loginPassword"
  | "loginTotp"
  | "loginUri"
  | "loginUri2"
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
  /** 表单里的分组，见 {@link FIELD_SECTIONS}；缺省归到「项目」。 */
  readonly section?: string;
  /** 字段下方的说明文案。 */
  readonly hintKey?: string;
  /** 是否在字段尾部提供「生成」按钮。 */
  readonly generate?: boolean;
}

/** 分组 id → 分组标题的 i18n key。 */
export const FIELD_SECTIONS: Readonly<Record<string, string>> = Object.freeze({
  item: "itemInformation",
  login: "loginInformation",
  uri: "autofillOptions",
  options: "additionalOptions",
  token: "itemKindToken",
  ssh: "itemKindSshKey",
  license: "itemKindLicense",
  card: "itemKindCard",
  identity: "itemKindIdentity",
  server: "itemKindServer",
  note: "itemKindNote",
});

export interface FieldGroup {
  readonly key: string;
  readonly labelKey: string;
  readonly fields: readonly FieldSpec[];
}

/** 按 `section` 把字段切成表单分组，保持 FIELDS 里的声明顺序。 */
export function fieldGroups(kind: ItemKind): readonly FieldGroup[] {
  const grouped = new Map<string, FieldSpec[]>();
  for (const field of FIELDS[kind]) {
    const key = field.section ?? "item";
    const fields = grouped.get(key);
    if (fields) {
      fields.push(field);
    } else {
      grouped.set(key, [field]);
    }
  }

  return [...grouped].map(([key, fields]) => ({
    key,
    labelKey: FIELD_SECTIONS[key] ?? "itemInformation",
    fields,
  }));
}

/**
 * 8 类条目各自的字段清单——界面表单与读写映射的唯一来源。
 *
 * 借原生槽的那几类（令牌 / 许可证 / 服务器）把密钥放在 Login 的密码槽里，
 * 其余信息落到自定义字段，导出时仍然是标准字段。
 */
export const FIELDS: Readonly<Record<ItemKind, readonly FieldSpec[]>> = Object.freeze({
  [ItemKind.Login]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    { id: "username", labelKey: "username", target: "loginUsername", section: "login" },
    {
      id: "password",
      labelKey: "password",
      target: "loginPassword",
      password: true,
      section: "login",
      generate: true,
    },
    {
      id: "totp",
      labelKey: "authenticatorKey",
      target: "loginTotp",
      section: "login",
      hintKey: "authenticatorKeyHint",
    },
    { id: "uri", labelKey: "uri", target: "loginUri", section: "uri" },
    { id: "uri2", labelKey: "uri2", target: "loginUri2", section: "uri" },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      section: "options",
    },
  ],
  [ItemKind.Token]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "service",
      labelKey: "service",
      target: "loginUsername",
      section: "token",
    },
    {
      id: "token",
      labelKey: "itemKindToken",
      target: "loginPassword",
      password: true,
      section: "token",
      generate: true,
    },
    {
      id: "scope",
      labelKey: "itemKindTokenScope",
      target: { custom: "scope" },
      section: "token",
    },
    {
      id: "totp",
      labelKey: "authenticatorKey",
      target: "loginTotp",
      section: "token",
      hintKey: "authenticatorKeyHint",
    },
    { id: "expires", labelKey: "expires", target: { custom: "expires" }, section: "token" },
    {
      id: "env",
      labelKey: "itemKindTokenEnv",
      target: { custom: "env" },
      section: "token",
    },
  ],
  [ItemKind.SshKey]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "privateKey",
      labelKey: "itemKindSshKey",
      target: "sshPrivateKey",
      password: true,
      multiline: true,
      section: "ssh",
    },
    {
      id: "publicKey",
      labelKey: "itemKindSshKeyPublic",
      target: "sshPublicKey",
      multiline: true,
      section: "ssh",
    },
  ],
  [ItemKind.License]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "software",
      labelKey: "itemKindLicenseSoftware",
      target: "loginUsername",
      section: "license",
    },
    {
      id: "serial",
      labelKey: "itemKindLicense",
      target: "loginPassword",
      password: true,
      section: "license",
    },
    {
      id: "seats",
      labelKey: "itemKindLicenseSeats",
      target: { custom: "seats" },
      section: "license",
    },
    {
      id: "purchased",
      labelKey: "purchaseDate",
      target: { custom: "purchased" },
      section: "license",
    },
  ],
  [ItemKind.Card]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "cardholder",
      labelKey: "cardholderName",
      target: "cardholder",
      section: "card",
    },
    {
      id: "number",
      labelKey: "number",
      target: "cardNumber",
      password: true,
      section: "card",
    },
    { id: "expMonth", labelKey: "expirationMonth", target: "cardExpMonth", section: "card" },
    { id: "expYear", labelKey: "expirationYear", target: "cardExpYear", section: "card" },
    { id: "code", labelKey: "securityCode", target: "cardCode", password: true, section: "card" },
  ],
  [ItemKind.Identity]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    { id: "firstName", labelKey: "firstName", target: "identityFirst", section: "identity" },
    { id: "lastName", labelKey: "lastName", target: "identityLast", section: "identity" },
    {
      id: "idNumber",
      labelKey: "identityNumber",
      target: "identityIdNumber",
      password: true,
      section: "identity",
    },
  ],
  [ItemKind.Server]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "host",
      labelKey: "itemKindServer",
      target: "loginUsername",
      section: "server",
    },
    {
      id: "password",
      labelKey: "password",
      target: "loginPassword",
      password: true,
      section: "server",
    },
    {
      id: "protocol",
      labelKey: "itemKindServerProtocol",
      target: { custom: "protocol" },
      section: "server",
    },
    {
      id: "sudo",
      labelKey: "itemKindServerSudo",
      target: { custom: "sudo" },
      section: "server",
    },
  ],
  [ItemKind.Note]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    { id: "notes", labelKey: "notes", target: "notes", multiline: true, section: "note" },
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
    case "loginUri2":
      return view.login.uris[1]?.uri ?? "";
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
      view.login.uris = value ? [uriView(value)] : [];
      return;
    }
    case "loginUri2": {
      const first = view.login.uris[0];
      view.login.uris = value
        ? [first, uriView(value)].filter((uri): uri is LoginUriView => !!uri)
        : first
          ? [first]
          : [];
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

function uriView(value: string): LoginUriView {
  const uri = new LoginUriView();
  uri.uri = value;
  return uri;
}

/** 用户自己加的一个字段，不含类型自带的 `scope` / `env` 等槽位。 */
export interface CustomFieldValue {
  readonly name: string;
  readonly value: string;
  readonly hidden: boolean;
}

/** 读出可编辑的自定义字段：跳过类别标记、类型自带槽位与关联字段。 */
export function readCustomFields(view: CipherView, kind: ItemKind): CustomFieldValue[] {
  const reserved = specCustomNames(kind);
  return withoutKindField(view.fields)
    .filter((field) => field.type !== FieldType.Linked && !reserved.has(field.name ?? ""))
    .map((field) => ({
      name: field.name ?? "",
      value: field.value ?? "",
      hidden: field.type === FieldType.Hidden,
    }));
}

/**
 * 用表单里的自定义字段替换条目上的用户字段。
 *
 * 类别标记、类型自带槽位和关联字段原样保留；没有名字的行直接丢弃。
 */
export function applyCustomFields(
  view: CipherView,
  kind: ItemKind,
  fields: readonly CustomFieldValue[],
): void {
  const reserved = specCustomNames(kind);
  const preserved = (view.fields ?? []).filter(
    (field) =>
      field.name === KIND_FIELD ||
      field.type === FieldType.Linked ||
      reserved.has(field.name ?? ""),
  );

  const custom = fields
    .filter((field) => field.name.trim() !== "" && !reserved.has(field.name))
    .map((field) => {
      const created = new FieldView();
      created.name = field.name;
      created.value = field.value;
      created.type = field.hidden ? FieldType.Hidden : FieldType.Text;
      return created;
    });

  view.fields = [...preserved, ...custom];
}

function specCustomNames(kind: ItemKind): ReadonlySet<string> {
  return new Set(
    FIELDS[kind]
      .map((field) => (typeof field.target === "object" ? field.target.custom : ""))
      .filter((name) => name !== ""),
  );
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
