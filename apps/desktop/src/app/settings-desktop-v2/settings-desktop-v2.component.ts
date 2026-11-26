import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { LocalPassIcon as LocalPassLogo } from "@localpass/assets/svg";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { DeviceType } from "@localpass/common/enums";
import { PinServiceAbstraction } from "@localpass/common/key-management/pin/pin.service.abstraction";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@localpass/common/platform/abstractions/validation.service";
import { Theme, ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";
import { ThemeStateService } from "@localpass/common/platform/theming/theme-state.service";
import {
  ButtonModule,
  DialogService,
  IconModule,
  LocalPassIcon,
  SvgModule,
} from "@localpass/components";
import { BiometricStateService, BiometricsStatus, KeyService } from "@localpass/key-management";
import { SessionTimeoutSettingsComponent } from "@localpass/key-management-ui";
import { VaultBackupService, VaultBackupSyncService } from "@localpass/local-vault";
import { LockService, LockSource, AutoUnlockService } from "@localpass/unlock";

import { SetPinComponent } from "../../auth/components/set-pin.component";
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
  { id: "backup", labelKey: "backupTitle", icon: "bwi-download" },
  { id: "about", labelKey: "about", icon: "bwi-info-circle" },
];

interface ThemeOption {
  readonly value: Theme;
  readonly labelKey: string;
  readonly descKey: string;
  readonly icon: LocalPassIcon;
}

