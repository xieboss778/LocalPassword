import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { NotificationCipherData } from "../../cipher/types";
import { I18n } from "../../common-types";
import { themes } from "../../constants/styles";
import { Check, Close } from "../../icons";

/** Selected target for "save as a new entry" in the change notification picker. */
export const ChangeNotificationNewEntryTarget = "new-entry";

export type NotificationChangeContainerProps = {
  /**
   * The ciphers matched to the submitted credentials. With more than one, the card opens
   * directly in picker mode so the user never has an entry overwritten silently.
   */
  ciphers: NotificationCipherData[];
  domain: string;
  /** Whether the candidate picker is shown instead of the single-entry summary. */
  expanded: boolean;
  /**
   * The number of entries already saved for this page, including entries that did not match the
   * submitted password. Used to number the "save as new entry" option after the vault's count.
   * Absent when the vault was locked, in which case the option is numbered after the candidates.
   */
  existingEntryCount?: number;
  i18n: I18n;
  notificationTestId: string;
  /** The selected cipher id, or {@link ChangeNotificationNewEntryTarget}. */
  selectedTarget: string;
  theme: Theme;
  handleCloseNotification: (e: Event) => void;
  handleCommit: (e: Event) => void;
  handleSelectTarget: (target: string, e: Event) => void;
  handleToggleExpanded: (e: Event) => void;
};

/** Whether the card shows the candidate picker for this notification. */
export function changeNotificationShowsPicker(
  ciphers: NotificationCipherData[],
  expanded: boolean,
): boolean {
  return expanded || ciphers.length > 1;
}

/** Header line for the change card: the site's entries, or the single matched item. */
export function getChangeNotificationHeaderMessage(
  ciphers: NotificationCipherData[],
  domain: string,
  expanded: boolean,
): string {
  return changeNotificationShowsPicker(ciphers, expanded)
    ? chrome.i18n.getMessage("notificationMultiSaveHeader", [domain])
    : chrome.i18n.getMessage("notificationChangeHeader", [ciphers[0]?.name ?? domain]);
}

/** Commit button label for the selected cipher, or for saving a new entry. */
export function getChangeNotificationPrimaryLabel(
  ciphers: NotificationCipherData[],
  selectedTarget: string,
  i18n: I18n,
  expanded: boolean,
  existingEntryCount?: number,
): string {
  if (!changeNotificationShowsPicker(ciphers, expanded)) {
    const version = ciphers[0]?.versionCount;
    return version == null
      ? i18n.notificationUpdate
      : chrome.i18n.getMessage("notificationUpdateVersion", [String(version + 1)]);
  }

  if (selectedTarget === ChangeNotificationNewEntryTarget) {
    return chrome.i18n.getMessage("notificationMultiSaveCreate", [
      `${(existingEntryCount ?? ciphers.length) + 1}`,
    ]);
  }

  const selectedCipher = ciphers.find((cipher) => cipher.id === selectedTarget);
  return selectedCipher?.login?.username
    ? chrome.i18n.getMessage("notificationMultiSaveUpdate", [selectedCipher.login.username])
    : chrome.i18n.getMessage("notificationMultiSaveUpdateGeneric");
}

/** Relative hint for the picker row, e.g. "used 2 min ago"; omitted when never filled. */
function lastUsedHint(lastUsedAt?: number): string | undefined {
  if (lastUsedAt == null) {
    return undefined;
  }
  const minutes = Math.floor((Date.now() - lastUsedAt) / 60_000);
  if (minutes < 1) {
    return chrome.i18n.getMessage("notificationLastUsedJustNow");
  }
  if (minutes < 60) {
    return chrome.i18n.getMessage("notificationLastUsedMinutes", [String(minutes)]);
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return chrome.i18n.getMessage("notificationLastUsedHours", [String(hours)]);
  }
  return chrome.i18n.getMessage("notificationLastUsedDays", [String(Math.floor(hours / 24))]);
}

/** Revision marker for the picker row, e.g. "v3"; hidden for a never-edited entry. */
function versionHint(cipher: NotificationCipherData): string | undefined {
  return cipher.versionCount != null && cipher.versionCount > 1
    ? `v${cipher.versionCount}`
    : undefined;
}

/**
 * Compact update card for a detected password change. A single matched entry gets a focused
 * summary with an update action; several matched entries open the AGY picker where one entry is
 * updated, or the submitted credentials are recorded as a new entry.
 */
