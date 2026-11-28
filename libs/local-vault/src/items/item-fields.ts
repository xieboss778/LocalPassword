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
  | "sshFingerprint"
  | "cardholder"
  | "cardBrand"
  | "cardNumber"
  | "cardCode"
  | "cardExpiry"
  | "identityFirst"
  | "identityLast"
  | "identityIdNumber"
  | "identityPhone"
  | "identityEmail"
  | "identityAddress"
  | "identityPostalCode"
  | "identityCompany"
  | { custom: string };

/** 下拉预设项；`value` 即写入条目的原文。 */
export interface FieldOption {
  readonly value: string;
  readonly label: string;
}

export interface FieldSpec {
  readonly id: string;
  readonly labelKey: string;
  readonly target: FieldTarget;
  readonly password?: boolean;
  readonly multiline?: boolean;
  readonly mono?: boolean;
  /** 可选字段默认收起成「+ 字段」按钮，有值时才展开；见 AGY 动态字段方案。 */
  readonly optional?: boolean;
  /** 该字段关联库里的 SSH 私钥条目（由界面动态填充下拉选项）。 */
  readonly sshKeyRef?: boolean;
  /** 表单里的分组，见 {@link FIELD_SECTIONS}；缺省归到「项目」。 */
  readonly section?: string;
  /** 字段下方的说明文案。 */
  readonly hintKey?: string;
  /** 是否在字段尾部提供「生成」按钮。 */
  readonly generate?: boolean;
  /** 有限预设；出现后表单渲染为下拉，选中「自定义」可继续输入。 */
  readonly options?: readonly FieldOption[];
  readonly allowCustom?: boolean;
  readonly maxLength?: number;
  readonly inputMode?: string;
}

const ENVIRONMENT_OPTIONS: readonly FieldOption[] = Object.freeze([
  { value: "Production", label: "Production" },
  { value: "Staging", label: "Staging" },
  { value: "Development", label: "Development" },
  { value: "Testing", label: "Testing" },
  { value: "Preview", label: "Preview" },
]);

const SSH_ALGORITHM_OPTIONS: readonly FieldOption[] = Object.freeze([
  { value: "Ed25519 · 256-bit", label: "Ed25519 · 256-bit" },
  { value: "ECDSA P-256", label: "ECDSA P-256" },
  { value: "RSA · 4096-bit", label: "RSA · 4096-bit" },
  { value: "RSA · 2048-bit", label: "RSA · 2048-bit" },
]);

const LICENSE_EDITION_OPTIONS: readonly FieldOption[] = Object.freeze([
  { value: "Personal", label: "Personal" },
  { value: "Pro", label: "Pro" },
  { value: "Team Pro", label: "Team Pro" },
  { value: "Enterprise", label: "Enterprise" },
  { value: "Lifetime", label: "Lifetime" },
]);

const CARD_BRAND_OPTIONS: readonly FieldOption[] = Object.freeze([
  { value: "Visa", label: "Visa" },
  { value: "Mastercard", label: "Mastercard" },
  { value: "UnionPay", label: "UnionPay / 银联" },
  { value: "American Express", label: "American Express" },
  { value: "JCB", label: "JCB" },
  { value: "Discover", label: "Discover" },
]);

const IDENTITY_ID_TYPE_OPTIONS: readonly FieldOption[] = Object.freeze([
  { value: "National ID", label: "居民身份证 / National ID" },
  { value: "Passport", label: "护照 / Passport" },
  { value: "HK/Macau Pass", label: "港澳居民来往内地通行证" },
  { value: "Taiwan Pass", label: "台湾居民来往大陆通行证" },
  { value: "Driver's License", label: "驾驶证 / Driver's License" },
]);

const SERVER_PROTOCOL_OPTIONS: readonly FieldOption[] = Object.freeze([
  { value: "SSH", label: "SSH" },
  { value: "SSH / WireGuard", label: "SSH / WireGuard" },
  { value: "HTTPS / WebConsole", label: "HTTPS / WebConsole" },
  { value: "SFTP", label: "SFTP" },
  { value: "RDP", label: "RDP" },
  { value: "VNC", label: "VNC" },
]);

