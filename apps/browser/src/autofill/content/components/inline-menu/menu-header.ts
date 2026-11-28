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
  /** Optional count chip; omitted for menus that do not page through a large list. */
  countText?: string;
  countTone?: "default" | "warn";
  contextText: string;
  showContext?: boolean;
  showClear?: boolean;
  /** Renders the dismiss control; the password generator menu is dismissed by leaving the field. */
  showClose?: boolean;
  i18n: InlineMenuHeaderI18n;
  onClear?: (event: Event) => void;
  onClose?: (event: Event) => void;
};

export function InlineMenuHeader({
  theme,
  domain,
  countText,
  countTone = "default",
  contextText,
  showContext = true,
  showClear = false,
  showClose = true,
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
        ${LocalPassMark({ theme, color: "#fff" })}
      </span>
      <span class=${nameStyles(theme)}>LocalPass</span>
      <span class=${domainStyles(theme)} title=${domain}>· ${domain}</span>
      ${countText ? html`<span class=${countStyles(theme, countTone)}>${countText}</span>` : nothing}
      ${
        showClose
          ? html`<button
              type="button"
              tabindex="-1"
              data-inline-menu-close
              class=${closeButtonStyles(theme)}
              aria-label=${i18n.closeAria}
              title=${i18n.closeAria}
              @click=${handleClose}
            >
              ${Close({ theme, color: colors.textSubtle })}
            </button>`
          : nothing
      }
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
  gap: 5px;
  min-height: 28px;
  padding: 0 8px;
  border-bottom: 1px solid ${inlineMenuColors(theme).borderLight};
  background: ${inlineMenuColors(theme).surfaceAlt};
  color: ${inlineMenuColors(theme).textSubtle};
  font-size: 10.5px;
  line-height: 14px;
`;

const brandMarkStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: ${colors.brandFill};

    svg {
      width: 9px;
      height: 9px;
    }
  `;
};

const nameStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    color: ${colors.text};
    font-weight: 650;
    white-space: nowrap;
  `;
};

const domainStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: ${colors.textSubtle};
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
};

const countStyles = (theme: Theme, tone: "default" | "warn" = "default") => {
  const colors = inlineMenuColors(theme);
  const dark = theme === "dark";
  const background =
    tone === "warn"
      ? dark
        ? "rgba(245, 158, 11, 0.16)"
        : "rgba(217, 119, 6, 0.12)"
      : colors.surface;
  const color = tone === "warn" ? (dark ? "#fbbf24" : "#b45309") : colors.textSubtle;

  return css`
    flex: none;
    padding: 1px 6px;
    border-radius: 999px;
    background: ${background};
    color: ${color};
    font-size: 9px;
    font-weight: ${tone === "warn" ? "600" : "400"};
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
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: ${colors.textSubtle};
    cursor: pointer;

    svg {
      width: 10px;
      height: 10px;
    }

    :hover {
      background: ${colors.surface};
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
    min-height: 20px;
    padding: 0 8px;
    border-bottom: 1px solid ${colors.borderLight};
    background: ${colors.surface};
    color: ${colors.textSubtle};
    font-size: 9.5px;
    line-height: 12px;

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
    padding: 1px 0;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: ${colors.brand};
    font-family: inherit;
    font-size: 9.5px;
    font-weight: 600;
    line-height: 12px;
    white-space: nowrap;
    cursor: pointer;

    :hover {
      text-decoration: underline;
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
