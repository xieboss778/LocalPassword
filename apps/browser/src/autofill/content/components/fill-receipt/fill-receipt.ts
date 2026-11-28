import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { InlineMenuFillReceipt } from "../../../types/inline-menu-fill-receipt";
import { EventSecurity } from "../../../utils/event-security";
import { Check } from "../icons";
import { inlineMenuColors, inlineMenuFocusRing } from "../inline-menu/menu-styles";

export type AutofillFillReceiptProps = {
  theme: Theme;
  receipt: InlineMenuFillReceipt;
  undone: boolean;
  onUndo: (event: Event) => void;
  onRefill: (event: Event) => void;
};

/**
 * Bottom-right receipt shown after an inline-menu card or identity fill. It reports the fill in
 * page-safe terms only and offers one-click undo (or refill after an undo).
 */
export function AutofillFillReceipt({
  theme,
  receipt,
  undone,
  onUndo,
  onRefill,
}: AutofillFillReceiptProps) {
  const { title, detail } = receiptText(receipt, undone);

  const handleAction = (event: Event) => {
    if (!EventSecurity.isEventTrusted(event)) {
      return;
    }
    if (undone) {
      onRefill(event);
      return;
    }
    onUndo(event);
  };

  return html`
    <div
      class=${receiptStyles(theme)}
      role="status"
      aria-label=${chrome.i18n.getMessage("autofillFillReceiptAria")}
      data-testid="autofill-fill-receipt"
    >
      <span class=${receiptIconStyles(theme, undone)} aria-hidden="true">
        ${undone ? UndoMark() : Check({ theme, color: theme === "dark" ? "#0b1220" : "#ffffff" })}
      </span>
      <span class=${receiptMainStyles(theme)}>
        <b>${title}</b>
        <span>${detail}</span>
      </span>
      <button
        type="button"
        class=${receiptActionStyles(theme)}
        data-testid="autofill-fill-receipt-action"
        @click=${handleAction}
      >
        ${
          undone
            ? chrome.i18n.getMessage("autofillFillReceiptRefill")
            : chrome.i18n.getMessage("autofillFillReceiptUndo")
        }
      </button>
    </div>
  `;
}

function receiptText(receipt: InlineMenuFillReceipt, undone: boolean) {
  if (undone) {
    return {
      title: chrome.i18n.getMessage("autofillFillReceiptUndoneTitle"),
      detail: chrome.i18n.getMessage("autofillFillReceiptUndoneDetail"),
    };
  }

  if (receipt.kind === "card") {
    return {
      title: receipt.last4
        ? chrome.i18n.getMessage("autofillFillReceiptCardTitle", [receipt.last4])
        : chrome.i18n.getMessage("autofillFillReceiptCardTitleNoLast4"),
      detail: chrome.i18n.getMessage("autofillFillReceiptCardDetail"),
    };
  }

  if (receipt.kind === "identity") {
    return {
      title: chrome.i18n.getMessage("autofillFillReceiptIdentityTitle"),
      detail: chrome.i18n.getMessage("autofillFillReceiptIdentityDetail"),
    };
  }

  return {
    title: chrome.i18n.getMessage("autofillFillReceiptLoginTitle", [receipt.title ?? ""]),
    detail: chrome.i18n.getMessage("autofillFillReceiptLoginDetail"),
  };
}

function UndoMark() {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 2 3 5.5 7 9V6.5c2.5 0 4.5 2 4.5 4.5S9.5 15.5 7 15.5 2.5 13.5 2.5 11H.5c0 3.6 2.9 6.5 6.5 6.5s6.5-2.9 6.5-6.5-2.9-6.5-6.5-6.5V2Z"
      />
    </svg>
  `;
}

const receiptStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 9px;
    width: 320px;
    box-sizing: border-box;
    padding: 9px 11px;
    border: 1px solid ${colors.border};
    border-radius: 9px;
    background: ${colors.surface};
    box-shadow: ${colors.shadow};
    color: ${colors.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
  `;
};

const receiptIconStyles = (theme: Theme, undone: boolean) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: ${undone ? colors.orangeStrong : colors.successStrong};
    color: ${theme === "dark" ? "#0b1220" : "#ffffff"};

    svg {
      width: 12px;
      height: 12px;
    }
  `;
};

const receiptMainStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
    min-width: 0;

    b {
      overflow: hidden;
      color: ${colors.text};
      font-size: 11px;
      font-weight: 600;
      line-height: 15px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      overflow: hidden;
      color: ${colors.textSubtle};
      font-size: 9.5px;
      line-height: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
};

const receiptActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    padding: 4px 9px;
    border: 1px solid ${colors.border};
    border-radius: 6px;
    background: ${colors.surface};
    color: ${colors.text};
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
    cursor: pointer;

    :hover {
      background: ${colors.surfaceAlt};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
