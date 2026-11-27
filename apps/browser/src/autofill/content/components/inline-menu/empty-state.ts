import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { Search } from "../icons";

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
};

export function InlineMenuEmptyState({
  theme,
  i18n,
  totalAccounts,
  showClear,
  onClear,
}: InlineMenuEmptyStateProps) {
  const handleClear = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onClear(event);
    }
  };

  return html`
    <div class=${emptyStyles(theme)} data-testid="inline-menu-empty-state">
      <span class=${emptyIconStyles(theme)} aria-hidden="true">${Search({ theme })}</span>
      <b>${i18n.title}</b>
      <span>${i18n.description}</span>
      ${
        showClear
          ? html`<button
              type="button"
              tabindex="-1"
              data-inline-menu-clear
              data-inline-menu-focusable
              class=${emptyActionStyles(theme)}
              @click=${handleClear}
            >
              ${i18n.showAll.replace("{count}", `${totalAccounts}`)}
            </button>`
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
    gap: 6px;
    padding: 22px 14px 20px;
    text-align: center;

    b {
      color: ${colors.text};
      font-size: 12px;
      font-weight: 600;
      line-height: 16px;
    }

    > span:not(:first-child) {
      max-width: 280px;
      color: ${colors.textSubtle};
      font-size: 10.5px;
      line-height: 16px;
    }
  `;
};

const emptyIconStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    margin-bottom: 2px;
    color: ${colors.textSubtle};

    svg {
      width: 22px;
      height: 22px;
    }
  `;
};

const emptyActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    padding: 4px 8px;
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

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
