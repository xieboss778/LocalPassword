import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";
import { Refresh, Wand } from "../icons";

import { ColorizedPassword, ColorizedPasswordI18n } from "./colorized-password";
import { InlineMenuContainer } from "./container";
import { InlineMenuFooter } from "./menu-footer";
import { InlineMenuHeader } from "./menu-header";
import { inlineMenuColors } from "./menu-styles";

const FILL_SELECTOR = "[data-fill-generated-password]";
const REFRESH_SELECTOR = '[data-testid="refresh-generated-password"]';

export type InlineMenuPasswordGeneratorI18n = ColorizedPasswordI18n & {
  /** Menu header context, for example "Generate password". */
  generateHeading: string;
  /** Two-line row description under the password preview. */
  description: string;
  /** Label of the primary fill action. */
  fill: string;
  /** Footer action that generates another password. */
  regenerate: string;
  /** Accessible name for the regenerate action. */
  regeneratePassword: string;
  /** Footer disclosure stating the password never leaves the device. */
  localOnly: string;
  closeAria: string;
  showAll: string;
};

export type InlineMenuPasswordGeneratorProps = {
  password: string;
  headingText: string;
  theme: Theme;
  i18n: InlineMenuPasswordGeneratorI18n;
  handleFillPassword: (e: Event) => void;
  handleRefreshPassword: (e: Event) => void;
};

/**
 * Compact password suggestion menu matching AGY's "web-register" screen: a generation header, the
 * colorized password with a fill action, and a footer that regenerates or states the password stays
 * on the device.
 */
export function InlineMenuPasswordGenerator({
  password,
  headingText,
  theme,
  i18n,
  handleFillPassword,
  handleRefreshPassword,
}: InlineMenuPasswordGeneratorProps) {
  const colors = inlineMenuColors(theme);

  const onFill = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleFillPassword(event);
    }
  };

  const onRefresh = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleRefreshPassword(event);
    }
  };

  const onFillKeyUp = (event: KeyboardEvent) => {
    if (!isTrustedActionKey(event, "ArrowRight")) {
      return;
    }
    const target = (event.currentTarget ?? event.target) as HTMLElement | null;
    const root = (target?.closest('[data-testid="inline-menu-password-generator"]') ??
      target?.getRootNode?.() ??
      document) as Document | ShadowRoot | HTMLElement;
    root.querySelector<HTMLElement>(REFRESH_SELECTOR)?.focus();
  };

  const onRefreshKeyUp = (event: KeyboardEvent) => {
    if (!isTrustedActionKey(event, "ArrowLeft")) {
      return;
    }
    const target = (event.currentTarget ?? event.target) as HTMLElement | null;
    const root = (target?.closest('[data-testid="inline-menu-password-generator"]') ??
      target?.getRootNode?.() ??
      document) as Document | ShadowRoot | HTMLElement;
    root.querySelector<HTMLElement>(FILL_SELECTOR)?.focus();
  };

  return InlineMenuContainer({
    theme,
    dataTestId: "inline-menu-password-generator",
    children: html`
      ${InlineMenuHeader({
        theme,
        domain: i18n.generateHeading,
        contextText: "",
        showContext: false,
        showClose: false,
        i18n: { closeAria: i18n.closeAria, showAll: i18n.showAll },
      })}
      <div data-password-generator-actions>
        <button
          type="button"
          data-fill-generated-password
          data-inline-menu-focusable
          tabindex="-1"
          class=${fillButtonStyles(theme)}
          aria-label=${headingText}
          @click=${onFill}
          @keyup=${onFillKeyUp}
        >
          <span class=${wandIconStyles} aria-hidden="true">
            ${Wand({ theme, color: colors.brand })}
          </span>
          <span class=${contentStyles}>
            ${ColorizedPassword({ password, theme, i18n })}
            <span class=${descriptionStyles(theme)}>${i18n.description}</span>
          </span>
          <span class=${fillLabelStyles(theme)} aria-hidden="true">${i18n.fill}</span>
        </button>
      </div>
      ${InlineMenuFooter({
        theme,
        actions: [
          {
            text: i18n.regenerate,
            aria: i18n.regeneratePassword,
            icon: Refresh({ theme, color: colors.brand }),
            testId: "refresh-generated-password",
            handleAction: onRefresh,
            handleKeyUp: onRefreshKeyUp,
          },
        ],
        note: { text: i18n.localOnly },
      })}
    `,
  });
}

function isTrustedActionKey(
  event: KeyboardEvent,
  arrowCode: "ArrowLeft" | "ArrowRight",
): event is KeyboardEvent & { target: HTMLElement } {
  return (
    EventSecurity.isEventTrusted(event) &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.target instanceof HTMLElement &&
    event.code === arrowCode
  );
}

const fillButtonStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 40px;
    margin: 0;
    padding: 5px 8px;
    border: 0;
    background: ${colors.surfaceAlt};
    color: inherit;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 120ms ease;

    :hover {
      background: ${colors.hover};
    }

    :active {
      background: ${colors.brandSoft};
    }

    :focus-visible {
      outline: 2px solid ${colors.brand};
      outline-offset: -2px;
    }
  `;
};

const wandIconStyles = css`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;

  > svg {
    width: 15px;
    height: 15px;
  }
`;

const contentStyles = css`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  text-align: left;
`;

const descriptionStyles = (theme: Theme) => css`
  overflow: hidden;
  color: ${inlineMenuColors(theme).textSubtle};
  font-size: 9.5px;
  line-height: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const fillLabelStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    height: 22px;
    padding: 0 9px;
    border-radius: 5px;
    background: ${colors.brandFill};
    color: #fff;
    font-size: 10.5px;
    font-weight: 600;
    line-height: 22px;
    white-space: nowrap;
  `;
};
