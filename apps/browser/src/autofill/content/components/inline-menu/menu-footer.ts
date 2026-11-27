import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuFooterProps = {
  theme: Theme;
  hint: string;
  newItem?: {
    text: string;
    aria: string;
    icon: TemplateResult;
    handleAction: (event: Event) => void;
  };
  note?: {
    text: string;
    icon: TemplateResult;
  };
};

export function InlineMenuFooter({ theme, hint, newItem, note }: InlineMenuFooterProps) {
  const handleNewItem = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      newItem?.handleAction(event);
    }
  };

  return html`
    <div class=${footerStyles(theme)}>
      ${
        newItem
          ? html`<button
              type="button"
              tabindex="-1"
              data-inline-new-item
              data-inline-menu-focusable
              data-testid="inline-menu-new-item-button"
              class=${newItemStyles(theme)}
              aria-label=${newItem.aria}
              @click=${handleNewItem}
            >
              <span class=${footerIconStyles} aria-hidden="true">${newItem.icon}</span>
              <span>${newItem.text}</span>
            </button>`
          : note
            ? html`<span class=${noteStyles(theme)}>
                <span class=${footerIconStyles} aria-hidden="true">${note.icon}</span>
                <span>${note.text}</span>
              </span>`
            : html`<span></span>`
      }
      <span class=${keysStyles(theme)}>${hint}</span>
    </div>
  `;
}

const footerStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 42px;
    padding: 0 14px;
    border-top: 1px solid ${colors.border};
    background: ${colors.surface};
  `;
};

const newItemStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    margin-left: -6px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${colors.brand};
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 600;
    line-height: 14px;
    cursor: pointer;

    :hover {
      background: ${colors.brandSoft};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const noteStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: ${colors.textSubtle};
    font-size: 9.5px;
    line-height: 13px;
  `;
};

const footerIconStyles = css`
  display: inline-flex;

  svg {
    width: 12px;
    height: 12px;
  }
`;

const keysStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    color: ${colors.textSubtle};
    font-size: 9px;
    line-height: 12px;
    white-space: nowrap;
  `;
};
