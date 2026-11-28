import { render } from "lit";

import { Theme, ThemeTypes } from "@localpass/common/platform/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import type { FolderView } from "@localpass/common/vault/models/view/folder.view";

import { NotificationCipherData } from "../content/components/cipher/types";
import { CollectionView, I18n, OrgView } from "../content/components/common-types";
import { NotificationAddContainer } from "../content/components/notification/add/container";
import { AtRiskNotification } from "../content/components/notification/at-risk-password/container";
import { LocalAtRiskNotification } from "../content/components/notification/at-risk-password/local";
import {
  ChangeNotificationNewEntryTarget,
  NotificationChangeContainer,
} from "../content/components/notification/change/container";
import { NotificationSaveConfirmation } from "../content/components/notification/confirmation/compact";
import { NotificationConfirmationContainer } from "../content/components/notification/confirmation/container";
import { NotificationContainer } from "../content/components/notification/container";
import { selectedCipher as selectedCipherSignal } from "../content/components/signals/selected-cipher";
import { selectedFolder as selectedFolderSignal } from "../content/components/signals/selected-folder";
import { selectedVault as selectedVaultSignal } from "../content/components/signals/selected-vault";
import { EventSecurity } from "../utils/event-security";

import {
  NotificationBarWindowMessageHandlers,
  NotificationBarWindowMessage,
  NotificationBarIframeInitData,
  NotificationType,
  NotificationTypes,
} from "./abstractions/notification-bar";
import { isAtRiskPasswordNotification } from "./utils";

let notificationBarIframeInitData: NotificationBarIframeInitData = {};
let windowMessageOrigin: string;
let autoCloseTimeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

type ChangeNotificationState = {
  ciphers: NotificationCipherData[];
  domain: string;
  /**
   * Number of login entries the vault held for the page when the change was detected, including
   * entries that did not match the submitted password. Numbers the new-entry option.
   */
  existingEntryCount?: number;
  expanded: boolean;
  i18n: I18n;
  notificationTestId: string;
  selectedTarget: string;
  theme: Theme;
};

let changeNotificationState: ChangeNotificationState | null = null;

const urlParams = new URLSearchParams(globalThis.location.search);
const trustedParentOrigin = urlParams.get("parentOrigin");

if (trustedParentOrigin) {
  windowMessageOrigin = trustedParentOrigin;
}

const notificationBarWindowMessageHandlers: NotificationBarWindowMessageHandlers = {
  initNotificationBar: ({ message }) => initNotificationBar(message),
  saveCipherAttemptCompleted: ({ message }) => handleSaveCipherConfirmation(message),
};

globalThis.addEventListener("load", load);

function load() {
  setupWindowMessageListener();
  globalThis.document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (EventSecurity.isEventTrusted(event) && event.key === "Escape") {
      handleCloseNotification(event);
    }
  });
  observeCardHeight();
  postMessageToParent({ command: "initNotificationBar" });
}

function observeCardHeight() {
  if (typeof ResizeObserver === "undefined") {
    return;
  }
  let lastHeight = 0;
  const syncHeight = () => {
    const card = globalThis.document.body.firstElementChild as HTMLElement | null;
    if (!card) {
      return;
    }
    const height = Math.max(60, Math.min(400, Math.ceil(card.getBoundingClientRect().height) + 18));
    if (height !== lastHeight) {
      lastHeight = height;
      sendPlatformMessage({ command: "bgAdjustNotificationBar", data: { height } });
    }
  };
  const observer = new ResizeObserver(syncHeight);
  observer.observe(globalThis.document.body);
  const mutationObserver = new MutationObserver(() => {
    globalThis.requestAnimationFrame(syncHeight);
  });
  mutationObserver.observe(globalThis.document.body, { childList: true, subtree: true });
}

/**
 * Builds the localized strings handed to the notification containers. Exported so tests can
 * assert the change card's action labels are present.
 */
