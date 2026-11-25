import { SendView } from "@localpass/common/tools/send/models/view/send.view";
import { CipherType } from "@localpass/common/vault/enums";
import { DIALOG_CIPHER_MENU_ITEMS } from "@localpass/common/vault/types/cipher-menu-items";
import { LocalPassIcon } from "@localpass/components";

/**
 * Icon for each cipher type, taken from the same menu items the new item dialog and add-item
 * grid use, so an Item Send shows the same icon as the item it wraps.
 */
const ITEM_SEND_ICONS = new Map<CipherType, LocalPassIcon>(
  DIALOG_CIPHER_MENU_ITEMS.map((item) => [item.type, item.icon as LocalPassIcon]),
);

/**
 * Returns the icon for the cipher an Item Send wraps. Returns `undefined if there is no
 * item or if it is of a type that has no add menu entry yet.
 */
export function getSendItemIcon(send: SendView): LocalPassIcon | undefined {
  if (send.data?.data == null) {
    return undefined;
  }
  return ITEM_SEND_ICONS.get(send.data.data.type);
}
