import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { EventSecurity } from "../../../utils/event-security";

import { getAvatarTone } from "./avatar";
import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";
import { InlineMenuTotpRing } from "./totp-ring";

export type InlineMenuTotpRowI18n = {
  currentAccount: string;
  fill: string;
  fillAria: string;
  codeAria: string;
};

export type InlineMenuTotpRowProps = {
  theme: Theme;
  cipher: InlineMenuCipherData;
  rowKey: string;
  username: string;
  label: string;
  code: string;
  period: number;
  active?: boolean;
  isCurrent?: boolean;
  masked?: boolean;
  i18n: InlineMenuTotpRowI18n;
  onFill: (cipher: InlineMenuCipherData, event: Event) => void;
  onPeriodElapsed?: () => void;
};

export function InlineMenuTotpRow({
  theme,
  cipher,
  rowKey,
  username,
  label,
  code,
  period,
  active = false,
  isCurrent = false,
  masked = false,
  i18n,
  onFill,
  onPeriodElapsed,
}: InlineMenuTotpRowProps) {
  const formattedCode = formatTotpCode(code, masked);
  const secondaryText = `${username}${isCurrent ? ` · ${i18n.currentAccount}` : label ? ` · ${label}` : ""}`;
  const ariaLabel = i18n.fillAria.replace("{username}", username || label);
  const initial = (username || label || "?").charAt(0).toUpperCase();
  const tone = getAvatarTone(username || label || cipher.id);

  const handleClick = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onFill(cipher, event);
      showTotpFillFeedback(event.currentTarget as HTMLElement, theme);
    }
  };

  return html`
    <button
      type="button"
      tabindex="-1"
      data-inline-totp-row=${rowKey}
      data-inline-menu-focusable
      data-inline-row-key=${rowKey}
      data-fill-cipher=${cipher.id}
      aria-label=${ariaLabel}
      class=${`${totpRowStyles(theme)}${active ? " is-active" : ""}`}
      @click=${handleClick}
    >
      <span class=${totpAvatarWrapStyles(theme)} aria-hidden="true">
        <span class=${totpAvatarStyles(theme, tone)}>${initial}</span>
        ${InlineMenuTotpRing({ theme, period, onPeriodElapsed })}
      </span>
      <span class=${totpMainStyles(theme)}>
        <span
          class=${totpCodeStyles(theme)}
          data-inline-totp-code
          aria-label=${i18n.codeAria}
          title=${formattedCode}
        >
          ${formattedCode}
        </span>
        <span class=${totpSubStyles(theme)} title=${secondaryText}>${secondaryText}</span>
      </span>
      <span class=${totpActionStyles(theme)}>${i18n.fill}</span>
    </button>
  `;
}

export function formatTotpCode(code: string, masked: boolean): string {
  if (!code) {
    return "";
  }

  if (masked) {
    return "••• •••";
  }

  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

const totpRowStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 14px;
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
      box-shadow: inset 3px 0 0 ${colors.brand};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const totpMainStyles = (theme: Theme) => css`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const totpCodeStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    color: ${colors.text};
    font-family: ${colors.mono};
    font-size: 15px;
    font-weight: 600;
    line-height: 18px;
    letter-spacing: 0.1em;
    font-variant-numeric: tabular-nums;
  `;
};

const totpSubStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    overflow: hidden;
    color: ${colors.textSubtle};
    font-size: 10px;
    line-height: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
};

const totpActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    padding: 3px 8px;
    border-radius: 999px;
    background: ${colors.brandSoft};
    color: ${colors.brandStrong};
    font-size: 9.5px;
    font-weight: 600;
    line-height: 12px;

    button.is-active &,
    button:hover & {
      background: ${colors.brand};
      color: #fff;
    }
  `;
};

const totpAvatarWrapStyles = (_theme: Theme) => css`
  position: relative;
  flex: none;
  width: 34px;
  height: 34px;

  /* Ring overlays the avatar */
  [data-inline-totp-ring] {
    position: absolute;
    inset: 0;
  }

  /* Let the avatar colour show through the ring's transparent centre */
  [data-inline-totp-ring] > span {
    background: transparent;
  }
`;

const totpAvatarStyles = (theme: Theme, tone: "a" | "b" | "c") => {
  const colors = inlineMenuColors(theme);
  const tones = {
    a: { background: colors.brandSoft, color: colors.brandStrong },
    b: { background: colors.tealSoft, color: colors.tealStrong },
    c: { background: colors.orangeSoft, color: colors.orangeStrong },
  };
  const toneColors = tones[tone];

  return css`
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: ${toneColors.background};
    color: ${toneColors.color};
    font-size: 12.5px;
    font-weight: 700;
  `;
};

function totpFillFeedbackStyles(theme: Theme): string {
  const colors = inlineMenuColors(theme);

  return css`
    background: ${colors.successSoft} !important;
  `;
}

function showTotpFillFeedback(element: HTMLElement, theme: Theme): void {
  const className = totpFillFeedbackStyles(theme);
  element.classList.add(className);

  globalThis.setTimeout(() => {
    element.classList.remove(className);
  }, 600);
}
