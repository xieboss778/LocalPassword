import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { Key, Plus, Search } from "../icons";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuEmptyStateI18n = {
  title: string;
  description: string;
  showAll: string;
};

export type InlineMenuEmptyStateProps = {
  theme: Theme;
  i18n: InlineMenuEmptyStateI18n;
  totalAccounts: number;
  showClear: boolean;
  onClear: (event: Event) => void;
  newItem?: {
    text: string;
    aria: string;
    onAction: (event: Event) => void;
  };
  generatePassword?: {
    text: string;
    aria: string;
    onAction: (event: Event) => void;
  };
};

export function InlineMenuEmptyState({
  theme,
  i18n,
  totalAccounts,
  showClear,
  onClear,
  newItem,
  generatePassword,
}: InlineMenuEmptyStateProps) {
  const colors = inlineMenuColors(theme);
  const handleClear = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onClear(event);
    }
  };

  const handleNewItem = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      newItem?.onAction(event);
    }
  };

  const handleGenerate = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      generatePassword?.onAction(event);
    }
  };

  // Filtered empty state prioritizes clearing the filter ("Show all N"); true no-match prioritizes creating an item.
  const newItemIsPrimary = !showClear;

  return html`
    <div class=${emptyStyles(theme)} data-testid="inline-menu-empty-state">
      <span class=${emptyIconStyles(theme)} aria-hidden="true">${Search({ theme })}</span>
      <b>${i18n.title}</b>
      <span>${i18n.description}</span>
      ${
        showClear || newItem || generatePassword
          ? html`<div class=${emptyActionsStyles}>
              ${
                showClear
                  ? html`<button
                      type="button"
                      tabindex="-1"
                      data-inline-menu-clear
                      data-inline-menu-focusable
                      class=${`${emptyActionStyles(theme)} is-primary`}
                      @click=${handleClear}
                    >
                      ${i18n.showAll.replace("{count}", `${totalAccounts}`)}
                    </button>`
                  : nothing
              }
              ${
                newItem
                  ? html`<button
                      type="button"
                      tabindex="-1"
                      data-inline-new-item
                      data-inline-menu-focusable
                      data-testid="inline-menu-empty-new-item-button"
                      class=${`${emptyActionStyles(theme)}${newItemIsPrimary ? " is-primary" : ""}`}
                      aria-label=${newItem.aria}
                      @click=${handleNewItem}
                    >
                      <span class=${emptyActionIconStyles} aria-hidden="true"
                        >${Plus({ theme, color: newItemIsPrimary ? "#fff" : colors.brand })}</span
                      >
                      ${newItem.text}
                    </button>`
                  : nothing
              }
              ${
                generatePassword
                  ? html`<button
                      type="button"
                      tabindex="-1"
                      data-inline-empty-generate
                      data-inline-menu-focusable
                      class=${emptyActionStyles(theme)}
                      aria-label=${generatePassword.aria}
                      @click=${handleGenerate}
                    >
                      <span class=${emptyActionIconStyles} aria-hidden="true"
                        >${Key({ theme, color: colors.brand })}</span
                      >
                      ${generatePassword.text}
                    </button>`
                  : nothing
              }
            </div>`
          : nothing
      }
    </div>
  `;
}

const emptyStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 14px 12px;
    text-align: center;

    b {
      color: ${colors.text};
      font-size: 11.5px;
      font-weight: 600;
      line-height: 15px;
    }

    > span:not(:first-child) {
      max-width: 280px;
      color: ${colors.textSubtle};
      font-size: 10px;
      line-height: 14px;
    }
  `;
};

const emptyActionsStyles = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
`;

const emptyIconStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    margin-bottom: 1px;
    color: ${colors.textSubtle};

    svg {
      width: 18px;
      height: 18px;
    }
  `;
};

const emptyActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${colors.brand};
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
    cursor: pointer;

    :hover {
      background: ${colors.brandSoft};
    }

    &.is-primary {
      background: ${colors.brandFill};
      color: #fff;

      :hover {
        background: ${colors.brandFillStrong};
      }
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const emptyActionIconStyles = css`
  display: inline-flex;

  svg {
    width: 10px;
    height: 10px;
  }
`;
