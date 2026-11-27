import { css } from "@emotion/css";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { Check, Copy } from "../icons";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";
import { formatTotpCode } from "./totp-row";

export type InlineMenuTotpFilledCardI18n = {
  ariaLabel: string;
  title: string;
  body: string;
  copiedBody: string;
  copied: string;
  copyAria: string;
  remaining: string;
  switchAccount: string;
};

export type InlineMenuTotpFilledCardProps = {
  theme: Theme;
  username: string;
  code: string;
  period: number;
  masked?: boolean;
  canAutoCopy?: boolean;
  copied?: boolean;
  i18n: InlineMenuTotpFilledCardI18n;
  onCopy: (event: Event) => void;
  onSwitchAccount: (event: Event) => void;
};

export function InlineMenuTotpFilledCard({
  theme,
  username,
  code,
  period,
  masked = false,
  copied = false,
  i18n,
  onCopy,
  onSwitchAccount,
}: InlineMenuTotpFilledCardProps) {
  const colors = inlineMenuColors(theme);
  const [remainingBefore, remainingAfter = ""] = i18n.remaining.split("{seconds}");

  const handleCopy = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onCopy(event);
    }
  };

  const handleSwitchAccount = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onSwitchAccount(event);
    }
  };

  return html`
    <div
      role="status"
      aria-live="polite"
      aria-label=${i18n.ariaLabel}
      data-testid="inline-menu-totp-filled"
      class=${filledCardStyles(theme)}
    >
      <div class=${filledMainStyles}>
        <span class=${checkStyles(theme)} aria-hidden="true">${Check({ theme })}</span>
        <span class=${filledTextStyles(theme)}>
          <b>${i18n.title.replace("{username}", username)}</b>
          <span>${copied ? i18n.copiedBody : i18n.body}</span>
        </span>
        <button
          type="button"
          tabindex="-1"
          data-inline-totp-copy
          data-inline-menu-focusable
          class=${iconButtonStyles(theme)}
          aria-label=${copied ? i18n.copied : i18n.copyAria}
          title=${copied ? i18n.copied : i18n.copyAria}
          @click=${handleCopy}
        >
          ${Copy({ theme, color: colors.textSubtle })}
        </button>
      </div>
      <div class=${filledMetaStyles(theme)}>
        <span class=${codeStyles(theme)}>${formatTotpCode(code, masked)}</span>
        <span class=${remainingStyles(theme)}>
          ${remainingBefore}<b data-inline-totp-remaining ${ref(createRemainingRef(period))}></b
          >${remainingAfter}
        </span>
        <button
          type="button"
          tabindex="-1"
          data-inline-switch-account
          data-inline-menu-focusable
          class=${switchActionStyles(theme)}
          @click=${handleSwitchAccount}
        >
          ${i18n.switchAccount}
        </button>
      </div>
    </div>
  `;
}

function createRemainingRef(period: number) {
  let intervalId: ReturnType<typeof globalThis.setInterval> | undefined;

  return (node: Element | undefined) => {
    if (intervalId !== undefined) {
      globalThis.clearInterval(intervalId);
      intervalId = undefined;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const paint = () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      node.textContent = `${period - (nowSeconds % period)}`;
    };

    paint();
    intervalId = globalThis.setInterval(paint, 1000);
  };
}

const filledCardStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    box-sizing: border-box;
    width: 100%;
    padding: 12px 14px;
    border: 1px solid ${colors.border};
    border-radius: 12px;
    background: ${colors.surface};
    color: ${colors.text};
    box-shadow: ${colors.shadow};
    font-family: Inter, sans-serif;
  `;
};

const filledMainStyles = css`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const checkStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: ${colors.successSoft};
    color: ${colors.successStrong};

    svg {
      width: 14px;
      height: 14px;
    }
  `;
};

const filledTextStyles = (theme: Theme) => {
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
      font-size: 12px;
      font-weight: 600;
      line-height: 16px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      color: ${colors.textSubtle};
      font-size: 10px;
      line-height: 14px;
    }
  `;
};

const iconButtonStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${colors.textSubtle};
    cursor: pointer;

    svg {
      width: 14px;
      height: 14px;
    }

    :hover {
      background: ${colors.surfaceAlt};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const filledMetaStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid ${colors.borderLight};
    color: ${colors.textSubtle};
    font-size: 10px;
    line-height: 14px;
  `;
};

const codeStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    color: ${colors.text};
    font-family: ${colors.mono};
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
  `;
};

const remainingStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    b {
      color: ${colors.text};
      font-variant-numeric: tabular-nums;
    }
  `;
};

const switchActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    margin-left: auto;
    padding: 2px 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: ${colors.brand};
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
    white-space: nowrap;
    cursor: pointer;

    :hover {
      text-decoration: underline;
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
