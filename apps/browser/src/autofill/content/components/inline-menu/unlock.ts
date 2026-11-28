import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { Lock } from "../icons";

import { InlineMenuContainer } from "./container";
import { InlineMenuHeader } from "./menu-header";
import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuUnlockI18n = {
  closeAria: string;
  showAll: string;
  /** Header context; the menu is closed over a locked vault. */
  locked: string;
  /** Completed sentence, e.g. "Unlock to fill northwind.test". */
  message: string;
  password: string;
  unlock: string;
  unlockAria: string;
  biometrics: string;
  biometricsAria: string;
  footnote: string;
};

export type InlineMenuUnlockProps = {
  theme: Theme;
  domain: string;
  i18n: InlineMenuUnlockI18n;
  showBiometrics: boolean;
  busy: boolean;
  error?: string | null;
  onSubmit: (password: string) => void;
  onBiometrics: () => void;
  onClose: () => void;
};

/**
 * Locked inline menu that unlocks in place: a master-password field and, when the desktop bridge
 * reports it available, a biometrics action. The password only travels through this extension's
 * iframe and port message; it is never placed on the host page.
 */
export function InlineMenuUnlock({
  theme,
  domain,
  i18n,
  showBiometrics,
  busy,
  error,
  onSubmit,
  onBiometrics,
  onClose,
}: InlineMenuUnlockProps) {
  const colors = inlineMenuColors(theme);

  const submitPassword = (input: HTMLInputElement | null) => {
    const password = input?.value ?? "";
    // Drop the secret from the DOM before the request leaves this iframe.
    if (input) {
      input.value = "";
    }
    if (password !== "") {
      onSubmit(password);
    }
  };

  // The menu page is a sandboxed iframe without `allow-forms`, so a native <form> submit is
  // blocked by the browser. Enter and the button are handled directly instead.
  const onPasswordKeyDown = (event: KeyboardEvent) => {
    if (!EventSecurity.isEventTrusted(event) || busy || event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    submitPassword(event.currentTarget as HTMLInputElement);
  };

  const onSubmitClick = (event: Event) => {
    if (!EventSecurity.isEventTrusted(event) || busy) {
      return;
    }
    const target = (event.currentTarget ?? event.target) as HTMLElement | null;
    const root = (target?.closest("[data-inline-menu-unlock-form]") ??
      target?.getRootNode?.() ??
      document) as Document | ShadowRoot | HTMLElement;
    submitPassword(
      root.querySelector<HTMLInputElement>("[data-inline-menu-unlock-password]") ?? null,
    );
  };

  const onBiometricsClick = (event: Event) => {
    if (EventSecurity.isEventTrusted(event) && !busy) {
      onBiometrics();
    }
  };

  const onCloseClick = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      onClose();
    }
  };

  return InlineMenuContainer({
    theme,
    dataTestId: "inline-menu-locked-state",
    children: html`
      ${InlineMenuHeader({
        theme,
        domain: i18n.locked,
        contextText: "",
        showContext: false,
        i18n: { closeAria: i18n.closeAria, showAll: i18n.showAll },
        onClose: onCloseClick,
      })}
      <div data-inline-menu-unlock-form class=${bodyStyles(theme)}>
        <div class=${messageStyles(theme)}>
          <span class=${lockIconStyles} aria-hidden="true"
            >${Lock({ theme, color: colors.textSubtle })}</span
          >
          <span>${i18n.message}</span>
        </div>
        <input
          type="password"
          name="password"
          class=${inputStyles(theme)}
          data-inline-menu-unlock-password
          aria-label=${i18n.password}
          placeholder=${i18n.password}
          autocomplete="off"
          spellcheck="false"
          ?disabled=${busy}
          @keydown=${onPasswordKeyDown}
        />
        ${error ? html`<div class=${errorStyles(theme)} role="alert">${error}</div>` : nothing}
        <div class=${buttonRowStyles}>
          <button
            type="button"
            class=${primaryButtonStyles(theme)}
            data-testid="inline-menu-unlock-button"
            aria-label=${i18n.unlockAria}
            ?disabled=${busy}
            @click=${onSubmitClick}
          >
            ${i18n.unlock}
          </button>
          ${
            showBiometrics
              ? html`<button
                  type="button"
                  class=${secondaryButtonStyles(theme)}
                  data-testid="inline-menu-unlock-biometrics"
                  aria-label=${i18n.biometricsAria}
                  ?disabled=${busy}
                  @click=${onBiometricsClick}
                >
                  ${i18n.biometrics}
                </button>`
              : nothing
          }
        </div>
        <div class=${footnoteStyles(theme)}>${i18n.footnote}</div>
      </div>
    `,
  });
}

const bodyStyles = (theme: Theme) => css`
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  padding: 9px 9px 8px;
`;

const messageStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 5px;
    color: ${colors.textMuted};
    font-size: 10.5px;
    line-height: 14px;
  `;
};

const lockIconStyles = css`
  display: inline-flex;
  flex: none;

  svg {
    width: 13px;
    height: 13px;
  }
`;

const inputStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    box-sizing: border-box;
    width: 100%;
    height: 28px;
    margin-top: 1px;
    padding: 0 8px;
    border: 1px solid ${colors.border};
    border-radius: 5px;
    background: ${colors.surfaceAlt};
    color: ${colors.text};
    font-family: inherit;
    font-size: 11px;

    ::placeholder {
      color: ${colors.textSubtle};
    }

    &:disabled {
      opacity: 0.6;
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const errorStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    color: ${colors.danger};
    font-size: 9.5px;
    line-height: 12px;
  `;
};

const buttonRowStyles = css`
  display: flex;
  gap: 5px;
  margin-top: 0;
`;

const compactButtonStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    box-sizing: border-box;
    height: 26px;
    padding: 0 10px;
    border-radius: 5px;
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const primaryButtonStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    ${compactButtonStyles(theme)}

    flex: 1;
    border: 1px solid ${colors.brandFill};
    background: ${colors.brandFill};
    color: #fff;

    &:hover:not(:disabled) {
      border-color: ${colors.brandFillStrong};
      background: ${colors.brandFillStrong};
    }
  `;
};

const secondaryButtonStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    ${compactButtonStyles(theme)}

    border: 1px solid ${colors.border};
    background: ${colors.surface};
    color: ${colors.text};

    &:hover:not(:disabled) {
      background: ${colors.surfaceAlt};
    }
  `;
};

const footnoteStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    color: ${colors.textSubtle};
    font-size: 9px;
    line-height: 12px;
  `;
};
