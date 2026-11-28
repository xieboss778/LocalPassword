import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";

import { InlineMenuHeader } from "./menu-header";
import { InlineMenuShell } from "./menu-shell";
import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuPasskeyVerifyingI18n = {
  headerCount: string;
  title: string;
  body: string;
  meta: string;
  cancel: string;
  ariaLabel: string;
  closeAria: string;
  showAll: string;
};

export type InlineMenuPasskeyVerifyingProps = {
  theme: Theme;
  domain: string;
  username: string;
  i18n: InlineMenuPasskeyVerifyingI18n;
  onCancel: (event: Event) => void;
};

export function InlineMenuPasskeyVerifying({
  theme,
  domain,
  username,
  i18n,
  onCancel,
}: InlineMenuPasskeyVerifyingProps) {
  const handleCancel = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onCancel(event);
    }
  };

  return InlineMenuShell({
    theme,
    ariaLabel: i18n.ariaLabel,
    dataTestId: "inline-menu-passkey-authenticating",
    children: html`
      ${InlineMenuHeader({
        theme,
        domain,
        countText: i18n.headerCount,
        contextText: "",
        showContext: false,
        i18n: { closeAria: i18n.closeAria, showAll: i18n.showAll },
        onClose: handleCancel,
      })}
      <div class=${verifyStyles(theme)} role="status" aria-live="polite">
        <span class=${spinnerStyles(theme)} aria-hidden="true"></span>
        <span class=${infoStyles(theme)}>
          <b>${i18n.title.replace("{username}", username)}</b>
          <span>${i18n.body}</span>
        </span>
        <button
          type="button"
          tabindex="-1"
          data-inline-passkey-cancel
          data-inline-menu-focusable
          class=${cancelStyles(theme)}
          @click=${handleCancel}
        >
          ${i18n.cancel}
        </button>
      </div>
      <div class=${metaBarStyles(theme)}>${i18n.meta.replace("{domain}", domain)}</div>
    `,
  });
}

const verifyStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    padding: 8px 10px;
    background: ${colors.surface};
  `;
};

const infoStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    b {
      overflow: hidden;
      color: ${colors.text};
      font-size: 11px;
      font-weight: 600;
      line-height: 14px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      overflow: hidden;
      color: ${colors.textMuted};
      font-size: 9.5px;
      line-height: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
};

const spinnerStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    width: 20px;
    height: 20px;
    border: 2px solid ${colors.brandSoft};
    border-top-color: ${colors.brand};
    border-radius: 50%;
    animation: inline-menu-verify-spin 800ms linear infinite;

    @keyframes inline-menu-verify-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `;
};

const metaBarStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    padding: 5px 10px;
    border-top: 1px solid ${colors.borderLight};
    background: ${colors.surfaceAlt};
    color: ${colors.textSubtle};
    font-size: 9px;
    line-height: 12px;
  `;
};

const cancelStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    height: 22px;
    padding: 0 9px;
    border: 1px solid ${colors.border};
    border-radius: 5px;
    background: ${colors.surface};
    color: ${colors.textMuted};
    font-family: inherit;
    font-size: 10px;
    font-weight: 550;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;

    :hover {
      background: ${colors.surfaceAlt};
      color: ${colors.text};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
