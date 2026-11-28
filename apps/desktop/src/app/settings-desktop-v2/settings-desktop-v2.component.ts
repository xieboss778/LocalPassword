import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  buildDiagnosticReport,
  DesktopShortcut,
  DesktopShortcutsService,
  LpToastService,
  PasswordAutoHideService,
  VaultDensity,
  VaultDensityService,
} from "@localpass/angular/local-ui";
import { formatBackupTimestamp } from "@localpass/angular/tools/backup";
import { LocalPassIcon as LocalPassLogo } from "@localpass/assets/svg";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { ClearClipboardDelaySetting } from "@localpass/common/autofill/types";
import { DeviceType } from "@localpass/common/enums";
import { PinServiceAbstraction } from "@localpass/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeout,
  VaultTimeoutNumberType,
  VaultTimeoutSettingsService,
} from "@localpass/common/key-management/vault-timeout";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@localpass/common/platform/abstractions/validation.service";
import { Theme, ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";
import { ThemeStateService } from "@localpass/common/platform/theming/theme-state.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService, IconModule, SvgModule } from "@localpass/components";
import { BiometricStateService, BiometricsStatus, KeyService } from "@localpass/key-management";
import { SessionTimeoutSettingsComponent } from "@localpass/key-management-ui";
import { VaultBackupSyncService } from "@localpass/local-vault";
import { LockService, LockSource, AutoUnlockService } from "@localpass/unlock";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

type SettingsTab = "security" | "vault" | "appearance" | "shortcuts" | "backup" | "about";

interface SettingsTabSpec {
  readonly id: SettingsTab;
  readonly labelKey: string;
}

const TABS: readonly SettingsTabSpec[] = [
  { id: "security", labelKey: "security" },
  { id: "vault", labelKey: "vault" },
  { id: "appearance", labelKey: "appearance" },
  { id: "shortcuts", labelKey: "shortcuts" },
  { id: "backup", labelKey: "backupTab" },
  { id: "about", labelKey: "about" },
];

interface ShortcutSpec {
  readonly id: DesktopShortcut;
  readonly key: string;
  readonly titleKey: string;
  readonly descKey: string;
}

/** 6 个应用内键位；只作用于 LocalPass 窗口，不注册系统全局热键。 */
const APP_SHORTCUTS: readonly ShortcutSpec[] = [
  {
    id: DesktopShortcut.Search,
    key: "⌘K / /",
    titleKey: "shortcutSearchTitle",
    descKey: "shortcutSearchDesc",
  },
  {
    id: DesktopShortcut.Nav,
    key: "↑↓ · ↵",
    titleKey: "shortcutNavTitle",
    descKey: "shortcutNavDesc",
  },
  {
    id: DesktopShortcut.Copy,
    key: "⌘C / ⇧⌘C",
    titleKey: "shortcutCopyTitle",
    descKey: "shortcutCopyDesc",
  },
  {
    id: DesktopShortcut.Edit,
    key: "⌘N · ⌘E",
    titleKey: "shortcutEditTitle",
    descKey: "shortcutEditDesc",
  },
  {
    id: DesktopShortcut.Delete,
    key: "Delete / ⌘⌫",
    titleKey: "shortcutDeleteTitle",
    descKey: "shortcutDeleteDesc",
  },
  {
    id: DesktopShortcut.Lock,
    key: "⌘L",
    titleKey: "shortcutLockTitle",
    descKey: "shortcutLockDesc",
  },
];

interface ThemeOption {
  readonly value: Theme;
  readonly labelKey: string;
  readonly descKey: string;
}

const THEMES: readonly ThemeOption[] = [
  { value: ThemeTypes.Light, labelKey: "light", descKey: "themeLightDesc" },
  { value: ThemeTypes.Dark, labelKey: "dark", descKey: "themeDarkDesc" },
  { value: ThemeTypes.System, labelKey: "followSystem", descKey: "themeSystemDesc" },
];

/**
 * 桌面端设置：左侧子导航 + 右侧内容，与 Bitwarden 的 VFO1 设置结构一致。
 *
 * **Touch ID 只在这里出现**：仅当运行在 macOS 且系统真的能用（`canEnableBiometricUnlock`）
 * 才渲染那一行；Windows/Linux 与扩展里都不会看到它。开关状态存在 `BiometricStateService`，
 * 打开时会顺手把持久化密钥登记好，关掉时删掉密钥。
 */
@Component({
  selector: "settings-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [JslibModule, IconModule, SvgModule, SessionTimeoutSettingsComponent],
  template: `
    <div class="agy agy-settings">
      <header>
        <h1 class="agy-settings-title">{{ i18n.t("settings") }}</h1>
        <p class="agy-settings-sub">{{ i18n.t("settingsSubtitle") }}</p>
        <nav class="agy-settings-tabs" role="tablist" [attr.aria-label]="i18n.t('settings')">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              role="tab"
              class="agy-settings-tab"
              [class.agy-on]="activeTab() === tab.id"
              [attr.aria-selected]="activeTab() === tab.id"
              data-testid="settings_tab"
              (click)="activeTab.set(tab.id)"
            >
              {{ i18n.t(tab.labelKey) }}
            </button>
          }
        </nav>
      </header>

      <div class="agy-settings-body">
        @switch (activeTab()) {
          @case ("security") {
            <div class="agy-grp">
              <div class="agy-grphead">
                {{ i18n.t("unlockAndAccess") }}
                @if (supportsTouchId()) {
                  <span class="agy-chip agy-ok">Touch ID</span>
                }
              </div>
              <div class="agy-setrow" data-testid="settings_password_row">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("masterPassword") }}</span>
                  <span class="agy-d">{{ i18n.t("masterPasswordLocalDesc") }}</span>
                </div>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_password_change"
                  (click)="changeMasterPassword()"
                >
                  {{ i18n.t("change") }}
                </button>
              </div>
              <div class="agy-setrow" data-testid="settings_autolock_row">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("autoLock") }}</span>
                  <span class="agy-d">{{ timeoutSummary() }}</span>
                </div>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_autolock_change"
                  (click)="timeoutEditing.set(!timeoutEditing())"
                >
                  {{ i18n.t(timeoutEditing() ? "done" : "change") }}
                </button>
              </div>
              @if (timeoutEditing()) {
                <div
                  class="tw-px-3 tw-py-2 tw-border-0 tw-border-b tw-border-solid tw-border-border-light"
                >
                  <bit-session-timeout-settings></bit-session-timeout-settings>
                </div>
              }
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("unlockWithPin") }}</span>
                  <span class="agy-d">{{ i18n.t("pinUnlockDesc") }}</span>
                </div>
                <button
                  type="button"
                  class="agy-switch"
                  role="switch"
                  [attr.aria-checked]="pinEnabled()"
                  [attr.aria-label]="i18n.t('unlockWithPin')"
                  (click)="togglePin()"
                ></button>
              </div>
              @if (supportsTouchId()) {
                <div class="agy-setrow">
                  <div class="tw-min-w-0 tw-flex-1">
                    <span class="agy-k">{{ i18n.t("touchIdUnlock") }}</span>
                    <span class="agy-d">{{ i18n.t("touchIdMacOnly") }}</span>
                  </div>
                  <button
                    type="button"
                    class="agy-switch"
                    role="switch"
                    [attr.aria-checked]="touchIdEnabled()"
                    [attr.aria-label]="i18n.t('touchIdUnlock')"
                    (click)="toggleTouchId()"
                  ></button>
                </div>
              }
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("clearClipboard") }}</span>
                  <span class="agy-d">{{ i18n.t("clearClipboardDesc") }}</span>
                </div>
                <select
                  class="agy-input tw-w-28 tw-flex-none tw-text-end"
                  [attr.aria-label]="i18n.t('clearClipboard')"
                  [value]="clipboardDelayValue()"
                  (change)="setClipboardDelay($event)"
                >
                  @for (opt of clipboardDelayOptions; track opt.value) {
                    <option [value]="opt.value">{{ i18n.t(opt.labelKey) }}</option>
                  }
                </select>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("passwordAutoHide") }}</span>
                  <span class="agy-d">{{ i18n.t("passwordAutoHideDesc") }}</span>
                </div>
                <button
                  type="button"
                  class="agy-switch"
                  role="switch"
                  [attr.aria-checked]="autoHide()"
                  [attr.aria-label]="i18n.t('passwordAutoHide')"
                  (click)="toggleAutoHide()"
                ></button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("runInBackgroundTray") }}</span>
                  <span class="agy-d">{{ i18n.t("runInBackgroundTrayDesc") }}</span>
                </div>
                <button
                  type="button"
                  class="agy-switch"
                  role="switch"
                  [attr.aria-checked]="runInBackground()"
                  [attr.aria-label]="i18n.t('runInBackgroundTray')"
                  (click)="toggleRunInBackground()"
                ></button>
              </div>
            </div>

            <div class="agy-seclbl">{{ i18n.t("securityKeysGroup") }}</div>
            <div class="agy-grp">
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("securityKey") }}</span>
                  <span class="agy-d">{{ i18n.t("securityKeyDesktopPlatformDesc") }}</span>
                </div>
                <span class="agy-chip">{{ i18n.t("extensionOnlyBadge") }}</span>
              </div>
            </div>

            <div class="agy-seclbl">{{ i18n.t("session") }}</div>
            <div class="agy-grp">
              <div class="agy-setrow" data-testid="settings_lock_row">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("lockVaultNow") }}</span>
                  <span class="agy-d">{{ i18n.t("lockVaultNoDataLoss") }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="lock()">
                  {{ i18n.t("lock") }}
                </button>
              </div>
            </div>
            <p class="agy-note">{{ i18n.t("touchIdNote") }}</p>
          }

          @case ("vault") {
            <div class="agy-grp">
              <div class="agy-grphead">{{ i18n.t("vault") }}</div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("myFolders") }}</span>
                  <span class="agy-d">{{ i18n.t("folderCount", folderCount()) }}</span>
                </div>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_folders"
                  (click)="go('/folders-desktop-v2')"
                >
                  {{ i18n.t("manage") }}
                </button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("trash") }}</span>
                  <span class="agy-d">{{ i18n.t("trashSettingsSummary", trashCount()) }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="go('/trash-desktop-v2')">
                  {{ i18n.t("openAction") }}
                </button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("importNoun") }}</span>
                  <span class="agy-d">{{ i18n.t("importSettingsDesc") }}</span>
                </div>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_import"
                  (click)="go('/import')"
                >
                  {{ i18n.t("importVerb") }}
                </button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("exportNoun") }}</span>
                  <span class="agy-d">{{ i18n.t("exportRowDesc") }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="go('/export')">
                  {{ i18n.t("exportVerb") }}
                </button>
              </div>
            </div>

            <div class="agy-seclbl">{{ i18n.t("advanced") }}</div>
            <div class="agy-grp">
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("networkGate") }}</span>
                  <span class="agy-d">{{ i18n.t("networkGateSubtitle") }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="go('/network-gate')">
                  {{ i18n.t("viewAction") }}
                </button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("dataAndSafety") }}</span>
                  <span class="agy-d">{{ i18n.t("dataSafetySettingsDesc") }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="go('/data-safety')">
                  {{ i18n.t("viewAction") }}
                </button>
              </div>
            </div>
          }

          @case ("appearance") {
            <div class="agy-seclbl">{{ i18n.t("theme") }}</div>
            <div class="agy-theme-grid" role="radiogroup">
              @for (theme of themes; track theme.value) {
                <button
                  type="button"
                  role="radio"
                  class="agy-themecard"
                  [class.agy-on]="selectedTheme() === theme.value"
                  [attr.aria-checked]="selectedTheme() === theme.value"
                  (click)="setTheme(theme.value)"
                >
                  <span
                    class="tw-relative tw-block tw-h-14 tw-overflow-hidden tw-rounded-md tw-border tw-border-border-light"
                  >
                    @if (theme.value === themeTypes.Light) {
                      <span class="tw-flex tw-h-full tw-flex-col tw-gap-1 tw-bg-bg-primary tw-p-2">
                        <span
                          class="tw-block tw-h-1.5 tw-w-2/3 tw-rounded tw-bg-secondary-300"
                        ></span>
                        <span
                          class="tw-block tw-h-1.5 tw-w-full tw-rounded tw-bg-secondary-100"
                        ></span>
                        <span
                          class="tw-block tw-h-1.5 tw-w-1/2 tw-rounded tw-bg-secondary-100"
                        ></span>
                      </span>
                    } @else if (theme.value === themeTypes.Dark) {
                      <span class="tw-flex tw-h-full tw-flex-col tw-gap-1 tw-bg-bg-dark tw-p-2">
                        <span
                          class="tw-block tw-h-1.5 tw-w-2/3 tw-rounded tw-bg-secondary-600"
                        ></span>
                        <span
                          class="tw-block tw-h-1.5 tw-w-full tw-rounded tw-bg-secondary-700"
                        ></span>
                        <span
                          class="tw-block tw-h-1.5 tw-w-1/2 tw-rounded tw-bg-secondary-700"
                        ></span>
                      </span>
                    } @else {
                      <span class="tw-flex tw-h-full">
                        <span class="tw-flex tw-w-1/2 tw-flex-col tw-gap-1 tw-bg-bg-primary tw-p-2">
                          <span
                            class="tw-block tw-h-1.5 tw-w-full tw-rounded tw-bg-secondary-300"
                          ></span>
                          <span
                            class="tw-block tw-h-1.5 tw-w-1/2 tw-rounded tw-bg-secondary-100"
                          ></span>
                        </span>
                        <span class="tw-flex tw-w-1/2 tw-flex-col tw-gap-1 tw-bg-bg-dark tw-p-2">
                          <span
                            class="tw-block tw-h-1.5 tw-w-full tw-rounded tw-bg-secondary-600"
                          ></span>
                          <span
                            class="tw-block tw-h-1.5 tw-w-1/2 tw-rounded tw-bg-secondary-700"
                          ></span>
                        </span>
                      </span>
                    }
                    @if (selectedTheme() === theme.value) {
                      <span
                        class="tw-absolute tw-end-1.5 tw-top-1.5 tw-grid tw-size-4 tw-place-items-center tw-rounded-full tw-bg-bg-brand tw-text-fg-contrast"
                      >
                        <bit-icon name="bwi-check" class="tw-text-xs"></bit-icon>
                      </span>
                    }
                  </span>
                  <span class="agy-k">{{ i18n.t(theme.labelKey) }}</span>
                  <span class="agy-d">{{ i18n.t(theme.descKey) }}</span>
                </button>
              }
            </div>

            <div class="agy-seclbl">{{ i18n.t("listDensity") }}</div>
            <div class="agy-segtabs">
              <button
                type="button"
                [class.agy-on]="density() === 'compact'"
                [attr.aria-pressed]="density() === 'compact'"
                (click)="setDensity('compact')"
              >
                {{ i18n.t("densityCompact") }}
              </button>
              <button
                type="button"
                [class.agy-on]="density() === 'ultra'"
                [attr.aria-pressed]="density() === 'ultra'"
                (click)="setDensity('ultra')"
              >
                {{ i18n.t("densityUltra") }}
              </button>
            </div>
            <p class="agy-note">
              {{ i18n.t(density() === "ultra" ? "densityUltraDesc" : "densityCompactDesc") }}
            </p>

            <div class="agy-seclbl">{{ i18n.t("language") }}</div>
            <div class="agy-grp">
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("interfaceLanguage") }}</span>
                  <span class="agy-d">{{ i18n.t("languageSwitchDesc") }}</span>
                </div>
                <select
                  class="agy-input tw-w-36 tw-flex-none tw-text-end"
                  [attr.aria-label]="i18n.t('interfaceLanguage')"
                  [value]="selectedLocale()"
                  (change)="setLocale($event)"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <p class="agy-note">{{ i18n.t("themeOnlyDisplayNotice") }}</p>
          }

          @case ("shortcuts") {
            <div class="agy-grp">
              <div class="agy-grphead">
                {{ i18n.t("appShortcuts") }}
                <button
                  type="button"
                  class="agy-btn agy-sm tw-ms-auto"
                  data-testid="settings_reset_shortcuts"
                  (click)="resetShortcuts()"
                >
                  {{ i18n.t("resetShortcuts") }}
                </button>
              </div>
              @if (activeShortcuts().length) {
                @for (shortcut of activeShortcuts(); track shortcut.id) {
                  <div class="agy-setrow" [attr.data-testid]="'settings_shortcut_' + shortcut.id">
                    <div class="tw-min-w-0 tw-flex-1">
                      <span class="agy-k">{{ i18n.t(shortcut.titleKey) }}</span>
                      <span class="agy-d">{{ i18n.t(shortcut.descKey) }}</span>
                    </div>
                    <div class="agy-right">
                      <span class="agy-kbd"
                        ><kbd>{{ shortcut.key }}</kbd></span
                      >
                      <button
                        type="button"
                        class="agy-iconbtn agy-sm"
                        [attr.aria-label]="i18n.t('removeShortcut')"
                        [attr.title]="i18n.t('removeShortcut')"
                        (click)="removeShortcut(shortcut.id)"
                      >
                        <bit-icon name="bwi-trash" class="tw-text-xs"></bit-icon>
                      </button>
                    </div>
                  </div>
                }
              } @else {
                <div class="agy-setrow">
                  <span class="agy-d">{{ i18n.t("shortcutsEmpty") }}</span>
                </div>
              }
            </div>
            <p class="agy-note">{{ i18n.t("appShortcutsHint") }}</p>
          }

          @case ("backup") {
            <div class="agy-grp">
              <div class="agy-grphead">{{ i18n.t("cloudBackupManualGroup") }}</div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("lastSynced") }}</span>
                  <span class="agy-d">{{ lastSyncedLabel() }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="go('/backup-settings')">
                  {{ i18n.t("syncNow") }}
                </button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("backupStorage") }}</span>
                  <span class="agy-d">{{ i18n.t("backupSubtitle") }}</span>
                </div>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_backup_config"
                  (click)="go('/backup-config')"
                >
                  {{ i18n.t("configure") }}
                </button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("restoreFromBackup") }}</span>
                  <span class="agy-d">{{ i18n.t("restoreSettingsDesc") }}</span>
                </div>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_restore"
                  (click)="go('/restore')"
                >
                  {{ i18n.t("restoreAction") }}
                </button>
              </div>
            </div>

            <div class="agy-seclbl">{{ i18n.t("localBackup") }}</div>
            <div class="agy-grp">
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("exportLocalRowTitle") }}</span>
                  <span class="agy-d">{{ i18n.t("exportLocalRowDesc") }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="go('/export')">
                  {{ i18n.t("exportVerb") }}
                </button>
              </div>
            </div>
            <p class="agy-note">{{ i18n.t("settingsNoteBackup") }}</p>
          }

          @case ("about") {
            <div class="agy-grp">
              <div class="agy-grphead">LocalPass</div>
              <div class="agy-setrow">
                <bit-svg
                  class="tw-size-10 tw-flex-none"
                  [content]="logo"
                  [ariaLabel]="i18n.t('appLogoLabel')"
                ></bit-svg>
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("version", version()) }}</span>
                  <span class="agy-d">{{ i18n.t("aboutDescription") }}</span>
                </div>
              </div>
            </div>

            <div class="agy-grp tw-mt-3">
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("privacy") }}</span>
                  <span class="agy-d">{{ i18n.t("privacyRowDesc") }}</span>
                </div>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("license") }}</span>
                  <span class="agy-d">{{ i18n.t("licenseGpl") }}</span>
                </div>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("changelog") }}</span>
                  <span class="agy-d">{{ i18n.t("changelogDesc") }}</span>
                </div>
                <button
                  id="settings_button_changelog"
                  type="button"
                  class="agy-btn agy-sm"
                  (click)="openChangelog()"
                >
                  {{ i18n.t("openAction") }}
                </button>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("sourceAddress") }}</span>
                  <span class="agy-d">{{ sourceUrl }}</span>
                </div>
                <button type="button" class="agy-btn agy-sm" (click)="openSource()">
                  {{ i18n.t("openAction") }}
                </button>
              </div>
            </div>

            <div class="agy-seclbl">{{ i18n.t("knownLimitations") }}</div>
            <div class="agy-grp">
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("knownLimitSyncTitle") }}</span>
                  <span class="agy-d">{{ i18n.t("knownLimitSyncDesc") }}</span>
                </div>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("knownLimitConflictTitle") }}</span>
                  <span class="agy-d">{{ i18n.t("knownLimitConflictDesc") }}</span>
                </div>
              </div>
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("knownLimitHistoryTitle") }}</span>
                  <span class="agy-d">{{ i18n.t("knownLimitHistoryDesc") }}</span>
                </div>
              </div>
            </div>

            <div class="agy-seclbl">{{ i18n.t("offlineDiagnostics") }}</div>
            <div class="agy-grp">
              <div class="agy-setrow">
                <div class="tw-min-w-0 tw-flex-1">
                  <span class="agy-k">{{ i18n.t("diagnosticsTitle") }}</span>
                  <span class="agy-d">{{ i18n.t("diagnosticsDesc") }}</span>
                </div>
                <button
                  id="settings_button_diagnostics-preview"
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_diagnostics_preview"
                  (click)="toggleDiagnostics()"
                >
                  {{ i18n.t(diagnostics() ? "hideReport" : "showReport") }}
                </button>
                <button
                  id="settings_button_diagnostics-copy"
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="settings_diagnostics_copy"
                  (click)="copyDiagnostics()"
                >
                  {{ i18n.t("copyDiagnostics") }}
                </button>
              </div>
              @if (diagnostics(); as report) {
                <pre class="agy-diag" data-testid="settings_diagnostics_report">{{ report }}</pre>
              }
            </div>
          }
        }

        @if (errorMessage()) {
          <p class="agy-note tw-text-fg-danger">{{ errorMessage() }}</p>
        }
      </div>
    </div>
  `,
})
export class SettingsDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly biometricsService = inject(DesktopBiometricsService);
  private readonly biometricStateService = inject(BiometricStateService);
  private readonly autoUnlockService = inject(AutoUnlockService);
  private readonly keyService = inject(KeyService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly validationService = inject(ValidationService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly pinService = inject(PinServiceAbstraction);
  private readonly vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  private readonly router = inject(Router);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly lockService = inject(LockService);
  private readonly cipherService = inject(CipherService);
  private readonly folderService = inject(FolderService);
  private readonly toast = inject(LpToastService);
  private readonly densityService = inject(VaultDensityService);
  private readonly shortcutsService = inject(DesktopShortcutsService);
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction);
  private readonly passwordAutoHideService = inject(PasswordAutoHideService);
  private readonly desktopSettingsService = inject(DesktopSettingsService);

  protected readonly clipboardDelayOptions: readonly {
    value: string;
    delay: ClearClipboardDelaySetting;
    labelKey: string;
  }[] = [
    { value: "10", delay: ClearClipboardDelay.TenSeconds, labelKey: "tenSeconds" },
    { value: "20", delay: ClearClipboardDelay.TwentySeconds, labelKey: "twentySeconds" },
    { value: "30", delay: ClearClipboardDelay.ThirtySeconds, labelKey: "thirtySeconds" },
    { value: "60", delay: ClearClipboardDelay.OneMinute, labelKey: "oneMinute" },
    { value: "120", delay: ClearClipboardDelay.TwoMinutes, labelKey: "twoMinutes" },
    { value: "300", delay: ClearClipboardDelay.FiveMinutes, labelKey: "fiveMinutes" },
    { value: "never", delay: ClearClipboardDelay.Never, labelKey: "never" },
  ];
  protected readonly autoHide = toSignal(this.passwordAutoHideService.autoHide$, {
    initialValue: true,
  });
  protected readonly runInBackground = toSignal(this.desktopSettingsService.runInBackground$, {
    initialValue: false,
  });
  private readonly clipboardDelay = toSignal(this.autofillSettingsService.clearClipboardDelay$, {
    initialValue: ClearClipboardDelay.ThirtySeconds,
  });
  protected readonly clipboardDelayValue = computed(() =>
    this.clipboardDelay() == null ? "never" : String(this.clipboardDelay()),
  );
  protected readonly selectedLocale = computed(() =>
    this.locale().toLowerCase().startsWith("zh") ? "zh-CN" : "en",
  );

  protected readonly tabs = TABS;
  protected readonly themes = THEMES;
  protected readonly themeTypes = ThemeTypes;
  protected readonly logo = LocalPassLogo;
  protected readonly sourceUrl = "github.com/xieboss778/LocalPass";
  protected readonly activeTab = signal<SettingsTab>("security");
  protected readonly supportsTouchId = signal(false);
  protected readonly touchIdEnabled = signal(false);
  protected readonly pinEnabled = signal(false);
  protected readonly timeoutEditing = signal(false);
  protected readonly timeoutSummary = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId)),
      map((timeout) => this.describeTimeout(timeout)),
    ),
    { initialValue: "" },
  );
  protected readonly selectedTheme = signal<Theme>(ThemeTypes.System);
  protected readonly density = toSignal(this.densityService.density$, {
    initialValue: VaultDensity.Compact,
  });
  private readonly disabledShortcuts = toSignal(this.shortcutsService.disabled$, {
    initialValue: new Set<DesktopShortcut>(),
  });
  protected readonly activeShortcuts = computed(() =>
    APP_SHORTCUTS.filter((shortcut) => !this.disabledShortcuts().has(shortcut.id)),
  );
  protected readonly version = signal("");
  protected readonly lastSyncedAt = signal<string | null>(null);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });
  protected readonly lastSyncedLabel = computed(() =>
    formatBackupTimestamp(this.lastSyncedAt(), this.locale(), this.i18n),
  );
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly folderCount = signal(0);
  protected readonly archiveCount = signal(0);
  protected readonly trashCount = signal(0);
  protected readonly itemCount = signal(0);
  protected readonly diagnostics = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.version.set(await this.platformUtilsService.getApplicationVersion());
    this.selectedTheme.set(await firstValueFrom(this.themeStateService.selectedTheme$));
    await this.refreshBackupStatus();
    await this.refreshVaultCounts();

    const userId = await this.userId();
    this.pinEnabled.set(await this.pinService.isPinSet(userId));

    const isMac = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;
    if (!isMac) {
      // Windows Hello / Linux 不在「Touch ID」这条承诺里，这里直接不渲染那一行。
      this.supportsTouchId.set(false);
      return;
    }

    this.supportsTouchId.set(await this.biometricsService.canEnableBiometricUnlock());
    this.touchIdEnabled.set(
      (await this.biometricsService.getBiometricsStatusForUser(userId)) ===
        BiometricsStatus.Available,
    );
  }

  /** PIN 开关：启用走设置对话框，停用直接清除，不用把 PIN 明文放在这一页。 */
  protected async togglePin(): Promise<void> {
    const enable = !this.pinEnabled();
    this.errorMessage.set(null);

    try {
      if (enable) {
        const dialogRef = SetPinComponent.open(this.dialogService);
        if (dialogRef == null) {
          return;
        }
        this.pinEnabled.set((await firstValueFrom(dialogRef.closed)) ?? false);
        return;
      }

      await this.pinService.unsetPin(await this.userId());
      this.pinEnabled.set(false);
    } catch (error) {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
      this.logService.error("Error updating unlock with PIN: ", error);
      this.pinEnabled.set(!enable);
    }
  }

  protected async toggleTouchId(): Promise<void> {
    const enable = !this.touchIdEnabled();
    this.errorMessage.set(null);
    const userId = await this.userId();

    try {
      if (!enable) {
        await this.biometricStateService.setBiometricUnlockEnabled(false, userId);
        await this.biometricsService.deleteBiometricUnlockKeyForUser(userId);
        await this.autoUnlockService.refreshAutoUnlockKey(userId);
        this.touchIdEnabled.set(false);
        return;
      }

      const status = await this.biometricsService.getBiometricsStatus();
      if (status === BiometricsStatus.AutoSetupNeeded) {
        await this.biometricsService.setupBiometrics();
      } else if (status === BiometricsStatus.ManualSetupNeeded) {
        const confirmed = await this.dialogService.openSimpleDialog({
          title: { key: "biometricsManualSetupTitle" },
          content: { key: "biometricsManualSetupDesc" },
          type: "warning",
        });
        if (confirmed) {
          this.platformUtilsService.launchUri(
            "https://github.com/xieboss778/LocalPass/tree/main/docs",
          );
        }
        return;
      }

      // 没有解锁密钥就没有 Touch ID 的立足点：先取出并确认，再改状态，避免开关亮着却不能用。
      const userKey = await firstValueFrom(this.keyService.userKey$(userId));
      if (userKey == null) {
        this.errorMessage.set(this.i18n.t("unexpectedError"));
        this.touchIdEnabled.set(false);
        return;
      }

      await this.biometricStateService.setBiometricUnlockEnabled(true, userId);
      await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);

      try {
        await this.biometricsService.enrollPersistent(userId, userKey);
      } catch (error) {
        // 登记失败不影响上面那把钥匙，记录后继续。
        this.logService.error("Error enrolling persistent Touch ID unlock: ", error);
        this.validationService.showError(error);
      }

      await this.autoUnlockService.refreshAutoUnlockKey(userId);

      const available =
        (await this.biometricsService.getBiometricsStatusForUser(userId)) ===
        BiometricsStatus.Available;
      if (!available) {
        await this.biometricStateService.setBiometricUnlockEnabled(false, userId);
      }
      this.touchIdEnabled.set(available);
    } catch (error) {
      this.errorMessage.set(this.i18n.t("unexpectedError"));
      this.logService.error("Error updating Touch ID unlock: ", error);
      this.touchIdEnabled.set(false);
      await this.biometricStateService.setBiometricUnlockEnabled(false, userId);
    }
  }

  protected async setTheme(theme: Theme): Promise<void> {
    await this.themeStateService.setSelectedTheme(theme);
    this.selectedTheme.set(theme);
  }

  protected setDensity(density: VaultDensity): void {
    void this.densityService.setDensity(density);
  }

  protected toggleAutoHide(): void {
    void this.passwordAutoHideService.setAutoHide(!this.autoHide());
  }

  protected async toggleRunInBackground(): Promise<void> {
    await this.desktopSettingsService.setRunInBackground(!this.runInBackground());
  }

  protected async setClipboardDelay(event: Event): Promise<void> {
    const raw = (event.target as HTMLSelectElement).value;
    const match = this.clipboardDelayOptions.find((opt) => opt.value === raw);
    if (match) {
      await this.autofillSettingsService.setClearClipboardDelay(match.delay);
    }
  }

  protected async setLocale(event: Event): Promise<void> {
    const next = (event.target as HTMLSelectElement).value;
    await this.i18n.setLocale(next);
    this.toast.show(this.i18n.t("languageChanged"));
  }

  protected removeShortcut(id: DesktopShortcut): void {
    void this.shortcutsService.setEnabled(id, false);
  }

  protected resetShortcuts(): void {
    void this.shortcutsService.reset();
  }

  protected async lock(): Promise<void> {
    const userId = await this.userId();
    await this.lockService.lock(userId, LockSource.Manual);
  }

  protected async changeMasterPassword(): Promise<void> {
    await this.dialogService.openSimpleDialog({
      title: { key: "masterPassword" },
      content: { key: "localChangePasswordNotice" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: null,
      type: "info",
    });
  }

  protected openSource(): void {
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass");
  }

  protected openChangelog(): void {
    this.platformUtilsService.launchUri(
      "https://github.com/xieboss778/LocalPass/blob/main/CHANGELOG.md",
    );
  }

  /** 预览打开时复制同一份文本；没有预览才现场构建。 */
  protected async toggleDiagnostics(): Promise<void> {
    if (this.diagnostics() != null) {
      this.diagnostics.set(null);
      return;
    }

    try {
      this.diagnostics.set(await this.buildDiagnostics());
    } catch (error) {
      this.logService.error("Error building diagnostic report: ", error);
      this.toast.show(this.i18n.t("diagnosticsCopyFailed"));
    }
  }

  protected async copyDiagnostics(): Promise<void> {
    try {
      const report = this.diagnostics() ?? (await this.buildDiagnostics());
      this.diagnostics.set(report);
      this.platformUtilsService.copyToClipboard(report);
      this.toast.show(this.i18n.t("diagnosticsCopied"));
    } catch (error) {
      this.logService.error("Error copying diagnostic report: ", error);
      this.toast.show(this.i18n.t("diagnosticsCopyFailed"));
    }
  }

  /**
   * 报告只含版本、平台、设置、聚合计数和同步状态；条目内容从不进入这个构造函数的输入类型。
   */
  private async buildDiagnostics(): Promise<string> {
    const userId = await this.userId();
    const [syncState, syncConfigured, pendingConflicts] = await Promise.all([
      this.syncService.getSyncState(userId),
      this.syncService.hasConfig(userId),
      this.syncService.getPendingConflicts(userId),
    ]);
    await this.refreshVaultCounts();

    return buildDiagnosticReport({
      appVersion: this.version(),
      client: "desktop",
      device: this.platformUtilsService.getDeviceString(),
      locale: this.locale(),
      theme: this.selectedTheme(),
      itemCount: this.itemCount(),
      folderCount: this.folderCount(),
      archiveCount: this.archiveCount(),
      trashCount: this.trashCount(),
      syncConfigured,
      syncPending: syncState.pending,
      syncGeneration: syncState.generation,
      conflictCount: pendingConflicts.length,
      electronVersion: ipc.platform.versions.electron,
      userAgent: navigator.userAgent,
      generatedAt: new Date(),
    });
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  /** 自动锁定行只显示当前超时；具体修改在展开的内联表单里完成。 */
  private describeTimeout(timeout: VaultTimeout): string {
    if (typeof timeout === "string") {
      return this.i18n.t(timeout);
    }

    if (timeout === VaultTimeoutNumberType.Immediately) {
      return this.i18n.t("immediately");
    }

    const minutes = `${timeout} ${this.i18n.t("minutes")}`;
    return this.i18n.t("autoLockSummary", minutes);
  }

  private async refreshBackupStatus(): Promise<void> {
    const userId = await this.userId();
    const state = await this.syncService.getSyncState(userId);
    this.lastSyncedAt.set(state.lastSyncedAt);
  }

  private async refreshVaultCounts(): Promise<void> {
    const userId = await this.userId();
    const [ciphers, folders] = await Promise.all([
      firstValueFrom(this.cipherService.cipherViews$(userId)),
      firstValueFrom(this.folderService.folderViews$(userId)),
    ]);
    this.trashCount.set(ciphers.filter((cipher) => cipher.isDeleted).length);
    this.archiveCount.set(
      ciphers.filter((cipher) => cipher.isArchived && !cipher.isDeleted).length,
    );
    this.folderCount.set(folders.filter((folder) => folder.id !== "").length);
    this.itemCount.set(ciphers.filter((cipher) => !cipher.isDeleted && !cipher.isArchived).length);
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