const NOTE_CATEGORY_OPTIONS: readonly FieldOption[] = Object.freeze([
  { value: "Home Network & Emergency", label: "家庭网络与应急" },
  { value: "Recovery Keys", label: "恢复密钥 / 助记备份" },
  { value: "Software & Finance", label: "软件与财务备忘" },
  { value: "Work Notes", label: "工作规范备忘" },
]);

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
      mono: true,
      section: "login",
      hintKey: "authenticatorKeyHint",
    },
    { id: "uri", labelKey: "uri", target: "loginUri", mono: true, section: "uri" },
    {
      id: "uri2",
      labelKey: "uri2",
      target: "loginUri2",
      mono: true,
      optional: true,
      section: "uri",
    },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      optional: true,
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
      id: "accessKeyId",
      labelKey: "itemKindTokenAccessKeyId",
      target: { custom: "accessKeyId" },
      mono: true,
      section: "token",
    },
    {
      id: "token",
      labelKey: "itemKindToken",
      target: "loginPassword",
      password: true,
      mono: true,
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
      id: "expires",
      labelKey: "expires",
      target: { custom: "expires" },
      mono: true,
      optional: true,
      section: "token",
    },
    {
      id: "env",
      labelKey: "itemKindTokenEnv",
      target: { custom: "env" },
      optional: true,
      section: "token",
      options: ENVIRONMENT_OPTIONS,
      allowCustom: true,
    },
    {
      id: "totp",
      labelKey: "authenticatorKey",
      target: "loginTotp",
      mono: true,
      optional: true,
      section: "token",
      hintKey: "authenticatorKeyHint",
    },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      optional: true,
      section: "token",
    },
  ],
  [ItemKind.SshKey]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "algorithm",
      labelKey: "itemKindSshKeyAlgorithm",
      target: { custom: "algorithm" },
      section: "ssh",
      options: SSH_ALGORITHM_OPTIONS,
      allowCustom: true,
    },
    {
      id: "fingerprint",
      labelKey: "itemKindSshKeyFingerprint",
      target: "sshFingerprint",
      mono: true,
      section: "ssh",
    },
    {
      id: "publicKey",
      labelKey: "itemKindSshKeyPublic",
      target: "sshPublicKey",
      multiline: true,
      mono: true,
      section: "ssh",
    },
    {
      id: "privateKey",
      labelKey: "itemKindSshKey",
      target: "sshPrivateKey",
      password: true,
      multiline: true,
      mono: true,
      section: "ssh",
    },
    {
      id: "passphrase",
      labelKey: "itemKindSshKeyPassphrase",
      target: { custom: "passphrase" },
      password: true,
      generate: true,
      optional: true,
      section: "ssh",
    },
    {
      id: "hosts",
      labelKey: "itemKindSshKeyHosts",
      target: { custom: "hosts" },
      optional: true,
      section: "ssh",
    },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      optional: true,
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
      id: "edition",
      labelKey: "itemKindLicenseEdition",
      target: { custom: "edition" },
      section: "license",
      options: LICENSE_EDITION_OPTIONS,
      allowCustom: true,
    },
    {
      id: "serial",
      labelKey: "itemKindLicense",
      target: "loginPassword",
      password: true,
      mono: true,
      section: "license",
    },
    {
      id: "licensedEmail",
      labelKey: "itemKindLicenseEmail",
      target: { custom: "licensedEmail" },
      section: "license",
    },
    {
      id: "seats",
      labelKey: "itemKindLicenseSeats",
      target: { custom: "seats" },
      optional: true,
      section: "license",
    },
    {
      id: "purchased",
      labelKey: "purchaseDate",
      target: { custom: "purchased" },
      mono: true,
      optional: true,
      section: "license",
    },
    {
      id: "expires",
      labelKey: "expires",
      target: { custom: "expires" },
      mono: true,
      optional: true,
      section: "license",
    },
    {
      id: "orderId",
      labelKey: "itemKindLicenseOrderId",
      target: { custom: "orderId" },
      mono: true,
      optional: true,
      section: "license",
    },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      optional: true,
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
      id: "brand",
      labelKey: "brand",
      target: "cardBrand",
      section: "card",
      options: CARD_BRAND_OPTIONS,
      allowCustom: true,
    },
    {
      id: "number",
      labelKey: "number",
      target: "cardNumber",
      password: true,
      mono: true,
      section: "card",
    },
    {
      id: "expiry",
      labelKey: "expiration",
      target: "cardExpiry",
      mono: true,
      section: "card",
      maxLength: 5,
      inputMode: "numeric",
    },
    {
      id: "code",
      labelKey: "securityCode",
      target: "cardCode",
      password: true,
      mono: true,
      section: "card",
    },
    {
      id: "pin",
      labelKey: "itemKindCardPin",
      target: { custom: "pin" },
      password: true,
      mono: true,
      optional: true,
      section: "card",
    },
    {
      id: "billingZip",
      labelKey: "itemKindCardBillingZip",
      target: { custom: "billingZip" },
      mono: true,
      optional: true,
      section: "card",
    },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      optional: true,
      section: "card",
    },
  ],
  [ItemKind.Identity]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    { id: "lastName", labelKey: "lastName", target: "identityLast", section: "identity" },
    { id: "firstName", labelKey: "firstName", target: "identityFirst", section: "identity" },
    {
      id: "idType",
      labelKey: "itemKindIdentityIdType",
      target: { custom: "idType" },
      section: "identity",
      options: IDENTITY_ID_TYPE_OPTIONS,
      allowCustom: true,
    },
    {
      id: "idNumber",
      labelKey: "identityNumber",
      target: "identityIdNumber",
      password: true,
      mono: true,
      section: "identity",
    },
    { id: "phone", labelKey: "phone", target: "identityPhone", mono: true, section: "identity" },
    { id: "email", labelKey: "email", target: "identityEmail", section: "identity" },
    {
      id: "address",
      labelKey: "address",
      target: "identityAddress",
      multiline: true,
      optional: true,
      section: "identity",
    },
    {
      id: "postalCode",
      labelKey: "zipPostalCode",
      target: "identityPostalCode",
      mono: true,
      optional: true,
      section: "identity",
    },
    {
      id: "company",
      labelKey: "company",
      target: "identityCompany",
      optional: true,
      section: "identity",
    },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      optional: true,
      section: "identity",
    },
  ],
  [ItemKind.Server]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "host",
      labelKey: "itemKindServerHost",
      target: "loginUsername",
      mono: true,
      section: "server",
    },
    {
      id: "port",
      labelKey: "itemKindServerPort",
      target: { custom: "port" },
      mono: true,
      section: "server",
    },
    {
      id: "protocol",
      labelKey: "itemKindServerProtocol",
      target: { custom: "protocol" },
      section: "server",
      options: SERVER_PROTOCOL_OPTIONS,
      allowCustom: true,
    },
    {
      id: "loginUser",
      labelKey: "itemKindServerLoginUser",
      target: { custom: "loginUser" },
      section: "server",
    },
    {
      id: "password",
      labelKey: "password",
      target: "loginPassword",
      password: true,
      generate: true,
      section: "server",
    },
    {
      id: "linkedSshId",
      labelKey: "itemKindServerLinkedSsh",
      target: { custom: "linkedSshId" },
      sshKeyRef: true,
      section: "server",
    },
    {
      id: "sudo",
      labelKey: "itemKindServerSudo",
      target: { custom: "sudo" },
      optional: true,
      section: "server",
    },
    {
      id: "region",
      labelKey: "itemKindServerRegion",
      target: { custom: "region" },
      mono: true,
      optional: true,
      section: "server",
    },
    {
      id: "notes",
      labelKey: "notes",
      target: "notes",
      multiline: true,
      optional: true,
      section: "server",
    },
  ],
  [ItemKind.Note]: [
    { id: "name", labelKey: "name", target: "name", section: "item" },
    {
      id: "category",
      labelKey: "itemKindNoteCategory",
      target: { custom: "category" },
      section: "note",
      options: NOTE_CATEGORY_OPTIONS,
      allowCustom: true,
    },
    { id: "notes", labelKey: "notes", target: "notes", multiline: true, section: "note" },
    {
      id: "recoveryHint",
      labelKey: "itemKindNoteRecoveryHint",
      target: { custom: "recoveryHint" },
      optional: true,
      section: "note",
    },
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
  if (kind === ItemKind.Login) {
    applyLoginUris(view, values);
  }

  for (const field of FIELDS[kind]) {
    // The two URI slots are written together above so URIs the form does not show survive.
    if (kind === ItemKind.Login && (field.target === "loginUri" || field.target === "loginUri2")) {
      continue;
    }
    writeField(view, field.target, values[field.id] ?? "");
  }
}

