import { css } from "@emotion/css";
import { html, nothing, TemplateResult } from "lit";

import { Theme } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../utils/event-security";

import { inlineMenuColors, inlineMenuFocusRing } from "./menu-styles";

export type InlineMenuFooterAction = {
  text: string;
  aria: string;
  icon: TemplateResult;
  testId?: string;
  handleAction: (event: Event) => void;
  /** Keyboard shortcut for moving between footer actions and the menu's primary row. */
  handleKeyUp?: (event: KeyboardEvent) => void;
};

export type InlineMenuFooterProps = {
  theme: Theme;
  actions?: InlineMenuFooterAction[];
  /** Right-aligned statement, for example the read-only domain disclosure. */
  note?: {
    text: string;
    icon?: TemplateResult;
  };
  /** Keyboard hints rendered in a dedicated strip below the footer. */
  hint?: string | { text: string; right?: string };
};

export function InlineMenuFooter({ theme, actions, note, hint }: InlineMenuFooterProps) {
  const handleAction = (action: InlineMenuFooterAction) => (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      action.handleAction(event);
    }
  };
  const hasFooter = !!actions?.length || !!note;

  return html`
    ${
      hasFooter
        ? html`<div class=${footerStyles(theme)}>
            <span class=${actionsStyles(theme)}>
              ${
                actions?.length
                  ? actions.map(
                      (action) =>
                        html`<button
                          type="button"
                          tabindex="-1"
                          data-inline-menu-focusable
                          data-testid=${action.testId ?? nothing}
                          class=${actionStyles(theme)}
                          aria-label=${action.aria}
                          @click=${handleAction(action)}
                          @keyup=${action.handleKeyUp}
                        >
                          <span class=${footerIconStyles} aria-hidden="true">${action.icon}</span>
                          <span>${action.text}</span>
                        </button>`,
                    )
                  : note
                    ? noteTemplate(theme, note)
                    : nothing
              }
            </span>
            ${actions?.length && note ? noteTemplate(theme, note, true) : nothing}
          </div>`
        : nothing
    }
    ${hint ? hintTemplate(theme, hint) : nothing}
  `;
}

function hintTemplate(theme: Theme, hint: NonNullable<InlineMenuFooterProps["hint"]>) {
  const label = typeof hint === "string" ? { text: hint, right: undefined } : hint;

  return html`
    <div class=${keyboardStyles(theme)}>
      <span>${label.text}</span>
      ${label.right ? html`<span class=${keyboardRightStyles}>${label.right}</span>` : nothing}
    </div>
  `;
}

function noteTemplate(
  theme: Theme,
  note: NonNullable<InlineMenuFooterProps["note"]>,
  rightAligned = false,
) {
  return html`<span class=${`${noteStyles(theme)}${rightAligned ? " is-right" : ""}`}>
    ${note.icon ? html`<span class=${footerIconStyles} aria-hidden="true">${note.icon}</span>` : nothing}
    <span>${note.text}</span>
  </span>`;
}

const footerStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 26px;
    padding: 0 8px;
    border-top: 1px solid ${colors.borderLight};
    background: ${colors.surfaceAlt};
    color: ${colors.textSubtle};
    font-size: 9.5px;
    line-height: 12px;
  `;
};

const actionsStyles = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;

  > button:first-child {
    margin-left: -4px;
  }
`;

const actionStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 4px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: ${colors.brand};
    font-family: inherit;
    font-size: 9.5px;
    font-weight: 550;
    line-height: 12px;
    white-space: nowrap;
    cursor: pointer;

    :hover {
      background: ${colors.brandSoft};
    }

    ${inlineMenuFocusRing(colors.brand)}
  `;
};

const noteStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    color: ${colors.textSubtle};
    white-space: nowrap;

    &.is-right {
      margin-left: auto;
    }
  `;
};

const footerIconStyles = css`
  display: inline-flex;

  svg {
    width: 11px;
    height: 11px;
  }
`;

const keyboardStyles = (theme: Theme) => {
  const colors = inlineMenuColors(theme);

  return css`
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 20px;
    padding: 0 8px;
    border-top: 1px solid ${colors.borderLight};
    background: ${colors.surfaceAlt};
    color: ${colors.textSubtle};
    font-size: 9px;
    line-height: 12px;
    white-space: nowrap;
  `;
};

const keyboardRightStyles = css`
  margin-left: auto;
`;
