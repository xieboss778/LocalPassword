import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { EventSecurity } from "../../../utils/event-security";
import { Passkey } from "../icons";

import { getAvatarTone } from "./avatar";
import { InlineMenuAccountMethod } from "./login-menu-data";
import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuAccountRowI18n = {
  passkey: string;
  password: string;
  verificationCode: string;
  lastUsed: string;
  currentAccount: string;
  fill: string;
  verify: string;
  fillPasswordAria: string;
  usePasskeyAria: string;
};

export type InlineMenuAccountRowProps = {
  theme: Theme;
  cipher: InlineMenuCipherData;
  method: InlineMenuAccountMethod;
  rowKey: string;
  username: string;
  label: string;
  hasTotp: boolean;
  active?: boolean;
  showLastUsed?: boolean;
  showCurrent?: boolean;
  i18n: InlineMenuAccountRowI18n;
  onFill: (cipher: InlineMenuCipherData, method: InlineMenuAccountMethod, event: Event) => void;
};

export function InlineMenuAccountRow({
  theme,
  cipher,
  method,
  rowKey,
  username,
  label,
  hasTotp,
  active = false,
  showLastUsed = false,
  showCurrent = false,
  i18n,
  onFill,
}: InlineMenuAccountRowProps) {
  const colors = inlineMenuColors(theme);
  const isPasskey = method === "passkey";
  const methodText = isPasskey
    ? i18n.passkey
    : `${i18n.password}${hasTotp ? ` + ${i18n.verificationCode}` : ""}`;
  const secondaryText = label && label !== username ? `${label} · ${methodText}` : methodText;
  const actionText = isPasskey ? i18n.verify : i18n.fill;
  const ariaLabel = (isPasskey ? i18n.usePasskeyAria : i18n.fillPasswordAria).replace(
    "{username}",
    username || label,
  );
  const initial = (username || label || "?").charAt(0).toUpperCase();
  const tone = getAvatarTone(username || label || cipher.id);
  const handleClick = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onFill(cipher, method, event);
      showFillFeedback(event.currentTarget as HTMLElement, theme);
    }
  };

  return html`
    <button
      type="button"
      tabindex="-1"
      data-inline-account-row=${rowKey}
      data-inline-menu-focusable
      data-inline-method=${method}
      data-inline-row-key=${rowKey}
      data-fill-cipher=${cipher.id}
      aria-label=${ariaLabel}
      class=${`${accountRowStyles(theme)}${active ? " is-active" : ""}`}
      @click=${handleClick}
    >
      <span class=${avatarStyles(theme, tone)} aria-hidden="true">
        ${initial}
        ${
          isPasskey
            ? html`<span class=${avatarBadgeStyles(theme)}>
                ${Passkey({ theme, color: colors.brand })}
              </span>`
            : nothing
        }
      </span>
      <span class=${rowMainStyles(theme)}>
        <span class=${rowTitleStyles(theme)}>
          <span class=${titleTextStyles(theme)}>${username || label}</span>
          ${
            showCurrent
              ? html`<span class=${pillStyles(theme)}>${i18n.currentAccount}</span>`
              : showLastUsed
                ? html`<span class=${pillStyles(theme)}>${i18n.lastUsed}</span>`
                : nothing
          }
        </span>
        <span class=${rowSubStyles(theme)} title=${secondaryText}>${secondaryText}</span>
      </span>
      <span class=${rowActionStyles(theme)}>${actionText}</span>
    </button>
  `;
}

const accountRowStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 14px;
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

    &:active {
      background: ${colors.brandSoft};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const avatarStyles = (theme: Theme, tone: "a" | "b" | "c") => {
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
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: ${toneColors.background};
    color: ${toneColors.color};
    font-size: 12.5px;
    font-weight: 700;
  `;
};

const avatarBadgeStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    position: absolute;
    right: -3px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 1px solid ${colors.border};
    border-radius: 50%;
    background: ${colors.surface};
    color: ${colors.brand};

    svg {
      width: 10px;
      height: 10px;
    }
  `;
};

const rowMainStyles = (theme: Theme) => css`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const rowTitleStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: ${colors.text};
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  `;
};

const titleTextStyles = (theme: Theme) => css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const rowSubStyles = (theme: Theme) => {
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

const pillStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    padding: 2px 6px;
    border-radius: 999px;
    background: ${colors.brandSoft};
    color: ${colors.brandStrong};
    font-size: 8.5px;
    font-weight: 600;
    line-height: 11px;
    white-space: nowrap;
  `;
};

const rowActionStyles = (theme: Theme) => {
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

function fillFeedbackStyles(theme: Theme): string {
  const colors = inlineMenuColors(theme);

  return css`
    background: ${colors.successSoft} !important;
  `;
}

function showFillFeedback(element: HTMLElement, theme: Theme): void {
  const className = fillFeedbackStyles(theme);
  element.classList.add(className);

  globalThis.setTimeout(() => {
    element.classList.remove(className);
  }, 600);
}
