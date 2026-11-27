import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { LocalPassMark } from "../icons";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuCollapsedChipProps = {
  theme: Theme;
  title: string;
  detail: string;
  expandText: string;
  ariaLabel: string;
  onOpen: (event: Event) => void;
};

export function InlineMenuCollapsedChip({
  theme,
  title,
  detail,
  expandText,
  ariaLabel,
  onOpen,
}: InlineMenuCollapsedChipProps) {
  const colors = inlineMenuColors(theme);

  const handleOpen = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onOpen(event);
    }
  };

  return html`
    <button
      type="button"
      tabindex="-1"
      data-inline-chip
      data-inline-menu-focusable
      data-testid="inline-menu-collapsed-chip"
      aria-label=${ariaLabel}
      class=${collapsedChipStyles(theme)}
      @click=${handleOpen}
    >
      <span class=${chipMarkStyles(theme)} aria-hidden="true">
        ${LocalPassMark({ theme, color: colors.brand })}
      </span>
      <span class=${chipMainStyles(theme)}>
        <b>${title}</b>
        <span>${detail}</span>
      </span>
      <span class=${chipActionStyles(theme)}>${expandText}</span>
    </button>
  `;
}

const collapsedChipStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 9px 11px;
    border: 1px solid ${colors.border};
    border-radius: 10px;
    background: ${colors.surface};
    box-shadow: ${colors.shadow};
    color: ${colors.text};
    font-family: inherit;
    text-align: left;
    cursor: pointer;

    :hover {
      background: ${colors.surfaceAlt};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const chipMarkStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: ${colors.brandSoft};
    color: ${colors.brand};

    svg {
      width: 17px;
      height: 17px;
    }
  `;
};

const chipMainStyles = (theme: Theme) => {
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
      font-size: 11.5px;
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

const chipActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    color: ${colors.brand};
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
  `;
};