export function getI18n() {
  return {
    appName: chrome.i18n.getMessage("appName"),
    atRiskPassword: chrome.i18n.getMessage("atRiskPassword"),
    changePassword: chrome.i18n.getMessage("changePassword"),
    close: chrome.i18n.getMessage("close"),
    collection: chrome.i18n.getMessage("collection"),
    done: chrome.i18n.getMessage("done"),
    folder: chrome.i18n.getMessage("folder"),
    loginSaveConfirmation: chrome.i18n.getMessage("loginSaveConfirmation"),
    loginSaveSuccess: chrome.i18n.getMessage("loginSaveSuccess"),
    loginUpdatedConfirmation: chrome.i18n.getMessage("loginUpdatedConfirmation"),
    loginUpdateSuccess: chrome.i18n.getMessage("loginUpdateSuccess"),
    loginUpdateTaskSuccess: chrome.i18n.getMessage("loginUpdateTaskSuccess"),
    loginUpdateTaskSuccessAdditional: chrome.i18n.getMessage("loginUpdateTaskSuccessAdditional"),
    later: chrome.i18n.getMessage("later"),
    myVault: chrome.i18n.getMessage("myVault"),
    never: chrome.i18n.getMessage("never"),
    newItem: chrome.i18n.getMessage("newItem"),
    nextSecurityTaskAction: chrome.i18n.getMessage("nextSecurityTaskAction"),
    noFolder: chrome.i18n.getMessage("noFolder"),
    notificationAddDesc: chrome.i18n.getMessage("notificationAddDesc"),
    notificationAddSave: chrome.i18n.getMessage("notificationAddSave"),
    notificationAddTotp: chrome.i18n.getMessage("notificationAddTotp"),
    notificationAtRiskHeading: chrome.i18n.getMessage("notificationAtRiskHeading"),
    notificationNeverForSite: chrome.i18n.getMessage("notificationNeverForSite"),
    notificationChangeDesc: chrome.i18n.getMessage("notificationChangeDesc"),
    notificationChangeIgnore: chrome.i18n.getMessage("notificationChangeIgnore"),
    notificationChangeToggle: chrome.i18n.getMessage("notificationChangeToggle"),
    notificationEdit: chrome.i18n.getMessage("edit"),
    notificationEditTooltip: chrome.i18n.getMessage("notificationEditTooltip"),
    notificationLoginSaveConfirmation: chrome.i18n.getMessage("notificationLoginSaveConfirmation"),
    notificationLoginUpdatedConfirmation: chrome.i18n.getMessage(
      "notificationLoginUpdatedConfirmation",
    ),
    notificationSaveConfirmed: chrome.i18n.getMessage("notificationSaveConfirmed"),
    notificationUnlock: chrome.i18n.getMessage("notificationUnlock"),
    notificationUnlockDesc: chrome.i18n.getMessage("notificationUnlockDesc"),
    notificationUpdate: chrome.i18n.getMessage("notificationChangeSave"),
    notificationViewAria: chrome.i18n.getMessage("notificationViewAria"),
    saveAction: chrome.i18n.getMessage("notificationAddSave"),
    saveAsNewLoginAction: chrome.i18n.getMessage("saveAsNewLoginAction"),
    saveFailure: chrome.i18n.getMessage("saveFailure"),
    saveFailureDetails: chrome.i18n.getMessage("saveFailureDetails"),
    saveLogin: chrome.i18n.getMessage("saveLogin"),
    typeLogin: chrome.i18n.getMessage("typeLogin"),
    unlockToSave: chrome.i18n.getMessage("unlockToSave"),
    updateLogin: chrome.i18n.getMessage("updateLogin"),
    updateLoginAction: chrome.i18n.getMessage("updateLoginAction"),
    vault: chrome.i18n.getMessage("vault"),
    view: chrome.i18n.getMessage("view"),
    weakPasswordLabel: chrome.i18n.getMessage("weakPasswordLabel"),
    weakPasswordsTitle: chrome.i18n.getMessage("weakPasswordsTitle"),
  };
}

/**
 * Returns the localized header message for the notification bar based on the notification type.
 *
 * @returns The localized header message string, or undefined if the type is not recognized.
 */