export function NotificationChangeContainer({
  ciphers,
  domain,
  existingEntryCount,
  expanded,
  i18n,
  notificationTestId,
  selectedTarget,
  theme = ThemeTypes.Light,
  handleCloseNotification,
  handleCommit,
  handleSelectTarget,
  handleToggleExpanded,
}: NotificationChangeContainerProps) {
  const selectedIsNewEntry = selectedTarget === ChangeNotificationNewEntryTarget;
  const newEntryNumber = `${(existingEntryCount ?? ciphers.length) + 1}`;
  const showPicker = changeNotificationShowsPicker(ciphers, expanded);
  const headerMessage = getChangeNotificationHeaderMessage(ciphers, domain, expanded);
  const primaryButtonText = getChangeNotificationPrimaryLabel(
    ciphers,
    selectedTarget,
    i18n,
    expanded,
    existingEntryCount,
  );

  const selectTarget = (target: string, event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleSelectTarget(target, event);
    }
  };

  const commit = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleCommit(event);
    }
  };

  const toggleExpanded = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleToggleExpanded(event);
    }
  };

  const closeNotification = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleCloseNotification(event);
    }
  };

  const radioTargets = [...ciphers.map((cipher) => cipher.id), ChangeNotificationNewEntryTarget];
  const onRadioKeyDown = (event: KeyboardEvent) => {
    if (
      !EventSecurity.isEventTrusted(event) ||
      (event.key !== "ArrowDown" && event.key !== "ArrowUp")
    ) {
      return;
    }
    const currentIndex = radioTargets.indexOf(selectedTarget);
    if (currentIndex === -1 || radioTargets.length < 2) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowDown"
        ? (currentIndex + 1) % radioTargets.length
        : (currentIndex - 1 + radioTargets.length) % radioTargets.length;
    handleSelectTarget(radioTargets[nextIndex], event);
  };

  return html`
    <div
      data-testid="${notificationTestId}"
      class=${changeCardStyles({ expanded: showPicker, theme })}
      role="dialog"
      aria-label=${headerMessage}
    >
      <div class=${cardHeaderStyles(theme)}>
        <span class=${avatarStyles(theme)}>LP</span>
        <span class=${headerTitleStyles}>${headerMessage}</span>
        <button
          type="button"
          class=${closeButtonStyles(theme)}
          aria-label=${i18n.close}
          @click=${closeNotification}
        >
          ${Close({ theme, color: themes[theme].text.muted })}
        </button>
      </div>
      ${
        showPicker
          ? html`
              <div class=${pickerDescriptionStyles(theme)}>
                ${chrome.i18n.getMessage("notificationMultiSaveDesc")}
              </div>
              <div class=${pickerRowsStyles} role="radiogroup" @keydown=${onRadioKeyDown}>
                ${ciphers.map((cipher) => {
                  const selected = cipher.id === selectedTarget;
                  const username = cipher.login?.username;
                  return html`
                    <button
                      type="button"
                      class=${pickerRowStyles({ selected, theme })}
                      role="radio"
                      aria-checked=${selected ? "true" : "false"}
                      @click=${(event: Event) => selectTarget(cipher.id, event)}
                    >
                      <span class=${checkStyles({ selected, theme })}>
                        ${selected ? Check({ theme, color: themes[theme].text.contrast }) : nothing}
                      </span>
                      <span class=${rowInfoStyles}>
                        <span class=${rowTitleStyles}>${username || cipher.name}</span>
                        <span class=${rowSubtitleStyles(theme)}>
                          ${
                            username
                              ? [cipher.name, lastUsedHint(cipher.lastUsedAt), versionHint(cipher)]
                                  .filter(Boolean)
                                  .join(" · ")
                              : chrome.i18n.getMessage("notificationMultiSaveNoUsername")
                          }
                        </span>
                      </span>
                    </button>
                  `;
                })}
                <button
                  type="button"
                  class=${pickerRowStyles({ selected: selectedIsNewEntry, theme })}
                  role="radio"
                  aria-checked=${selectedIsNewEntry ? "true" : "false"}
                  @click=${(event: Event) => selectTarget(ChangeNotificationNewEntryTarget, event)}
                >
                  <span class=${checkStyles({ selected: selectedIsNewEntry, theme })}>
                    ${
                      selectedIsNewEntry
                        ? Check({ theme, color: themes[theme].text.contrast })
                        : nothing
                    }
                  </span>
                  <span class=${rowInfoStyles}>
                    <span class=${rowTitleStyles}>
                      ${chrome.i18n.getMessage("notificationMultiSaveNewEntry", [newEntryNumber])}
                    </span>
                    <span class=${rowSubtitleStyles(theme)}>
                      ${chrome.i18n.getMessage("notificationMultiSaveNewEntryDesc")}
                    </span>
                  </span>
                </button>
              </div>
            `
          : html`
              <div class=${summaryStyles(theme)}>
                <div class=${summaryInfoStyles}>
                  <div class=${rowTitleStyles}>
                    ${ciphers[0]?.login?.username || ciphers[0]?.name || domain}
                  </div>
                  <div class=${rowSubtitleStyles(theme)}>
                    ${
                      ciphers[0]?.versionCount != null
                        ? chrome.i18n.getMessage("notificationChangeBodyVersion", [
                            String(ciphers[0].versionCount),
                          ])
                        : chrome.i18n.getMessage("notificationChangeBodyDesc")
                    }
                  </div>
                </div>
              </div>
            `
      }
      <div class=${footerStyles}>
        <button type="button" class=${primaryButtonStyles(theme)} @click=${commit}>
          ${primaryButtonText}
        </button>
        ${
          showPicker
            ? nothing
            : html`
                <button
                  type="button"
                  class=${secondaryButtonStyles(theme)}
                  @click=${toggleExpanded}
                >
                  ${i18n.notificationChangeToggle}
                </button>
              `
        }
        <button type="button" class=${ghostButtonStyles(theme)} @click=${closeNotification}>
          ${i18n.notificationChangeIgnore}
        </button>
      </div>
    </div>
  `;
}

