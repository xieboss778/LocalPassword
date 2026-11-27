import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { inlineMenuColors } from "./menu-styles";

export type InlineMenuShellProps = {
  theme: Theme;
  children: TemplateResult | TemplateResult[];
  ariaLabel: string;
  dataTestId?: string;
  compact?: boolean;
};

export function InlineMenuShell({
  theme,
  children,
  ariaLabel,
  dataTestId,
  compact = false,
}: InlineMenuShellProps) {
  return html`
    <div
      role="dialog"
      aria-label=${ariaLabel}
      data-testid=${dataTestId ?? "inline-menu-shell"}
      class=${inlineMenuShellStyles(theme, compact)}
    >
      ${children}
    </div>
  `;
}

const inlineMenuShellStyles = (theme: Theme, compact: boolean) => {
  const colors = inlineMenuColors(theme);

  return css`
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
    border: 1px solid ${colors.border};
    border-radius: ${compact ? "10px" : "12px"};
    background: ${colors.surface};
    color: ${colors.text};
    box-shadow: ${colors.shadow};
    font-family: Inter, sans-serif;
    text-align: left;
  `;
};