export function getNotificationHeaderMessage(i18n: I18n, type?: NotificationType) {
  return type
    ? {
        [NotificationTypes.Add]: i18n.saveLogin,
        [NotificationTypes.Change]: i18n.updateLogin,
        [NotificationTypes.Unlock]: i18n.unlockToSave,
        [NotificationTypes.AtRiskPassword]: i18n.atRiskPassword,
      }[type]
    : undefined;
}

/**
 * Returns the localized header message for the confirmation message bar based on the notification type.
 *
 * @returns The localized header message string, or undefined if the type is not recognized.
 */
export function getConfirmationHeaderMessage(i18n: I18n, type?: NotificationType, error?: string) {
  if (error) {
    return i18n.saveFailure;
  }

  return type
    ? {
        [NotificationTypes.Add]: i18n.notificationSaveConfirmed,
        [NotificationTypes.Change]: i18n.loginUpdateSuccess,
        [NotificationTypes.Unlock]: "",
        [NotificationTypes.AtRiskPassword]: "",
      }[type]
    : undefined;
}

/**
 * Appends the header message to the document title.
 * If the header message is already present, it avoids duplication.
 */
export function appendHeaderMessageToTitle(headerMessage?: string) {
  if (!headerMessage) {
    return;
  }
  const baseTitle = document.title.split(" - ")[0];
  document.title = `${baseTitle} - ${headerMessage}`;
}

/**
 * Determines the effective notification type to use based on initialization data.
 *
 * If the vault is locked, the notification type will be set to `Unlock`.
 * Otherwise, the type provided in the init data is returned.
 *
 * @returns The resolved `NotificationType` to be used for rendering logic.
 */
function resolveNotificationType(initData: NotificationBarIframeInitData): NotificationType {
  if (initData.isVaultLocked) {
    return NotificationTypes.Unlock;
  }

  return initData.type as NotificationType;
}

/**
 * Returns the appropriate test ID based on the resolved notification type.
 *
 * @param type - The resolved NotificationType.
 * @param isConfirmation - Optional flag for confirmation vs. notification container.
 */
export function getNotificationTestId(
  notificationType: NotificationType,
  isConfirmation = false,
): string {
  if (isConfirmation) {
    return "confirmation-notification-bar";
  }

  return {
    [NotificationTypes.Unlock]: "unlock-notification-bar",
    [NotificationTypes.Add]: "save-notification-bar",
    [NotificationTypes.Change]: "update-notification-bar",
    [NotificationTypes.AtRiskPassword]: "at-risk-notification-bar",
  }[notificationType];
}

