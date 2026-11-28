import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { I18n } from "../../common-types";
import { themes } from "../../constants/styles";
import { Check, Close } from "../../icons";

export type NotificationSaveConfirmationProps = {
  /** Localized header, e.g. "Login saved" / "Login updated". */
  headerMessage: string;
  /** Localized result line, e.g. "Encrypted into “Work” · auto-closes in 2 minutes". */
  confirmationMessage: string;
  itemName: string;
  /** Submitted account shown after the entry name, matching AGY's "Name · username" line. */
  username?: string;
  i18n: I18n;
  notificationTestId: string;
  theme?: Theme;
  handleCloseNotification: (e: Event) => void;
  /** Opens the saved entry for editing; omitted when the entry id is unknown. */
  handleEditEntry?: (e: Event) => void;
};

/**
 * Compact green success card shown after a login is saved or updated, matching the AGY
 * "web-save-confirm" screen: a success-tinted header, the entry name and account, the folder it
 * was encrypted into, and Add 2FA / Edit entry and Done actions.
 */
export function NotificationSaveConfirmation({
  confirmationMessage,
  handleCloseNotification,
  handleEditEntry,
  headerMessage,
  i18n,
  itemName,
  username,
  notificationTestId,
  theme = ThemeTypes.Light,
}: NotificationSaveConfirmationProps) {
  const identity = username ? `${itemName} · ${username}` : itemName;
  const onClose = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleCloseNotification(event);
    }
  };
  const onEdit = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleEditEntry?.(event);
    }
  };

  return html`
    <div
      data-testid="${notificationTestId}"
      class=${cardStyles(theme)}
      role="dialog"
      aria-label=${headerMessage}
    >
      <div class=${headerStyles(theme)}>
        <span class=${successIconStyles(theme)}>
          ${Check({ theme, color: themes[theme].text.contrast })}
        </span>
        <span class=${headerTitleStyles(theme)}>${headerMessage}</span>
        <button
          type="button"
          class=${closeButtonStyles(theme)}
          aria-label=${i18n.close}
          @click=${onClose}
        >
          ${Close({ theme, color: themes[theme].text.muted })}
        </button>
      </div>
      <div class=${bodyStyles}>
        <span class=${itemNameStyles}>${identity}</span>
        <span class=${messageStyles(theme)}>${confirmationMessage}</span>
      </div>
      <div class=${footerStyles}>
        ${
          handleEditEntry
            ? html`
                <button type="button" class=${secondaryButtonStyles(theme)} @click=${onEdit}>
                  ${i18n.notificationAddTotp}
                </button>
              `
            : nothing
        }
        <button type="button" class=${primaryButtonStyles(theme)} @click=${onClose}>
          ${i18n.done}
        </button>
      </div>
    </div>
  `;
}

const cardStyles = (theme: Theme) => css`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 316px;
  overflow: hidden;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: 9px;
  background-color: ${themes[theme].background.DEFAULT};
  box-shadow: -2px 4px 6px 0 #0000001a;
  color: ${themes[theme].text.main};
  font-family: Inter, sans-serif;
`;

const headerStyles = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-bottom: 1px solid ${themes[theme].secondary["100"]};
  background-color: ${themes[theme].success["100"]};
`;

const successIconStyles = (theme: Theme) => css`
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: ${themes[theme].success["600"]};
  color: ${themes[theme].text.contrast};

  > svg {
    width: 9px;
    height: 9px;
  }
`;

const headerTitleStyles = (theme: Theme) => css`
  overflow: hidden;
  color: ${themes[theme].success["600"]};
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const closeButtonStyles = (theme: Theme) => css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background-color: transparent;
  cursor: pointer;

  :hover {
    background-color: ${themes[theme].secondary["100"]};
  }

  > svg {
    width: 12px;
    height: 12px;
  }
`;

const bodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px 10px;
`;

const itemNameStyles = css`
  overflow: hidden;
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const messageStyles = (theme: Theme) => css`
  font-size: 10px;
  color: ${themes[theme].text.muted};
`;

const footerStyles = css`
  display: flex;
  gap: 5px;
  padding: 0 10px 9px;
`;

const compactButtonStyles = (theme: Theme) => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 7px;
  overflow: hidden;
  border-radius: 5px;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  :focus-visible {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 1px;
  }
`;

const primaryButtonStyles = (theme: Theme) => css`
  ${compactButtonStyles(theme)}

  flex: none;
  padding: 0 12px;
  border: 1px solid ${theme === "dark" ? "#2563eb" : themes[theme].primary["600"]};
  background-color: ${theme === "dark" ? "#2563eb" : themes[theme].primary["600"]};
  color: #fff;

  :hover {
    border-color: ${theme === "dark" ? "#1d4ed8" : themes[theme].primary["700"]};
    background-color: ${theme === "dark" ? "#1d4ed8" : themes[theme].primary["700"]};
  }
`;

const secondaryButtonStyles = (theme: Theme) => css`
  ${compactButtonStyles(theme)}

  flex: 1;
  border: 1px solid ${themes[theme].secondary["300"]};
  background-color: ${themes[theme].background.DEFAULT};
  color: ${themes[theme].text.main};

  :hover {
    background-color: ${themes[theme].background.alt};
  }
`;
