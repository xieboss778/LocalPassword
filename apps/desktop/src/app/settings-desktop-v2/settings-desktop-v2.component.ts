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
import { LpPageHeaderComponent, LpRowComponent } from "@localpass/angular/local-ui";
import { formatBackupTimestamp } from "@localpass/angular/tools/backup";
import { LocalPassIcon as LocalPassLogo } from "@localpass/assets/svg";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
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
import {
  ButtonModule,
  DialogService,
  IconModule,
  LocalPassIcon,
  SvgModule,
} from "@localpass/components";
import { BiometricStateService, BiometricsStatus, KeyService } from "@localpass/key-management";
import { SessionTimeoutSettingsComponent } from "@localpass/key-management-ui";
import { VaultBackupSyncService } from "@localpass/local-vault";
import { LockService, LockSource, AutoUnlockService } from "@localpass/unlock";

import { SetPinComponent } from "../../auth/components/set-pin.component";
import { ChangePasswordDialogComponent } from "../../auth/password-management/change-password-dialog.component";
import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";

type SettingsTab = "security" | "vault" | "appearance" | "backup" | "about";

interface SettingsTabSpec {
  readonly id: SettingsTab;
  readonly labelKey: string;
  readonly icon: LocalPassIcon;
}

const TABS: readonly SettingsTabSpec[] = [
  { id: "security", labelKey: "security", icon: "bwi-shield" },
  { id: "vault", labelKey: "vault", icon: "bwi-vault" },
  { id: "appearance", labelKey: "appearance", icon: "bwi-palette" },
  { id: "backup", labelKey: "backupTab", icon: "bwi-download" },
  { id: "about", labelKey: "about", icon: "bwi-info-circle" },
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
  imports: [
    JslibModule,
    ButtonModule,
    IconModule,
    SvgModule,
    SessionTimeoutSettingsComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header
        [title]="i18n.t('settings')"
        [sub]="i18n.t('settingsSubtitle')"
      ></lp-page-header>

      <div class="tw-flex tw-min-h-0 tw-flex-1 tw-gap-6 tw-px-7 tw-pb-7">
        <nav
          class="tw-flex tw-flex-none tw-flex-col tw-gap-0.5"
          [style.width.px]="200"
          [attr.aria-label]="i18n.t('settings')"
        >
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              class="tw-flex tw-items-center tw-gap-2.5 tw-rounded-lg tw-px-2.5 tw-py-2 tw-text-start tw-text-sm tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
              [class.tw-bg-background]="activeTab() === tab.id"
              [class.tw-font-semibold]="activeTab() === tab.id"
              [class.tw-text-main]="activeTab() === tab.id"
              [class.tw-shadow-sm]="activeTab() === tab.id"
              [attr.aria-current]="activeTab() === tab.id ? 'page' : null"
              data-testid="settings_tab"
              (click)="activeTab.set(tab.id)"
            >
              <bit-icon
                [name]="tab.icon"
                fixedWidth
                class="tw-w-5 tw-text-center"
                [class.tw-text-fg-brand]="activeTab() === tab.id"
              ></bit-icon>
              <span>{{ i18n.t(tab.labelKey) }}</span>
            </button>
          }
        </nav>

        <div class="tw-min-h-0 tw-w-full tw-max-w-3xl tw-flex-1 tw-overflow-y-auto">
          @switch (activeTab()) {
            @case ("security") {
              <div class="tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("unlockAndAccess") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3"
                  data-testid="settings_password_row"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("masterPassword")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("masterPasswordLocalDesc")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    data-testid="settings_password_change"
                    (click)="changeMasterPassword()"
                  >
                    {{ i18n.t("change") }}
                  </button>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3"
                  data-testid="settings_autolock_row"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("autoLock") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{ timeoutSummary() }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    data-testid="settings_autolock_change"
                    (click)="timeoutEditing.set(!timeoutEditing())"
                  >
                    {{ i18n.t(timeoutEditing() ? "done" : "change") }}
                  </button>
                </div>
                @if (timeoutEditing()) {
                  <div
                    class="tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                  >
                    <bit-session-timeout-settings></bit-session-timeout-settings>
                  </div>
                }
                <lp-row
                  [label]="i18n.t('unlockWithPin')"
                  [sub]="i18n.t('pinUnlockDesc')"
                  [toggle]="pinEnabled()"
                  [clickable]="true"
                  (activated)="togglePin()"
                ></lp-row>
                @if (supportsTouchId()) {
                  <lp-row
                    [label]="i18n.t('touchIdUnlock')"
                    [sub]="i18n.t('touchIdMacOnly')"
                    [toggle]="touchIdEnabled()"
                    [clickable]="true"
                    (activated)="toggleTouchId()"
                  ></lp-row>
                }
              </div>

              <div class="tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("securityKeysGroup") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <lp-row
                  [label]="i18n.t('securityKey')"
                  [sub]="i18n.t('securityKeySettingsDesc')"
                  [clickable]="false"
                ></lp-row>
              </div>

              <div class="tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("session") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-px-4 tw-py-3"
                  data-testid="settings_lock_row"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("lockVaultNow")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("lockVaultNoDataLoss")
                    }}</span>
                  </span>
                  <button type="button" bitButton buttonType="secondary" (click)="lock()">
                    {{ i18n.t("lock") }}
                  </button>
                </div>
              </div>
              <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("touchIdNote") }}
              </p>
            }

            @case ("vault") {
              <div class="tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("vault") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("myFolders") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("folderCount", folderCount())
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    data-testid="settings_folders"
                    (click)="go('/folders-desktop-v2')"
                  >
                    {{ i18n.t("manage") }}
                  </button>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("trash") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("trashSettingsSummary", trashCount())
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    (click)="go('/trash-desktop-v2')"
                  >
                    {{ i18n.t("openAction") }}
                  </button>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("importNoun") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("importSettingsDesc")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    data-testid="settings_import"
                    (click)="go('/import')"
                  >
                    {{ i18n.t("importVerb") }}
                  </button>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("exportNoun") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("exportRowDesc")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    (click)="go('/export')"
                  >
                    {{ i18n.t("exportVerb") }}
                  </button>
                </div>
              </div>

              <div class="tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("advanced") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("networkGate")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("networkGateSubtitle")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    (click)="go('/network-gate')"
                  >
                    {{ i18n.t("viewAction") }}
                  </button>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("dataAndSafety")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("dataSafetySettingsDesc")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    (click)="go('/data-safety')"
                  >
                    {{ i18n.t("viewAction") }}
                  </button>
                </div>
              </div>
            }

            @case ("appearance") {
              <div class="tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("theme") }}
              </div>
              <div class="tw-grid tw-grid-cols-3 tw-gap-4" role="radiogroup">
                @for (theme of themes; track theme.value) {
                  <button
                    type="button"
                    role="radio"
                    class="tw-flex tw-min-w-0 tw-flex-col tw-gap-2 tw-rounded-xl tw-border tw-bg-background tw-p-2.5 tw-text-start"
                    [class.tw-border-border-brand]="selectedTheme() === theme.value"
                    [class.tw-border-border-light]="selectedTheme() !== theme.value"
                    [attr.aria-checked]="selectedTheme() === theme.value"
                    (click)="setTheme(theme.value)"
                  >
                    <span
                      class="tw-relative tw-block tw-h-14 tw-overflow-hidden tw-rounded-lg tw-border tw-border-border-light"
                    >
                      @if (theme.value === themeTypes.Light) {
                        <span
                          class="tw-flex tw-h-full tw-flex-col tw-gap-1 tw-bg-bg-primary tw-p-2"
                        >
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
                          <span
                            class="tw-flex tw-w-1/2 tw-flex-col tw-gap-1 tw-bg-bg-primary tw-p-2"
                          >
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
                    <span class="tw-block tw-text-sm tw-font-semibold tw-text-main">{{
                      i18n.t(theme.labelKey)
                    }}</span>
                    <span class="tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
                      i18n.t(theme.descKey)
                    }}</span>
                  </button>
                }
              </div>

              <div class="tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("language") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-px-4 tw-py-3">
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("interfaceLanguage")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("simplifiedChinese")
                    }}</span>
                  </span>
                </div>
              </div>
              <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("themeOnlyDisplayNotice") }}
              </p>
            }

            @case ("backup") {
              <div class="tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("cloudBackupManualGroup") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("lastSynced") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{ lastSyncedLabel() }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    (click)="go('/backup-settings')"
                  >
                    {{ i18n.t("syncNow") }}
                  </button>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("backupStorage")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("backupSubtitle")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    data-testid="settings_backup_config"
                    (click)="go('/backup-config')"
                  >
                    {{ i18n.t("configure") }}
                  </button>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("restoreFromBackup")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("restoreSettingsDesc")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    data-testid="settings_restore"
                    (click)="go('/restore')"
                  >
                    {{ i18n.t("restoreAction") }}
                  </button>
                </div>
              </div>

              <div class="tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
                {{ i18n.t("localBackup") }}
              </div>
              <div
                class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-px-4 tw-py-3">
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("exportLocalRowTitle")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("exportLocalRowDesc")
                    }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    (click)="go('/export')"
                  >
                    {{ i18n.t("exportVerb") }}
                  </button>
                </div>
              </div>
              <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("settingsNoteBackup") }}
              </p>
            }

            @case ("about") {
              <div
                class="tw-flex tw-flex-col tw-items-start tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5"
              >
                <bit-svg
                  class="tw-size-12 tw-flex-none"
                  [content]="logo"
                  [ariaLabel]="i18n.t('appLogoLabel')"
                ></bit-svg>
                <div class="tw-mt-3 tw-min-w-0">
                  <div class="tw-text-lg tw-font-semibold tw-text-main">LocalPass</div>
                  <div class="tw-text-sm tw-text-muted">
                    {{ i18n.t("version", version()) }}
                  </div>
                  <p class="tw-mb-0 tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-muted">
                    {{ i18n.t("aboutDescription") }}
                  </p>
                </div>
              </div>
              <div
                class="tw-mt-4 tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("privacy") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("privacyRowDesc")
                    }}</span>
                  </span>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("license") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("licenseGpl")
                    }}</span>
                  </span>
                </div>
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
                >
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{
                      i18n.t("sourceAddress")
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{ sourceUrl }}</span>
                  </span>
                  <button
                    type="button"
                    bitButton
                    buttonType="primaryGhost"
                    size="small"
                    class="!tw-text-fg-brand"
                    (click)="openSource()"
                  >
                    {{ i18n.t("openAction") }}
                  </button>
                </div>
              </div>
            }
          }

          @if (errorMessage()) {
            <p class="tw-pt-3 tw-text-sm tw-text-fg-danger">{{ errorMessage() }}</p>
          }
        </div>
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
  protected readonly version = signal("");
  protected readonly lastSyncedAt = signal<string | null>(null);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });
  protected readonly lastSyncedLabel = computed(() =>
    formatBackupTimestamp(this.lastSyncedAt(), this.locale(), this.i18n),
  );
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly folderCount = signal(0);
  protected readonly trashCount = signal(0);

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

  protected async lock(): Promise<void> {
    const userId = await this.userId();
    await this.lockService.lock(userId, LockSource.Manual);
  }

  protected changeMasterPassword(): void {
    this.dialogService.open(ChangePasswordDialogComponent);
  }

  protected openSource(): void {
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass");
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
    this.folderCount.set(folders.filter((folder) => folder.id !== "").length);
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