export async function initNotificationBar(message: NotificationBarWindowMessage) {
  const { initData } = message;
  if (!initData) {
    return;
  }

  clearAutoCloseTimer();
  notificationBarIframeInitData = initData;

  if (initData.isConfirmation) {
    return handleSaveCipherConfirmation({
      command: "saveCipherAttemptCompleted",
      data: initData.confirmationData,
    });
  }

  const {
    isVaultLocked,
    removeIndividualVault: personalVaultDisallowed,
    theme,
  } = notificationBarIframeInitData;
  const i18n = getI18n();
  const resolvedTheme = getResolvedTheme(theme ?? ThemeTypes.Light);

  const notificationType = resolveNotificationType(notificationBarIframeInitData);
  const headerMessage = getNotificationHeaderMessage(i18n, notificationType);
  const notificationTestId = getNotificationTestId(notificationType);
  appendHeaderMessageToTitle(headerMessage);

  if (isVaultLocked) {
    const notificationConfig = {
      ...notificationBarIframeInitData,
      headerMessage,
      type: notificationType,
      notificationTestId,
      theme: resolvedTheme,
      personalVaultIsAllowed: !personalVaultDisallowed,
      handleCloseNotification,
      handleEditOrUpdateAction,
      i18n,
    };

    const handleSaveAction = () => {
      // cipher ID is null while vault is locked.
      sendSaveCipherMessage(null, true);

      render(
        NotificationContainer({
          ...notificationConfig,
          handleSaveAction: () => {},
          isLoading: true,
        }),
        document.body,
      );
    };

    const UnlockNotification = NotificationContainer({ ...notificationConfig, handleSaveAction });

    return render(UnlockNotification, document.body);
  }

  // Handle AtRiskPasswordNotification render
  if (isAtRiskPasswordNotification(notificationBarIframeInitData)) {
    const atRiskParams = notificationBarIframeInitData.params;
    const localRisk = atRiskParams.localRisk;

    // Local vault findings render the compact AGY card; organization security tasks keep the
    // full-width container that explains the task workflow.
    if (localRisk) {
      return render(
        LocalAtRiskNotification({
          kind: localRisk.kind,
          sharedCount: localRisk.sharedCount,
          entryName: localRisk.entryName,
          username: localRisk.username,
          i18n,
          notificationTestId,
          theme: resolvedTheme,
          handleCloseNotification,
          handleFixPassword: (e: Event) => {
            e.preventDefault();
            sendPlatformMessage({
              command: "bgFixAtRiskPassword",
              cipherId: localRisk.cipherId,
            });
          },
        }),
        document.body,
      );
    }

    return render(
      AtRiskNotification({
        ...notificationBarIframeInitData,
        type: notificationBarIframeInitData.type,
        theme: resolvedTheme,
        i18n,
        notificationTestId,
        params: notificationBarIframeInitData.params,
        handleCloseNotification,
        handleChangePasswordClick: notificationBarIframeInitData.params.hasPasswordChangeUri
          ? handleChangePasswordClick
          : undefined,
      }),
      document.body,
    );
  }

  // Default scenario: add or update password
  const orgId = selectedVaultSignal.get();

  await Promise.all([
    new Promise<OrgView[]>((resolve) => sendPlatformMessage({ command: "bgGetOrgData" }, resolve)),
    new Promise<FolderView[]>((resolve) =>
      sendPlatformMessage({ command: "bgGetFolderData" }, resolve),
    ),
    new Promise<NotificationCipherData[]>((resolve) =>
      sendPlatformMessage({ command: "bgGetDecryptedCiphers" }, resolve),
    ),
    new Promise<CollectionView[]>((resolve) =>
      sendPlatformMessage({ command: "bgGetCollectionData", orgId }, resolve),
    ),
  ]).then(([organizations, folders, ciphers, collections]) => {
    notificationBarIframeInitData = {
      ...notificationBarIframeInitData,
      organizations,
      folders,
      ciphers,
      collections,
    };

    // A change notification carries the entries whose saved password matched the submitted current
    // password. The bar's cipher list can be broader (every entry for the URL) when the queue
    // lookup misses, so narrow it to the queued candidate ids before offering an update target.
    // The queue may also supply an empty candidate list, which still renders the change card so
    // the submitted credentials can be saved as a new entry.
    const changeCipherIds = getChangeNotificationCipherIds();
    if (
      notificationType === NotificationTypes.Change &&
      hasChangeNotificationCipherIds(notificationBarIframeInitData.params)
    ) {
      const changeCiphers = getChangeNotificationCiphers(ciphers, changeCipherIds);
      changeNotificationState = {
        ciphers: changeCiphers,
        domain: getNotificationDomain(),
        existingEntryCount: getChangeNotificationExistingEntryCount(
          notificationBarIframeInitData.params,
        ),
        expanded: changeCiphers.length > 1,
        i18n,
        notificationTestId,
        selectedTarget: changeCiphers[0]?.id ?? ChangeNotificationNewEntryTarget,
        theme: resolvedTheme,
      };
      renderChangeNotification();
      return;
    }

    // The local-vault first-save flow gets the AGY compact card. Organization or collection
    // selection still needs the full-width container, so those keep the existing layout.
    if (
      notificationType === NotificationTypes.Add &&
      !organizations?.length &&
      !collections?.length &&
      !personalVaultDisallowed
    ) {
      // A new notification starts with no folder chosen; the select writes any change back to
      // the signal the save handler reads.
      selectedFolderSignal.set("0");

      return render(
        NotificationAddContainer({
          ciphers,
          domain: getNotificationDomain(),
          folders,
          handleCloseNotification,
          handleNeverSave: (e: Event) => {
            e.preventDefault();
            sendPlatformMessage({ command: "bgNeverSave" });
          },
          handleSaveAction,
          i18n,
          notificationTestId,
          theme: resolvedTheme,
        }),
        document.body,
      );
    }

    // @TODO use context to avoid prop drilling
    return render(
      NotificationContainer({
        ...notificationBarIframeInitData,
        headerMessage,
        type: notificationType,
        theme: resolvedTheme,
        notificationTestId,
        personalVaultIsAllowed: !personalVaultDisallowed,
        handleCloseNotification,
        handleSaveAction,
        handleEditOrUpdateAction,
        i18n,
      }),
      document.body,
    );
  });

  function handleEditOrUpdateAction(e: Event) {
    e.preventDefault();
    sendSaveCipherMessage(selectedCipherSignal.get(), notificationType === NotificationTypes.Add);
  }
}

