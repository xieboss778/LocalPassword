import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme, ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { NotificationCipherData } from "../../cipher/types";
import { FolderView, I18n } from "../../common-types";
import { themes } from "../../constants/styles";
import { Close } from "../../icons";
import { selectedFolder as selectedFolderSignal } from "../../signals/selected-folder";

export type NotificationAddContainerProps = {
  /** The drafted login built from the submitted form. */
  ciphers: NotificationCipherData[];
  domain: string;
  folders?: FolderView[];
  i18n: I18n;
  notificationTestId: string;
  theme?: Theme;
  handleCloseNotification: (e: Event) => void;
  handleSaveAction: (e: Event) => void;
  /** Adds the site to the never-save list and closes the card. */
  handleNeverSave: (e: Event) => void;
};

/** Writes the chosen folder id into the signal read by the save handler. */
export function handleFolderSelection(e: Event) {
  const target = e.target as HTMLSelectElement | null;
  if (target && typeof target.value === "string") {
    selectedFolderSignal.set(target.value);
  }
}

/**
 * Compact first-save card matching AGY's "web-save-new" screen: the drafted account, a folder
 * choice, and Save / Never-for-this-site actions.
 */
export function NotificationAddContainer({
  ciphers,
  domain,
  folders = [],
  handleCloseNotification,
  handleNeverSave,
  handleSaveAction,
  i18n,
  notificationTestId,
  theme = ThemeTypes.Light,
}: NotificationAddContainerProps) {
  const draft = ciphers[0];
  const title = draft?.login?.username || draft?.name || domain;
  const header = domain
    ? chrome.i18n.getMessage("notificationAddHeading", [domain])
    : i18n.saveLogin;
  const namedFolders = folders.filter((folder) => folderOptionValue(folder) !== "0");
  const selectedFolder = selectedFolderSignal.get();
  const showFolderSelect = namedFolders.length > 0;
  const selectedFolderName = namedFolders.find(
    (folder) => folderOptionValue(folder) === selectedFolder,
  )?.name;
  const subtitle = !domain
    ? i18n.notificationAddDesc
    : chrome.i18n.getMessage(
        showFolderSelect ? "notificationAddSubtitleChoice" : "notificationAddSubtitleNoFolder",
        [domain],
      );
  const saveLabel = selectedFolderName
    ? chrome.i18n.getMessage("notificationAddSaveToFolder", [selectedFolderName])
    : i18n.notificationAddSave;

  /** The card is a plain Lit render, so the save label follows the select by hand. */
  const onFolderChange = (event: Event) => {
    handleFolderSelection(event);
    const value = (event.target as HTMLSelectElement | null)?.value ?? "0";
    const name = namedFolders.find((folder) => folderOptionValue(folder) === value)?.name;
    const nextLabel = name
      ? chrome.i18n.getMessage("notificationAddSaveToFolder", [name])
      : i18n.notificationAddSave;
    const card = (event.currentTarget as HTMLElement | null)?.closest("[data-notification-add]");
    const saveButton = card?.querySelector<HTMLButtonElement>("[data-save-action]");
    if (saveButton) {
      saveButton.textContent = nextLabel;
    }
  };

  const onClose = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleCloseNotification(event);
    }
  };
  const onSave = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleSaveAction(event);
    }
  };
  const onNeverSave = (event: Event) => {
    if (EventSecurity.isEventTrusted(event)) {
      handleNeverSave(event);
    }
  };

  return html`
    <div
      data-testid="${notificationTestId}"
      data-notification-add
      class=${cardStyles(theme)}
      role="dialog"
      aria-label=${header}
    >
      <div class=${headerStyles(theme)}>
        <span class=${avatarStyles(theme)}>LP</span>
        <span class=${headerTitleStyles}>${header}</span>
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
        <span class=${accountStyles}>
          <span class=${titleStyles}>${title}</span>
          <span class=${subtitleStyles(theme)}>${subtitle}</span>
        </span>
        ${
          showFolderSelect
            ? html`
                <select
                  class=${selectStyles(theme)}
                  aria-label=${i18n.folder}
                  @change=${onFolderChange}
                >
                  <option value="0" ?selected=${selectedFolder === "0"}>${i18n.noFolder}</option>
                  ${namedFolders.map((folder) => {
                    const value = folderOptionValue(folder);
                    return html`
                      <option value=${value} ?selected=${selectedFolder === value}>
                        ${folder.name}
                      </option>
                    `;
                  })}
                </select>
              `
            : nothing
        }
      </div>
      <div class=${footerStyles}>
        <button type="button" data-save-action class=${primaryButtonStyles(theme)} @click=${onSave}>
          ${saveLabel}
        </button>
        <button type="button" class=${secondaryButtonStyles(theme)} @click=${onNeverSave}>
          ${i18n.notificationNeverForSite}
        </button>
      </div>
    </div>
  `;
}

/** Folder ids are UUIDs; a missing or placeholder id means the item stays unfiled. */
export function folderOptionValue(folder: FolderView): string {
  return folder.id && folder.id.length > 1 ? folder.id : "0";
}

const cardStyles = (theme: Theme) => css`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 320px;
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

const bodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px 10px;
`;

const accountStyles = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const titleStyles = css`
  overflow: hidden;
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const subtitleStyles = (theme: Theme) => css`
  overflow: hidden;
  font-size: 10px;
  color: ${themes[theme].text.muted};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const selectStyles = (theme: Theme) => css`
  height: 22px;
  padding: 0 6px;
  border: 1px solid ${themes[theme].secondary["300"]};
  border-radius: 5px;
  background-color: ${themes[theme].background.DEFAULT};
  color: ${themes[theme].text.main};
  color-scheme: ${theme === "dark" ? "dark" : "light"};
  font-family: inherit;
  font-size: 10.5px;

  :focus-visible {
    outline: 2px solid ${themes[theme].primary["600"]};
    outline-offset: 1px;
  }
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

  flex: 1;
  border: 1px solid ${themes[theme].secondary["300"]};
  background-color: ${themes[theme].background.DEFAULT};
  color: ${themes[theme].text.main};

  :hover {
    background-color: ${themes[theme].background.alt};
  }
`;
