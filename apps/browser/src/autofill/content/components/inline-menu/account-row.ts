import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { EventSecurity } from "../../../utils/event-security";
import { Passkey } from "../icons";

import { getAvatarTone } from "./avatar";
import { InlineMenuAccountMethod } from "./login-menu-data";
import { inlineMenuColors } from "./menu-styles";
import {
  inlineMenuAvatarStyles,
  inlineMenuPillStyles,
  inlineMenuRowActionStyles,
  inlineMenuRowMainStyles,
  inlineMenuRowStyles,
  inlineMenuRowSubStyles,
  inlineMenuRowTitleStyles,
  inlineMenuRowTitleTextStyles,
  showInlineMenuFillFeedback,
} from "./row-styles";

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
      showInlineMenuFillFeedback(event.currentTarget as HTMLElement, theme);
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
      class=${`${inlineMenuRowStyles(theme)}${active ? " is-active" : ""}`}
      @click=${handleClick}
    >
      <span class=${inlineMenuAvatarStyles(theme, tone)} aria-hidden="true">
        ${initial}
        ${
          isPasskey
            ? html`<span class=${avatarBadgeStyles(theme)}>
                ${Passkey({ theme, color: colors.brand })}
              </span>`
            : nothing
        }
      </span>
      <span class=${inlineMenuRowMainStyles()}>
        <span class=${inlineMenuRowTitleStyles(theme)}>
          <span class=${inlineMenuRowTitleTextStyles()}>${username || label}</span>
          ${
            showCurrent
              ? html`<span class=${inlineMenuPillStyles(theme)}>${i18n.currentAccount}</span>`
              : showLastUsed
                ? html`<span class=${inlineMenuPillStyles(theme)}>${i18n.lastUsed}</span>`
                : nothing
          }
        </span>
        <span class=${inlineMenuRowSubStyles(theme)} title=${secondaryText}>${secondaryText}</span>
      </span>
      <span class=${inlineMenuRowActionStyles(theme)}>${actionText}</span>
    </button>
  `;
}

const avatarBadgeStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    position: absolute;
    right: -3px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: 12px;
    height: 12px;
    border: 1px solid ${colors.surface};
    border-radius: 50%;
    background: ${colors.surface};
    color: ${colors.brand};

    svg {
      width: 7px;
      height: 7px;
    }
  `;
};