/**
 * Reads the domain queued with the notification. It is not a typed field of
 * `NotificationBarIframeInitData` because `params` carries the queue message's type-specific
 * payload, so it is validated here before reaching a card.
 */
function getNotificationDomain(): string {
  const params = notificationBarIframeInitData.params;
  if (params == null || typeof params !== "object") {
    return "";
  }
  const domain = (params as Record<string, unknown>)["domain"];
  return typeof domain === "string" ? domain : "";
}

/**
 * Reads the candidate cipher ids queued with the change notification. Only these entries'
 * saved passwords matched the submitted current password, so only these may be offered as an
 * update target.
 */
function getChangeNotificationCipherIds(): string[] {
  const params = notificationBarIframeInitData.params;
  if (params == null || typeof params !== "object") {
    return [];
  }
  const cipherIds = (params as Record<string, unknown>)["cipherIds"];
  if (!Array.isArray(cipherIds)) {
    return [];
  }
  return cipherIds.filter((cipherId): cipherId is string => typeof cipherId === "string");
}

/**
 * Whether the queued change notification supplied a candidate list. An empty array is still a
 * supplied list and must render the change card with only the "save as new entry" option, so
 * this intentionally does not check the list's length.
 */
export function hasChangeNotificationCipherIds(params: unknown): boolean {
  if (params == null || typeof params !== "object") {
    return false;
  }
  return Array.isArray((params as Record<string, unknown>)["cipherIds"]);
}

/**
 * Reads the number of login entries already saved for the page when the change was detected.
 * The queued candidate ids only cover entries that matched the submitted password, so the
 * new-entry option is numbered from this broader count instead.
 */
export function getChangeNotificationExistingEntryCount(params: unknown): number | undefined {
  if (params == null || typeof params !== "object") {
    return undefined;
  }
  const count = (params as Record<string, unknown>)["existingEntryCount"];
  return typeof count === "number" && Number.isFinite(count) && count >= 0
    ? Math.floor(count)
    : undefined;
}

/**
 * Narrows the URL's cipher list to the candidate ids queued with the change notification,
 * preserving the queue order. Exported for the direct unit test of this filter.
 */
export function getChangeNotificationCiphers(
  ciphers: NotificationCipherData[],
  cipherIds: string[],
): NotificationCipherData[] {
  return cipherIds
    .map((cipherId) => ciphers.find((cipher) => cipher.id === cipherId))
    .filter((cipher): cipher is NotificationCipherData => cipher != null);
}

function renderChangeNotification() {
  const state = changeNotificationState;
  if (!state) {
    return;
  }

  render(
    NotificationChangeContainer({
      ciphers: state.ciphers,
      domain: state.domain,
      existingEntryCount: state.existingEntryCount,
      expanded: state.expanded,
      i18n: state.i18n,
      notificationTestId: state.notificationTestId,
      selectedTarget: state.selectedTarget,
      theme: state.theme,
      handleCloseNotification,
      handleCommit: handleChangeCommit,
      handleSelectTarget: handleChangeTargetSelect,
      handleToggleExpanded: handleChangeToggleExpanded,
    }),
    document.body,
  );
}