/**
 * Rewrites the two URI slots the form edits and keeps any additional URIs an import brought in.
 * Dropping them would silently widen or narrow where the login autofills.
 */
function applyLoginUris(view: CipherView, values: FieldValues): void {
  const current = view.login.uris ?? [];
  const extras = current.slice(2);
  view.login.uris = [
    values.uri ? uriView(values.uri, current[0]?.match) : undefined,
    values.uri2 ? uriView(values.uri2, current[1]?.match) : undefined,
    ...extras,
  ].filter((uri): uri is LoginUriView => !!uri);
}

export function readField(view: CipherView, target: FieldTarget): string {
  switch (target) {
    case "name":
      return view.name ?? "";
    case "notes":
      return view.notes ?? "";
    // Importers may leave a subtype view's collections null (for example a CSV login with no
    // URI). Reading a field is a display/search/dedupe concern and must not throw on that data.
    case "loginUsername":
      return view.login?.username ?? "";
    case "loginPassword":
      return view.login?.password ?? "";
    case "loginTotp":
      return view.login?.totp ?? "";
    case "loginUri":
      return view.login?.uris?.[0]?.uri ?? "";
    case "loginUri2":
      return view.login?.uris?.[1]?.uri ?? "";
    case "sshPrivateKey":
      return view.sshKey?.privateKey ?? "";
    case "sshPublicKey":
      return view.sshKey?.publicKey ?? "";
    case "sshFingerprint":
      return view.sshKey?.keyFingerprint ?? "";
    case "cardholder":
      return view.card?.cardholderName ?? "";
    case "cardBrand":
      return view.card?.brand ?? "";
    case "cardNumber":
      return view.card?.number ?? "";
    case "cardCode":
      return view.card?.code ?? "";
    case "cardExpiry":
      return formatCardExpiry(view.card?.expMonth, view.card?.expYear);
    case "identityFirst":
      return view.identity?.firstName ?? "";
    case "identityLast":
      return view.identity?.lastName ?? "";
    case "identityIdNumber":
      return view.identity?.passportNumber ?? view.identity?.licenseNumber ?? "";
    case "identityPhone":
      return view.identity?.phone ?? "";
    case "identityEmail":
      return view.identity?.email ?? "";
    case "identityAddress":
      return view.identity?.address1 ?? "";
    case "identityPostalCode":
      return view.identity?.postalCode ?? "";
    case "identityCompany":
      return view.identity?.company ?? "";
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
    case "sshFingerprint":
      view.sshKey.keyFingerprint = value;
      return;
    case "cardholder":
      view.card.cardholderName = value;
      return;
    case "cardBrand":
      view.card.brand = value;
      return;
    case "cardNumber":
      view.card.number = value;
      return;
    case "cardCode":
      view.card.code = value;
      return;
    case "cardExpiry": {
      const digits = value.replace(/\D/g, "").slice(0, 4);
      view.card.expMonth = digits.slice(0, 2);
      const shortYear = digits.slice(2);
      // 原生存 4 位年份；界面按 AGY 只编辑 MM/YY，因此短年份补 20。
      view.card.expYear = shortYear.length === 2 ? `20${shortYear}` : shortYear;
      return;
    }
    case "identityFirst":
      view.identity.firstName = value;
      return;
    case "identityLast":
      view.identity.lastName = value;
      return;
    case "identityIdNumber":
      view.identity.passportNumber = value;
      return;
    case "identityPhone":
      view.identity.phone = value;
      return;
    case "identityEmail":
      view.identity.email = value;
      return;
    case "identityAddress":
      view.identity.address1 = value;
      return;
    case "identityPostalCode":
      view.identity.postalCode = value;
      return;
    case "identityCompany":
      view.identity.company = value;
      return;
    default:
      writeCustomField(view, target.custom, value);
  }
}

