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
        <b>${i18n.title.replace("{username}", username)}</b>
        <p>${i18n.body}</p>
        <span class=${metaStyles(theme)}>${i18n.meta.replace("{domain}", domain)}</span>
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
    `,
  });
}

const verifyStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 28px 22px;
    text-align: center;

    b {
      color: ${colors.text};
      font-size: 12.5px;
      font-weight: 600;
      line-height: 17px;
    }

    p {
      max-width: 320px;
      margin: 0;
      color: ${colors.textMuted};
      font-size: 10.5px;
      line-height: 16px;
    }
  `;
};

const spinnerStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    width: 30px;
    height: 30px;
    margin-bottom: 2px;
    border: 3px solid ${colors.brandSoft};
    border-top-color: ${colors.brand};
    border-radius: 50%;
    animation: inline-menu-verify-spin 800ms linear infinite;

    @keyframes inline-menu-verify-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
};

const metaStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    padding: 3px 8px;
    border-radius: 999px;
    background: ${colors.surfaceAlt};
    color: ${colors.textSubtle};
    font-size: 9.5px;
    line-height: 13px;
  `;
};

const cancelStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    margin-top: 4px;
    padding: 6px 14px;
    border: 1px solid ${colors.border};
    border-radius: 7px;
    background: ${colors.surface};
    color: ${colors.textMuted};
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 500;
    line-height: 14px;
    cursor: pointer;

    :hover {
      background: ${colors.surfaceAlt};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
