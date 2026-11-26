import { LocalPassIcon, IconTileVariant } from "@localpass/components";
import { ItemKind } from "@localpass/local-vault";

export interface ItemKindUi {
  readonly icon: LocalPassIcon;
  readonly variant: IconTileVariant;
  readonly labelKey: string;
  readonly blurbKey: string;
}

/** 八种本地条目在界面上的唯一映射：图标、色彩、名称与一句话说明。 */
export const ITEM_KIND_UI: Readonly<Record<ItemKind, ItemKindUi>> = Object.freeze({
  [ItemKind.Login]: {
    icon: "bwi-globe",
    variant: "brand",
    labelKey: "itemKindLogin",
    blurbKey: "itemKindLoginBlurb",
  },
  [ItemKind.Token]: {
    icon: "bwi-key",
    variant: "orange",
    labelKey: "itemKindToken",
    blurbKey: "itemKindTokenBlurb",
  },
  [ItemKind.SshKey]: {
    icon: "bwi-terminal",
    variant: "purple",
    labelKey: "itemKindSshKey",
    blurbKey: "itemKindSshKeyBlurb",
  },
  [ItemKind.License]: {
    icon: "bwi-receipt",
    variant: "green",
    labelKey: "itemKindLicense",
    blurbKey: "itemKindLicenseBlurb",
  },
  [ItemKind.Card]: {
    icon: "bwi-credit-card",
    variant: "orange",
    labelKey: "itemKindCard",
    blurbKey: "itemKindCardBlurb",
  },
  [ItemKind.Identity]: {
    icon: "bwi-id-card",
    variant: "red",
    labelKey: "itemKindIdentity",
    blurbKey: "itemKindIdentityBlurb",
  },
  [ItemKind.Server]: {
    icon: "bwi-desktop",
    variant: "teal",
    labelKey: "itemKindServer",
    blurbKey: "itemKindServerBlurb",
  },
  [ItemKind.Note]: {
    icon: "bwi-note",
    variant: "gray",
    labelKey: "itemKindNote",
    blurbKey: "itemKindNoteBlurb",
  },
});

/** 新建 / 编辑时展示顺序，与 Bitwarden 的新建面板一致。 */
export const ITEM_KIND_ORDER: readonly ItemKind[] = Object.freeze([
  ItemKind.Login,
  ItemKind.Token,
  ItemKind.SshKey,
  ItemKind.License,
  ItemKind.Card,
  ItemKind.Identity,
  ItemKind.Server,
  ItemKind.Note,
]);

export function kindLabelKey(kind: ItemKind): string {
  return ITEM_KIND_UI[kind].labelKey;
}