function handleChangeTargetSelect(target: string) {
  if (!changeNotificationState) {
    return;
  }
  changeNotificationState.selectedTarget = target;
  renderChangeNotification();
  // The card is re-rendered from scratch on every selection, so restore focus to the checked
  // row to keep keyboard selection and the commit button reachable.
  document.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
}

function handleChangeToggleExpanded(e: Event) {
  e.preventDefault();
  if (!changeNotificationState) {
    return;
  }
  changeNotificationState.expanded = true;
  renderChangeNotification();
}

function handleChangeCommit(e: Event) {
  e.preventDefault();
  const state = changeNotificationState;
  if (!state) {
    return;
  }
  const saveAsNew = state.selectedTarget === ChangeNotificationNewEntryTarget;
  sendSaveCipherMessage(saveAsNew ? null : state.selectedTarget, false, undefined, saveAsNew);
}

function handleChangePasswordClick(e: Event) {
  // Guard against any default browser action (e.g., form submission) so only
  // the background service worker message triggers navigation.
  e.preventDefault();
  sendPlatformMessage({ command: "bgOpenChangePasswordUrl" });
}

function clearAutoCloseTimer() {
  if (autoCloseTimeoutId !== undefined) {
    globalThis.clearTimeout(autoCloseTimeoutId);
    autoCloseTimeoutId = undefined;
  }
}

function handleCloseNotification(e: Event) {
  e.preventDefault();
  clearAutoCloseTimer();
  changeNotificationState = null;
  sendPlatformMessage({
    command: "bgCloseNotificationBar",
    // FIXME (PM-33879): This value should be replaced with the resolved
    // user preference and/or removed entirely
    fadeOutNotification: true,
  });
}

function handleSaveAction(e: Event) {
  const selectedCipher = selectedCipherSignal.get();
  const selectedVault = selectedVaultSignal.get();
  const selectedFolder = selectedFolderSignal.get();

  if (selectedVault.length > 1) {
    openAddEditVaultItemPopout(e, {
      organizationId: selectedVault,
      ...(selectedFolder?.length > 1 ? { folder: selectedFolder } : {}),
    });
    handleCloseNotification(e);
    return;
  }

  e.preventDefault();
  sendSaveCipherMessage(selectedCipher, removeIndividualVault(), selectedFolder);
  if (removeIndividualVault()) {
    return;
  }
}

function sendSaveCipherMessage(
  cipherId: CipherView["id"] | null,
  edit: boolean,
  folder?: string,
  saveAsNew = false,
) {
  sendPlatformMessage({
    command: "bgSaveCipher",
    cipherId,
    folder,
    edit,
    ...(saveAsNew ? { saveAsNew: true } : {}),
  });
}

function openAddEditVaultItemPopout(
  e: Event,
  options: {
    cipherId?: string;
    organizationId?: string;
    folder?: string;
  },
) {
  e.preventDefault();
  sendPlatformMessage({
    command: "bgOpenAddEditVaultItemPopout",
    ...options,
  });
}

function openViewVaultItemPopout(cipherId: string) {
  sendPlatformMessage({
    command: "bgOpenViewVaultItemPopout",
    cipherId,
  });
}