const changeCardStyles = ({ expanded, theme }: { expanded: boolean; theme: Theme }) => css`
  position: absolute;
  top: 8px;
  right: 8px;
  width: ${expanded ? "320px" : "294px"};
  overflow: hidden;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: 9px;
  background-color: ${themes[theme].background.DEFAULT};
  box-shadow: -2px 4px 6px 0 #0000001a;
  color: ${themes[theme].text.main};
  font-family: Inter, sans-serif;
`;

const cardHeaderStyles = (theme: Theme) => css`
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

const avatarStyles = (theme: Theme) => css`
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background-color: ${theme === "dark" ? "#2563eb" : themes[theme].primary["600"]};
  color: #fff;
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.2px;
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

const pickerDescriptionStyles = (theme: Theme) => css`
  padding: 8px 10px 6px;
  font-size: 10px;
  color: ${themes[theme].text.muted};
`;

const pickerRowsStyles = css`
  display: grid;
  gap: 4px;
  padding: 0 8px 6px;
`;

const pickerRowStyles = ({ selected, theme }: { selected: boolean; theme: Theme }) => css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid ${selected ? themes[theme].primary["600"] : themes[theme].secondary["100"]};
  border-radius: 6px;
  background-color: ${selected ? themes[theme].primary["100"] : themes[theme].background.DEFAULT};
  color: ${themes[theme].text.main};
  font-family: inherit;
  text-align: left;
  cursor: pointer;

  :hover {
    background-color: ${selected ? themes[theme].primary["100"] : themes[theme].background.alt};
  }
`;

const checkStyles = ({ selected, theme }: { selected: boolean; theme: Theme }) => css`
  display: grid;
  place-items: center;
  flex: none;
  width: 13px;
  height: 13px;
  border: ${selected ? "0" : `1px solid ${themes[theme].secondary["300"]}`};
  border-radius: 3px;
  background-color: ${selected ? themes[theme].primary["600"] : themes[theme].background.DEFAULT};

  > svg {
    width: 9px;
    height: 9px;
  }
`;

const rowInfoStyles = css`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const rowTitleStyles = css`
  overflow: hidden;
  font-size: 11.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const rowSubtitleStyles = (theme: Theme) => css`
  overflow: hidden;
  margin-top: 1px;
  font-size: 10px;
  color: ${themes[theme].text.muted};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const summaryStyles = (theme: Theme) => css`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid ${themes[theme].secondary["100"]};
`;

const summaryInfoStyles = css`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const footerStyles = css`
  display: flex;
  gap: 5px;
  padding: 8px 10px 9px;
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

  flex: 1;
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

  border: 1px solid ${themes[theme].secondary["300"]};
  background-color: ${themes[theme].background.DEFAULT};
  color: ${themes[theme].text.main};

  :hover {
    background-color: ${themes[theme].background.alt};
  }
`;

const ghostButtonStyles = (theme: Theme) => css`
  ${compactButtonStyles(theme)}

  border: 1px solid transparent;
  background-color: transparent;
  color: ${themes[theme].text.muted};

  :hover {
    background-color: ${themes[theme].background.alt};
    color: ${themes[theme].text.main};
  }
`;