function uriView(value: string, match?: LoginUriView["match"]): LoginUriView {
  const uri = new LoginUriView();
  uri.uri = value;
  uri.match = match;
  return uri;
}

/** 把分开存储的月和年拼成 AGY 的 `MM/YY` 单框显示。 */
export function formatCardExpiry(
  month: string | null | undefined,
  year: string | null | undefined,
): string {
  const monthDigits = (month ?? "").replace(/\D/g, "");
  if (!monthDigits) {
    return "";
  }
  const mm = monthDigits.padStart(2, "0").slice(-2);
  const yearDigits = (year ?? "").replace(/\D/g, "");
  return yearDigits ? `${mm}/${yearDigits.slice(-2)}` : mm;
}

/** 输入时只保留数字并在第 2 位后补 `/`，避免出现 `123/4` 这类中间态。 */
export function formatCardExpiryInput(
  value: string,
  options?: { readonly autoSlash?: boolean },
): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  if (digits.length === 2 && options?.autoSlash) {
    return `${digits}/`;
  }
  return digits;
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
  return view.fields?.find((field) => field.name === name);
}

function writeCustomField(view: CipherView, name: string, value: string): void {
  const existing = customField(view, name);
  if (!value) {
    if (existing) {
      view.fields = view.fields.filter((field) => field !== existing);
    }
    return;
  }
  if (existing) {
    existing.value = value;
    return;
  }

  const created = new FieldView();
  created.name = name;
  created.value = value;
  created.type = FieldType.Text;
  view.fields = [...view.fields, created];
}
