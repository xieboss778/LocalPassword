import { Theme } from "@localpass/common/platform/enums";

/**
 * The kinds of inline-menu fill that can leave a receipt on the page. A login fill raises a
 * receipt with undo in addition to the menu's collapsed chip; card and identity fills raise one
 * because their inline rows close after writing.
 */
export const InlineMenuFillReceiptKind = Object.freeze({
  Login: "login",
  Card: "card",
  Identity: "identity",
} as const);

export type InlineMenuFillReceiptKind =
  (typeof InlineMenuFillReceiptKind)[keyof typeof InlineMenuFillReceiptKind];

/**
 * Display-safe description of an inline-menu fill. The receipt is rendered in the page's top
 * document, so it carries only the data the receipt needs: never card numbers, identity fields, or
 * credentials. `last4` is the only card detail allowed.
 */
export type InlineMenuFillReceipt = {
  kind: InlineMenuFillReceiptKind;
  /** The item name for login receipts, shown as the page title in the prototype. */
  title?: string;
  /** The last four digits of a card, shown as "ending 4242". */
  last4?: string;
  theme: Theme;
};