const THEMES: readonly ThemeOption[] = [
  { value: ThemeTypes.Light, labelKey: "light", descKey: "themeLightDesc", icon: "bwi-brush" },
  { value: ThemeTypes.Dark, labelKey: "dark", descKey: "themeDarkDesc", icon: "bwi-palette" },
  {
    value: ThemeTypes.System,
    labelKey: "default",
    descKey: "themeSystemDesc",
    icon: "bwi-desktop",
  },
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
    LpGroupComponent,
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
          class="tw-flex tw-w-48 tw-flex-none tw-flex-col tw-gap-0.5"
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
              (click)="activeTab.set(tab.id)"
            >
              <bit-icon [name]="tab.icon" fixedWidth class="tw-w-5 tw-text-center"></bit-icon>
              <span>{{ i18n.t(tab.labelKey) }}</span>
            </button>
          }
        </nav>

        <div class="tw-min-h-0 tw-max-w-3xl tw-flex-1 tw-overflow-y-auto">
          @switch (activeTab()) {
            @case ("security") {
              <lp-group [label]="i18n.t('unlockAndAccess')">
                <lp-row
                  icon="bwi-lock"
                  [label]="i18n.t('masterPassword')"
                  [sub]="i18n.t('masterPasswordLocalDesc')"
                  [clickable]="false"
                ></lp-row>
                <lp-row
                  icon="bwi-pin"
                  [label]="i18n.t('unlockWithPin')"
                  [toggle]="pinEnabled()"
                  [clickable]="true"
                  (activated)="togglePin()"
                ></lp-row>
                @if (supportsTouchId()) {
                  <lp-row
                    icon="bwi-unlock"
                    [label]="i18n.t('touchIdUnlock')"
                    [sub]="i18n.t('touchIdMacOnly')"
                    [toggle]="touchIdEnabled()"
                    [clickable]="true"
                    (activated)="toggleTouchId()"
                  ></lp-row>
                }
              </lp-group>

              <lp-group [label]="i18n.t('autoLock')">
                <div class="tw-px-4 tw-py-3">
                  <bit-session-timeout-settings></bit-session-timeout-settings>
                </div>
              </lp-group>

              <lp-group [label]="i18n.t('session')">
                <div class="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-3">
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t("lockVault") }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t("lockVaultHint")
                    }}</span>
                  </span>
                  <button type="button" bitButton buttonType="secondary" (click)="lock()">
                    {{ i18n.t("lockVault") }}
                  </button>
                </div>
              </lp-group>
            }

            @case ("vault") {
              <lp-group [label]="i18n.t('vault')">
                <lp-row
                  icon="bwi-folder"
                  [label]="i18n.t('myFolders')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/folders-desktop-v2')"
                ></lp-row>
                <lp-row
                  icon="bwi-trash"
                  [label]="i18n.t('trash')"
                  [value]="i18n.t('trashHint')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/trash-desktop-v2')"
                ></lp-row>
                <lp-row
                  icon="bwi-import"
                  [label]="i18n.t('importData')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/import')"
                ></lp-row>
                <lp-row
                  icon="bwi-download"
                  [label]="i18n.t('exportData')"
                  [value]="i18n.t('exportSettingsDesc')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/export')"
                ></lp-row>
              </lp-group>

              <lp-group [label]="i18n.t('advanced')">
                <lp-row
                  icon="bwi-globe"
                  [label]="i18n.t('networkGate')"
                  [sub]="i18n.t('networkGateSubtitle')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/network-gate')"
                ></lp-row>
                <lp-row
                  icon="bwi-lock"
                  [label]="i18n.t('dataAndSafety')"
                  [sub]="i18n.t('dataAndSafetySubtitle')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/data-safety')"
                ></lp-row>
              </lp-group>
            }

            @case ("appearance") {
              <div
                class="tw-px-1 tw-pt-1 tw-pb-3 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-muted"
              >
                {{ i18n.t("theme") }}
              </div>
              <div class="tw-grid tw-gap-2">
                @for (theme of themes; track theme.value) {
                  <button
                    type="button"
                    class="tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-bg-background tw-p-4 tw-text-start"
                    [class.tw-border-border-brand]="selectedTheme() === theme.value"
                    [class.tw-bg-bg-brand-softer]="selectedTheme() === theme.value"
                    [class.tw-border-border-light]="selectedTheme() !== theme.value"
                    [attr.aria-pressed]="selectedTheme() === theme.value"
                    (click)="setTheme(theme.value)"
                  >
                    <span
                      class="tw-grid tw-size-9 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
                    >
                      <bit-icon [name]="theme.icon"></bit-icon>
                    </span>
                    <span class="tw-min-w-0 tw-flex-1">
                      <span class="tw-block tw-text-sm tw-font-semibold tw-text-main">{{
                        i18n.t(theme.labelKey)
                      }}</span>
                      <span class="tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
                        i18n.t(theme.descKey)
                      }}</span>
                    </span>
                    @if (selectedTheme() === theme.value) {
                      <bit-icon name="bwi-check" class="tw-text-fg-brand"></bit-icon>
                    }
                  </button>
                }
              </div>
              <lp-group [label]="i18n.t('language')">
                <lp-row
                  icon="bwi-globe"
                  [label]="i18n.t('language')"
                  [value]="i18n.t('simplifiedChinese')"
                  [clickable]="false"
                ></lp-row>
              </lp-group>
              <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("themeOnlyDisplayNotice") }}
              </p>
            }

            @case ("backup") {
              <lp-group [label]="i18n.t('backupTitle')">
                <lp-row
                  icon="bwi-download"
                  [label]="i18n.t('lastSynced')"
                  [value]="lastSyncedAt() ?? i18n.t('never')"
                  [clickable]="false"
                ></lp-row>
                <lp-row
                  icon="bwi-download"
                  [label]="i18n.t('lastBackup')"
                  [value]="lastBackupAt() ?? i18n.t('never')"
                  [clickable]="false"
                ></lp-row>
                <lp-row
                  icon="bwi-download"
                  [label]="i18n.t('backupMode')"
                  [value]="i18n.t('backupManual')"
                  [clickable]="false"
                ></lp-row>
                <lp-row
                  icon="bwi-download"
                  [label]="i18n.t('exportData')"
                  [value]="i18n.t('exportSettingsDesc')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/export')"
                ></lp-row>
              </lp-group>
              <lp-group [label]="i18n.t('backupActions')">
                <lp-row
                  icon="bwi-settings"
                  [label]="i18n.t('cloudBackup')"
                  [chevron]="true"
                  [clickable]="true"
                  (activated)="go('/backup-settings')"
                ></lp-row>
              </lp-group>
              <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("backupManualNotice") }}
              </p>
            }

            @case ("about") {
              <div
                class="tw-flex tw-items-center tw-gap-4 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5"
              >
                <bit-svg
                  class="tw-size-12 tw-flex-none"
                  [content]="logo"
                  [ariaLabel]="i18n.t('appLogoLabel')"
                ></bit-svg>
                <div>
                  <div class="tw-text-lg tw-font-semibold tw-text-main">LocalPass</div>
                  <div class="tw-text-sm tw-text-muted">
                    {{ i18n.t("version", version()) }}
                  </div>
                </div>
              </div>
              <lp-group [label]="i18n.t('about')">
                <lp-row
                  icon="bwi-shield"
                  [label]="i18n.t('privacy')"
                  [value]="i18n.t('privacySummary')"
                  [clickable]="false"
                ></lp-row>
                <lp-row
                  icon="bwi-file-text"
                  [label]="i18n.t('license')"
                  [value]="i18n.t('licenseGpl')"
                  [clickable]="false"
                ></lp-row>
                <lp-row
                  icon="bwi-external-link"
                  [label]="i18n.t('sourceCode')"
                  [value]="sourceUrl"
                  [clickable]="true"
                  (activated)="openSource()"
                ></lp-row>
              </lp-group>
              <p class="tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("aboutOfflineNotice") }}
              </p>
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
  private readonly router = inject(Router);
  private readonly themeStateService = inject(ThemeStateService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly backupService = inject(VaultBackupService);
  private readonly lockService = inject(LockService);

  protected readonly tabs = TABS;
  protected readonly themes = THEMES;
  protected readonly logo = LocalPassLogo;
  protected readonly sourceUrl = "github.com/xieboss778/LocalPass";
  protected readonly activeTab = signal<SettingsTab>("security");
  protected readonly supportsTouchId = signal(false);
  protected readonly touchIdEnabled = signal(false);
  protected readonly pinEnabled = signal(false);
  protected readonly selectedTheme = signal<Theme>(ThemeTypes.System);
  protected readonly version = signal("");
  protected readonly lastSyncedAt = signal<string | null>(null);
  protected readonly lastBackupAt = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.version.set(await this.platformUtilsService.getApplicationVersion());
    this.selectedTheme.set(await firstValueFrom(this.themeStateService.selectedTheme$));
    await this.refreshBackupStatus();

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

  protected openSource(): void {
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass");
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  private async refreshBackupStatus(): Promise<void> {
    const userId = await this.userId();
    const [state, settings] = await Promise.all([
      this.syncService.getSyncState(userId),
      this.backupService.getSettings(userId),
    ]);
    this.lastSyncedAt.set(state.lastSyncedAt);
    this.lastBackupAt.set(settings.lastBackupAt ?? null);
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
