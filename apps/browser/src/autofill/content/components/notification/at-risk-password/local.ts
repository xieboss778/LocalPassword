import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { I18n } from "../../common-types";
import { themes } from "../../constants/styles";
import { Close, Wand } from "../../icons";

export type LocalAtRiskNotificationProps = {
  /** Which local health rule flagged the saved password. */
  kind: "reused" | "weak";
  /** Number of saved logins sharing the password, including the matched entry. */
  sharedCount: number;
  /** The matched saved entry, for example "Northwind". */
  entryName: string;
  username: string;
  i18n: I18n;
  notificationTestId: string;
  theme?: Theme;
  /** Closes the card and records that the warning was dismissed. */
  handleCloseNotification: (e: Event) => void;
  /** Opens the site's change-password page or the entry editor. */
  handleFixPassword: (e: Event) => void;
};

/**
 * Compact at-risk warning matching AGY's "web-at-risk" screen: the amber header states the
 * account is at risk, the body names the saved entry and the local rule that flagged it, and the
 * footer offers to change the password now or later.
 */
export function LocalAtRiskNotification({
  kind,
  sharedCount,
  entryName,
  username,
  i18n,
  notificationTestId,
  theme = ThemeTypes.Light,
  handleCloseNotification,
  handleFixPassword,
}: LocalAtRiskNotificationProps) {
  const riskChip =
    kind === "reused"
      ? chrome.i18n.getMessage("reusedPasswordsPlaces", [String(sharedCount)])
      : i18n.weakPasswordLabel || i18n.weakPasswordsTitle;
  const riskMessage = chrome.i18n.getMessage(
    kind === "reused" ? "passwordReusedForSeveralLogins" : "passwordTooShortOrSimple",
  );
  const entryLabel = username ? `${entryName} · ${username}` : entryName;
  const onClose = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleCloseNotification(event);
    }
  };
  const onFix = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleFixPassword(event);
    }
  };

  return html`
    <div
      data-testid="${notificationTestId}"
      class=${cardStyles(theme)}
      role="dialog"
      aria-label=${i18n.atRiskPassword}
    >
      <div class=${headerStyles(theme)}>
        <span class=${warningAvatarStyles(theme)} aria-hidden="true">!</span>
        <span class=${headerTitleStyles}>${i18n.notificationAtRiskHeading}</span>
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
        <span class=${riskChipStyles(theme)}>${riskChip}</span>
        <span class=${entryStyles}>
          <span class=${entryTitleStyles}>${entryLabel}</span>
          <span class=${riskMessageStyles(theme)}>${riskMessage}</span>
        </span>
      </div>
      <div class=${footerStyles}>
        <button
          type="button"
          data-testid="at-risk-fix-password"
          class=${primaryButtonStyles(theme)}
          @click=${onFix}
        >
          <span class=${footerIconStyles} aria-hidden="true">
            ${Wand({ theme, color: "#fff" })}
          </span>
          <span>${i18n.changePassword}</span>
        </button>
        <button
          type="button"
          data-testid="at-risk-later"
          class=${secondaryButtonStyles(theme)}
          @click=${onClose}
        >
          ${i18n.later}
        </button>
      </div>
    </div>
  `;
}

const cardStyles = (theme: Theme) => css`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 326px;
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
  background-color: ${themes[theme].background.alt};
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
`;

const warningAvatarStyles = (theme: Theme) => css`
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background-color: ${theme === "dark" ? "rgba(245, 158, 11, 0.2)" : themes[theme].warning["100"]};
  color: ${theme === "dark" ? "#fbbf24" : themes[theme].warning["700"]};
  font-size: 10px;
  font-weight: 700;
`;

const headerTitleStyles = css`
  overflow: hidden;
  text-overflow: ellipsis;
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
  align-items: flex-start;
  gap: 8px;
  padding: 9px 10px 10px;
`;

const riskChipStyles = (theme: Theme) => css`
  flex: none;
  padding: 1px 6px;
  border-radius: 999px;
  background-color: ${theme === "dark" ? "rgba(255, 78, 99, 0.16)" : themes[theme].danger["100"]};
  color: ${theme === "dark" ? "#ff8091" : themes[theme].danger["600"]};
  font-size: 9px;
  font-weight: 600;
  line-height: 13px;
  white-space: nowrap;
`;

const entryStyles = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const entryTitleStyles = css`
  overflow: hidden;
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const riskMessageStyles = (theme: Theme) => css`
  color: ${themes[theme].text.muted};
  font-size: 10px;
  line-height: 13px;
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
  gap: 4px;
  height: 22px;
  padding: 0 9px;
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

  flex: 1;
  border: 1px solid ${theme === "dark" ? "#2563eb" : themes[theme].primary["600"]};
  background-color: ${theme === "dark" ? "#2563eb" : themes[theme].primary["600"]};
  color: #fff;

  :hover {
    border-color: ${theme === "dark" ? "#1d4ed8" : themes[theme].primary["700"]};
    background-color: ${theme === "dark" ? "#1d4ed8" : themes[theme].primary["700"]};
  }
`;

const footerIconStyles = css`
  display: inline-flex;

  > svg {
    width: 11px;
    height: 11px;
  }
`;

const secondaryButtonStyles = (theme: Theme) => css`
  ${compactButtonStyles(theme)}

  flex: none;
  border: 1px solid ${themes[theme].secondary["300"]};
  background-color: ${themes[theme].background.DEFAULT};
  color: ${themes[theme].text.main};

  :hover {
    background-color: ${themes[theme].background.alt};
  }
`;
