import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { Close, LocalPassMark } from "../icons";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuHeaderI18n = {
  closeAria: string;
  showAll: string;
};

export type InlineMenuHeaderProps = {
  theme: Theme;
  domain: string;
  countText: string;
  contextText: string;
  showContext?: boolean;
  showClear?: boolean;
  i18n: InlineMenuHeaderI18n;
  onClear?: (event: Event) => void;
  onClose?: (event: Event) => void;
};

export function InlineMenuHeader({
  theme,
  domain,
  countText,
  contextText,
  showContext = true,
  showClear = false,
  i18n,
  onClear,
  onClose,
}: InlineMenuHeaderProps) {
  const colors = inlineMenuColors(theme);

  const handleClear = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onClear?.(event);
    }
  };

  const handleClose = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onClose?.(event);
    }
  };

  return html`
    <div data-inline-menu-header class=${headerStyles(theme)}>
      <span class=${brandMarkStyles(theme)} aria-hidden="true">
        ${LocalPassMark({ theme, color: colors.brand })}
      </span>
      <span class=${headMainStyles(theme)}>
        <b>LocalPass</b>
        <span title=${domain}>${domain}</span>
      </span>
      <span class=${countStyles(theme)}>${countText}</span>
      <button
        type="button"
        tabindex="-1"
        data-inline-menu-close
        class=${closeButtonStyles(theme)}
        aria-label=${i18n.closeAria}
        title=${i18n.closeAria}
        @click=${handleClose}
      >
        ${Close({ theme, color: colors.textSubtle })}
      </button>
    </div>
    ${
      showContext
        ? html`<div class=${contextStyles(theme)}>
            <span title=${contextText}>${contextText}</span>
            ${
              showClear
                ? html`<button
                    type="button"
                    tabindex="-1"
                    data-inline-menu-clear
                    class=${contextActionStyles(theme)}
                    @click=${handleClear}
                  >
                    ${i18n.showAll}
                  </button>`
                : nothing
            }
          </div>`
        : nothing
    }
  `;
}

const headerStyles = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border-bottom: 1px solid ${inlineMenuColors(theme).borderLight};
  background: ${inlineMenuColors(theme).surface};
`;

const brandMarkStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: ${colors.brandSoft};
    color: ${colors.brand};

    svg {
      width: 20px;
      height: 20px;
    }
  `;
};

const headMainStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;

    b {
      color: ${colors.text};
      font-size: 12.5px;
      font-weight: 600;
      line-height: 16px;
    }

    span {
      overflow: hidden;
      color: ${colors.textSubtle};
      font-size: 10px;
      line-height: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
};

const countStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    margin-left: auto;
    padding: 3px 8px;
    border-radius: 999px;
    background: ${colors.surfaceAlt};
    color: ${colors.textMuted};
    font-size: 9.5px;
    line-height: 12px;
    white-space: nowrap;
  `;
};

const closeButtonStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-left: 2px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${colors.textSubtle};
    cursor: pointer;

    svg {
      width: 11px;
      height: 11px;
    }

    :hover {
      background: ${colors.surfaceAlt};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const contextStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 31px;
    padding: 0 14px;
    border-bottom: 1px solid ${colors.borderLight};
    background: ${colors.surfaceAlt};
    color: ${colors.textSubtle};
    font-size: 10px;
    line-height: 14px;

    > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
};

const contextActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    padding: 2px 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: ${colors.brand};
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;

    :hover {
      text-decoration: underline;
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
