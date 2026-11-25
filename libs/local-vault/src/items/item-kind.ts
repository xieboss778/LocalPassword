import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { FieldType } from "@localpass/common/vault/enums/field-type.enum";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { FieldView } from "@localpass/common/vault/models/view/field.view";

/**
 * 界面上的 8 类条目。存储层只有 4 类原生类型可用（登录 / 卡片 / 身份 / 笔记），
 * 其余类别用一个自定义字段（{@link KIND_FIELD}）标记；SSH 私钥有原生类型，直接用。
 *
 * 这一层是「原型 8 类」与「存储类型」之间唯一的翻译，见 docs/LocalPass-实现计划.md §2。
 */
export const ItemKind = Object.freeze({
  Login: "login",
  Token: "token",
  SshKey: "ssh-key",
  License: "license",
  Card: "card",
  Identity: "identity",
  Server: "server",
  Note: "note",
} as const);

export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];

/** 标记字段名。导出后就是普通自定义字段，导入能原样还原。 */
export const KIND_FIELD = "lp:kind";

const KIND_TO_NATIVE: Readonly<Record<ItemKind, CipherType>> = Object.freeze({
  [ItemKind.Login]: CipherType.Login,
  [ItemKind.Token]: CipherType.Login,
  [ItemKind.SshKey]: CipherType.SshKey,
  [ItemKind.License]: CipherType.Login,
  [ItemKind.Card]: CipherType.Card,
  [ItemKind.Identity]: CipherType.Identity,
  [ItemKind.Server]: CipherType.Login,
  [ItemKind.Note]: CipherType.SecureNote,
});

const NATIVE_TO_DEFAULT_KIND: Readonly<Record<CipherType, ItemKind>> = Object.freeze({
  [CipherType.Login]: ItemKind.Login,
  [CipherType.Card]: ItemKind.Card,
  [CipherType.Identity]: ItemKind.Identity,
  [CipherType.SecureNote]: ItemKind.Note,
  [CipherType.SshKey]: ItemKind.SshKey,
  [CipherType.BankAccount]: ItemKind.Card,
  [CipherType.DriversLicense]: ItemKind.Identity,
  [CipherType.Passport]: ItemKind.Identity,
});

const ALL_KINDS: readonly ItemKind[] = Object.freeze(Object.values(ItemKind));

/** 借用 Login 的密码槽存密钥的那几类——密码历史里要把它们排除掉。 */
const SECRET_CARRIER_KINDS: readonly ItemKind[] = Object.freeze([
  ItemKind.Token,
  ItemKind.License,
  ItemKind.Server,
]);

/** 这一类在存储里用哪个原生类型。 */
export function nativeTypeOf(kind: ItemKind): CipherType {
  return KIND_TO_NATIVE[kind] ?? CipherType.Login;
}

/** 没有标记时按原生类型猜一个；导入的老条目全靠它。 */
export function defaultKindOf(type: CipherType): ItemKind {
  return NATIVE_TO_DEFAULT_KIND[type] ?? ItemKind.Login;
}

/** 这一类是否借用了 Login 的密码槽（不该进密码历史）。 */
export function isSecretCarrier(kind: ItemKind): boolean {
  return SECRET_CARRIER_KINDS.includes(kind);
}

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && (ALL_KINDS as readonly string[]).includes(value);
}

/** 读条目类别；标记缺失、非法或与原生类型冲突时退回默认值。 */
export function kindOf(cipher: CipherView): ItemKind {
  const marker = findKindField(cipher)?.value;
  if (!isItemKind(marker)) {
    return defaultKindOf(cipher.type);
  }
  // 标记与原生类型不匹配说明数据被外部工具改过：按原生类型走，别让界面显示错的字段。
  return nativeTypeOf(marker) === cipher.type ? marker : defaultKindOf(cipher.type);
}

/** 写入类别标记并对齐原生类型。 */
export function setKind(cipher: CipherView, kind: ItemKind): void {
  cipher.type = nativeTypeOf(kind);

  const field = findKindField(cipher);
  if (field) {
    field.value = kind;
    return;
  }

  const created = new FieldView();
  created.name = KIND_FIELD;
  created.value = kind;
  created.type = FieldType.Text;
  cipher.fields = [...(cipher.fields ?? []), created];
}

/** 剥掉标记字段，给用户看的自定义字段列表用。 */
export function withoutKindField(fields: FieldView[] | null | undefined): FieldView[] {
  return (fields ?? []).filter((field) => field.name !== KIND_FIELD);
}

function findKindField(cipher: CipherView): FieldView | undefined {
  return (cipher.fields ?? []).find((field) => field.name === KIND_FIELD);
}
