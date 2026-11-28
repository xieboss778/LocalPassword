import { css } from "@emotion/css";
import { html } from "lit";
import { ref } from "lit/directives/ref.js";

import { Theme } from "@localpass/common/platform/enums";

import { inlineMenuColors } from "./menu-styles";

const TOTP_EXPIRY_SECONDS = 7;

export type InlineMenuTotpRingProps = {
  theme: Theme;
  period: number;
  secondsRemaining?: number;
  onPeriodElapsed?: () => void;
};

export function InlineMenuTotpRing({
  theme,
  period,
  secondsRemaining,
  onPeriodElapsed,
}: InlineMenuTotpRingProps) {
  return html`
    <span
      class=${totpRingStyles(theme)}
      aria-hidden="true"
      data-inline-totp-ring
      ${ref(createTotpRingRef(theme, period, secondsRemaining, onPeriodElapsed))}
    >
      <span data-inline-totp-seconds></span>
    </span>
  `;
}

function createTotpRingRef(
  theme: Theme,
  period: number,
  frozenSeconds: number | undefined,
  onPeriodElapsed?: () => void,
) {
  let intervalId: ReturnType<typeof globalThis.setInterval> | undefined;

  return (node: Element | undefined) => {
    if (intervalId !== undefined) {
      globalThis.clearInterval(intervalId);
      intervalId = undefined;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const secondsEl = node.querySelector("[data-inline-totp-seconds]") as HTMLElement | null;
    let lastSlot: number | null = null;

    const paint = (seconds: number) => {
      const expiring = seconds <= TOTP_EXPIRY_SECONDS;
      const color = expiring ? inlineMenuColors(theme).danger : inlineMenuColors(theme).brand;
      node.style.setProperty("--inline-totp-progress", `${(seconds / period) * 100}%`);
      node.toggleAttribute("data-ending", expiring);
      if (secondsEl) {
        secondsEl.textContent = `${seconds}`;
        secondsEl.style.color = color;
      }
    };

    if (frozenSeconds !== undefined) {
      paint(frozenSeconds);
      return;
    }

    const tick = () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const slot = Math.floor(nowSeconds / period);
      const seconds = period - (nowSeconds % period);
      paint(seconds);

      if (lastSlot !== null && slot !== lastSlot) {
        onPeriodElapsed?.();
      }
      lastSlot = slot;
    };

    tick();
    intervalId = globalThis.setInterval(tick, 1000);
  };
}

const totpRingStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    --inline-totp-progress: 100%;

    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: conic-gradient(
      ${colors.brand} var(--inline-totp-progress),
      ${colors.borderLight} 0
    );

    &[data-ending] {
      background: conic-gradient(
        ${colors.danger} var(--inline-totp-progress),
        ${colors.borderLight} 0
      );
    }

    > span {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: ${colors.surface};
      color: ${colors.textMuted};
      font-size: 9px;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }
  `;
};
