import { css } from "@emotion/css";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { Check } from "../icons";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

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

/**
 * 验证码填充后的收窄确认条：只说明「已填入 / 剩余秒数」，不再把验证码摊在屏幕上。
 * 右侧动作回到验证码列表，让用户换一个账户重新填。
 */
export function InlineMenuTotpFilledCard({
  theme,
  username,
  period,
  i18n,
  onSwitchAccount,
}: InlineMenuTotpFilledCardProps) {
  const [remainingBefore, remainingAfter = ""] = i18n.remaining.split("{seconds}");

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
      class=${cardStyles(theme)}
    >
      <div class=${headerStyles(theme)}>
        <span class=${brandStyles(theme)} aria-hidden="true">LP</span>
        <span class=${nameStyles(theme)}>LocalPass</span>
        <span class=${suffixStyles(theme)}>· ${i18n.ariaLabel}</span>
      </div>
      <div class=${successRowStyles(theme)}>
        <span class=${checkStyles(theme)} aria-hidden="true">${Check({ theme })}</span>
        <span class=${textStyles(theme)}>
          <b>${i18n.title.replace("{username}", username)}</b>
          <span class=${metaStyles(theme)}>
            <span class=${bodyTextStyles(theme)}>${i18n.body}</span>
            <span class=${remainingStyles(theme)}>
              ${remainingBefore}<b data-inline-totp-remaining ${ref(createRemainingRef(period))}></b
              >${remainingAfter}
            </span>
          </span>
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

const cardStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
    border: 1px solid ${colors.border};
    border-radius: 8px;
    background: ${colors.surface};
    color: ${colors.text};
    box-shadow: ${colors.shadow};
    font-family: Inter, sans-serif;
  `;
};

const headerStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    border-bottom: 1px solid ${colors.borderLight};
  `;
};

const brandStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 15px;
    height: 15px;
    border-radius: 4px;
    background: ${colors.brand};
    color: #fff;
    font-size: 7px;
    font-weight: 700;
  `;
};

const nameStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    color: ${colors.text};
    font-size: 11px;
    font-weight: 650;
    line-height: 14px;
  `;
};

const suffixStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    min-width: 0;
    overflow: hidden;
    color: ${colors.textSubtle};
    font-size: 10px;
    line-height: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
};

const successRowStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    padding: 0 10px;
    background: ${colors.successSoft};
  `;
};

const checkStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: grid;
    flex: none;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${colors.successStrong};
    color: ${colors.surface};

    svg {
      width: 10px;
      height: 10px;
    }
  `;
};

const textStyles = (theme: Theme) => {
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
  `;
};

const metaStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    color: ${colors.textSubtle};
    font-size: 9.5px;
    line-height: 13px;
  `;
};

const bodyTextStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    min-width: 0;
    overflow: hidden;
    color: ${colors.textSubtle};
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
};

const remainingStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    color: ${colors.textSubtle};
    white-space: nowrap;

    b {
      color: ${colors.text};
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `;
};

const switchActionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    flex: none;
    padding: 3px 8px;
    border: 0;
    border-radius: 999px;
    background: ${colors.surface};
    color: ${colors.brandStrong};
    font-family: inherit;
    font-size: 9.5px;
    font-weight: 600;
    line-height: 12px;
    white-space: nowrap;
    cursor: pointer;

    :hover {
      background: ${colors.brandSoft};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};
