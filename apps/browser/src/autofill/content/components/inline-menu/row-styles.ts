import { css } from "@emotion/css";

import { Theme } from "@localpass/common/platform/enums";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

/**
 * Shared styles for interactive suggestion rows in the compact inline menu. Login accounts,
 * cards and identities all use the same 36px row so the menu keeps one visual rhythm.
 */
export const inlineMenuRowStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 36px;
    padding: 4px 8px;
    border: 0;
    border-top: 1px solid ${colors.borderLight};
    background: transparent;
    color: ${colors.text};
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 120ms ease;

    &:first-of-type {
      border-top: 0;
    }

    &.is-active,
    &:hover {
      background: ${colors.hover};
      box-shadow: inset 2.5px 0 0 ${colors.brand};
    }

    &:active {
      background: ${colors.brandSoft};
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

export const inlineMenuAvatarStyles = (theme: Theme, tone: "a" | "b" | "c") => {
  const colors = inlineMenuColors(theme);
  const tones = {
    a: { background: colors.brandSoft, color: colors.brandStrong },
    b: { background: colors.tealSoft, color: colors.tealStrong },
    c: { background: colors.orangeSoft, color: colors.orangeStrong },
  };
  const toneColors = tones[tone];

  return css`
    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: ${toneColors.background};
    color: ${toneColors.color};
    font-size: 9px;
    font-weight: 700;
  `;
};

export const inlineMenuRowMainStyles = () => css`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

export const inlineMenuRowTitleStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    color: ${colors.text};
    font-size: 11px;
    font-weight: 600;
    line-height: 14px;
  `;
};

export const inlineMenuRowTitleTextStyles = () => css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const inlineMenuRowSubStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    overflow: hidden;
    color: ${colors.textSubtle};
    font-size: 9.5px;
    line-height: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
};

export const inlineMenuPillStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    padding: 1px 4px;
    border-radius: 999px;
    background: ${colors.brandSoft};
    color: ${colors.brandStrong};
    font-size: 8px;
    font-weight: 600;
    line-height: 10px;
    white-space: nowrap;
  `;
};

export const inlineMenuRowActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: none;
    flex: none;
    padding: 2px 6px;
    border-radius: 999px;
    background: ${colors.brandSoft};
    color: ${colors.brandStrong};
    font-size: 9px;
    font-weight: 600;
    line-height: 11px;
    white-space: nowrap;

    button.is-active &,
    button:hover &,
    button:focus-visible & {
      display: inline-flex;
      background: ${colors.brandFill};
      color: #fff;
    }
  `;
};

function fillFeedbackStyles(theme: Theme): string {
  const colors = inlineMenuColors(theme);

  return css`
    background: ${colors.successSoft} !important;
  `;
}

export function showInlineMenuFillFeedback(element: HTMLElement, theme: Theme): void {
  const className = fillFeedbackStyles(theme);
  element.classList.add(className);

  globalThis.setTimeout(() => {
    element.classList.remove(className);
  }, 600);
}