function handleSaveCipherConfirmation(message: NotificationBarWindowMessage) {
  changeNotificationState = null;
  const { theme } = notificationBarIframeInitData;
  const { error, data } = message;
  const { cipherId, task, itemName, saveAsNew, username, folderName } = data || {};
  const i18n = getI18n();
  const resolvedTheme = getResolvedTheme(theme ?? ThemeTypes.Light);
  // Saving the submitted credentials as a new entry is a save, not an update; the
  // confirmation header and body follow the add flow's copy.
  const resolvedType = saveAsNew
    ? NotificationTypes.Add
    : resolveNotificationType(notificationBarIframeInitData);
  const headerMessage = getConfirmationHeaderMessage(i18n, resolvedType, error);
  const notificationTestId = getNotificationTestId(resolvedType, true);
  appendHeaderMessageToTitle(headerMessage);

  // A successful save or update gets the AGY compact success card, which stays long enough for
  // the user to open the entry and add a TOTP secret. Failures and security tasks keep the
  // existing container and its brief auto-close.
  const showCompactConfirmation = !error && !task;
  const autoCloseDelay = showCompactConfirmation ? 120_000 : 5_000;
  clearAutoCloseTimer();
  autoCloseTimeoutId = globalThis.setTimeout(
    () => sendPlatformMessage({ command: "bgCloseNotificationBar" }),
    autoCloseDelay,
  );

  if (showCompactConfirmation) {
    // AGY names the folder the entry was encrypted into and states the auto-close window.
    const detailMessage = folderName
      ? chrome.i18n.getMessage("notificationSaveFolderBody", [folderName])
      : chrome.i18n.getMessage("notificationSaveBody");
    return render(
      NotificationSaveConfirmation({
        confirmationMessage: detailMessage,
        handleCloseNotification,
        ...(cipherId
          ? {
              handleEditEntry: (e: Event) => {
                openAddEditVaultItemPopout(e, { cipherId });
                handleCloseNotification(e);
              },
            }
          : {}),
        headerMessage: headerMessage ?? "",
        i18n,
        itemName: itemName ?? i18n.typeLogin,
        username,
        notificationTestId,
        theme: resolvedTheme,
      }),
      document.body,
    );
  }

  return render(
    NotificationConfirmationContainer({
      ...notificationBarIframeInitData,
      error,
      handleCloseNotification,
      handleOpenTasks: () => sendPlatformMessage({ command: "bgOpenAtRiskPasswords" }),
      handleOpenVault: (e: Event) =>
        cipherId ? openViewVaultItemPopout(cipherId) : openAddEditVaultItemPopout(e, {}),
      headerMessage,
      i18n,
      itemName: itemName ?? i18n.typeLogin,
      notificationTestId,
      task,
      theme: resolvedTheme,
      type: resolvedType,
    }),
    document.body,
  );
}

function sendPlatformMessage(
  msg: Record<string, unknown>,
  responseCallback?: (response: any) => void,
) {
  chrome.runtime.sendMessage(msg, (response) => {
    if (responseCallback) {
      responseCallback(response);
    }
  });
}

function removeIndividualVault(): boolean {
  return Boolean(notificationBarIframeInitData?.removeIndividualVault);
}

function setupWindowMessageListener() {
  globalThis.addEventListener("message", handleWindowMessage);
}

function handleWindowMessage(event: MessageEvent) {
  if (event?.source !== globalThis.parent) {
    return;
  }

  const message = event.data as NotificationBarWindowMessage;
  if (!message?.command) {
    return;
  }

  if (!windowMessageOrigin || event.origin !== windowMessageOrigin) {
    return;
  }

  if (
    message.command === "initNotificationBar" &&
    message.parentOrigin &&
    message.parentOrigin !== event.origin
  ) {
    return;
  }

  const handler = notificationBarWindowMessageHandlers[message.command];
  if (!handler) {
    return;
  }

  handler({ message });
}

function getTheme(globalThis: any, theme: NotificationBarIframeInitData["theme"]) {
  if (theme === ThemeTypes.System) {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      ? ThemeTypes.Dark
      : ThemeTypes.Light;
  }

  return theme;
}

function getResolvedTheme(theme: Theme) {
  const themeType = getTheme(globalThis, theme);

  // There are other possible passed theme values, but for now, resolve to dark or light
  const resolvedTheme: Theme = themeType === ThemeTypes.Dark ? ThemeTypes.Dark : ThemeTypes.Light;
  return resolvedTheme;
}

function postMessageToParent(message: NotificationBarWindowMessage) {
  if (!windowMessageOrigin) {
    return;
  }
  globalThis.parent.postMessage(message, windowMessageOrigin);
}
