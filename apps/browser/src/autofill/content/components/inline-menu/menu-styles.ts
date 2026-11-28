import { Theme } from "@localpass/common/platform/enums";

import { themes } from "../constants/styles";

export type InlineMenuColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderLight: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  brand: string;
  brandFill: string;
  brandFillStrong: string;
  brandSoft: string;
  brandStrong: string;
  hover: string;
  danger: string;
  successSoft: string;
  successStrong: string;
  shadow: string;
  tealSoft: string;
  tealStrong: string;
  orangeSoft: string;
  orangeStrong: string;
  mono: string;
};

export function inlineMenuColors(theme: Theme): InlineMenuColors {
  const tokens = themes[theme];
  const dark = theme === "dark";

  return {
    background: tokens.background.DEFAULT,
    surface: tokens.background.DEFAULT,
    surfaceAlt: tokens.background.alt,
    border: tokens.secondary["300"],
    borderLight: dark ? "rgba(82, 91, 106, 0.55)" : "rgba(168, 179, 200, 0.4)",
    text: tokens.text.main,
    textMuted: tokens.text.muted,
    textSubtle: tokens.secondary["500"],
    brand: tokens.primary["600"],
    brandFill: dark ? "#2563eb" : tokens.primary["600"],
    brandFillStrong: dark ? "#1d4ed8" : tokens.primary["700"],
    brandSoft: tokens.primary["100"],
    brandStrong: tokens.primary["700"],
    hover: tokens.primary["100"],
    danger: tokens.danger["600"],
    successSoft: dark ? "rgba(24, 220, 122, 0.16)" : "rgba(22, 163, 74, 0.14)",
    successStrong: dark ? "rgba(76, 240, 161, 1)" : "rgba(21, 128, 61, 1)",
    shadow: dark ? "0 8px 24px rgba(0, 0, 0, 0.45)" : "0 8px 24px rgba(15, 23, 42, 0.16)",
    tealSoft: dark ? "rgba(0, 124, 149, 0.26)" : "rgba(0, 124, 149, 0.13)",
    tealStrong: dark ? "#86e9f5" : "rgba(0, 94, 113, 1)",
    orangeSoft: dark ? "rgba(204, 68, 0, 0.28)" : "rgba(204, 68, 0, 0.13)",
    orangeStrong: dark ? "#ffb48c" : "rgba(154, 52, 0, 1)",
    mono: `"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace`,
  };
}

export const inlineMenuFocusRing = (color: string) => `
  &:focus-visible {
    outline: 2px solid ${color};
    outline-offset: -2px;
  }
`;

export const inlineMenuScrollbar = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return `
    scrollbar-width: thin;
    scrollbar-color: ${colors.border} transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: 999px;
      background-clip: content-box;
      background-color: ${colors.border};
    }
  `;
};
