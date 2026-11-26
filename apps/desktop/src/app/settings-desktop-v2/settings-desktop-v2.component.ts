import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { DeviceType } from "@localpass/common/enums";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@localpass/common/platform/abstractions/validation.service";
import { DialogService } from "@localpass/components";
import { BiometricStateService, BiometricsStatus, KeyService } from "@localpass/key-management";
import { AutoUnlockService } from "@localpass/unlock";

import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";

/**
 * 桌面端设置（方向 C）。
 *
 * **Touch ID 只在这里出现**：仅当运行在 macOS 且系统真的能用（`canEnableBiometricUnlock`）
 * 才渲染那一行；Windows/Linux 与扩展里都不会看到它。开关状态存在 `BiometricStateService`，
 * 打开时会顺手把持久化密钥登记好，关掉时删掉密钥。
 */
@Component({
  selector: "settings-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header
        [title]="i18n.t('settings')"
        [sub]="i18n.t('settingsSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group [label]="i18n.t('unlockAndAccess')">
          <lp-row
            emoji="🔐"
            [label]="i18n.t('masterPassword')"
            [value]="i18n.t('change')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/change-password')"
          />
          @if (supportsTouchId()) {
            <lp-row
              emoji="👆"
              [label]="i18n.t('touchIdUnlock')"
              [sub]="i18n.t('touchIdMacOnly')"
              [toggle]="touchIdEnabled()"
              [clickable]="true"
              (activated)="toggleTouchId()"
            />
          }
          <lp-row
            emoji="⏱️"
            [label]="i18n.t('autoLock')"
            [value]="i18n.t('autoLock15')"
            [clickable]="false"
          />
        </lp-group>

        <lp-group [label]="i18n.t('backupTitle')">
          <lp-row
            emoji="☁️"
            [label]="i18n.t('backupTitle')"
            [value]="i18n.t('backupManual')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/backup-settings')"
          />
          <lp-row
            emoji="⤒"
            [label]="i18n.t('importData')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/import')"
          />
        </lp-group>

        <lp-group [label]="i18n.t('system')">
          <lp-row
            emoji="🛡️"
            [label]="i18n.t('networkGate')"
            [value]="i18n.t('networkGateOn')"
            [clickable]="false"
          />
          <lp-row
            emoji="🗑️"
            [label]="i18n.t('trash')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/trash-desktop-v2')"
          />
        </lp-group>

        @if (errorMessage()) {
          <p class="tw-px-4 tw-pt-3 tw-text-[11px] tw-text-[var(--lp-danger)]">
            {{ errorMessage() }}
          </p>
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
  private readonly router = inject(Router);

  protected readonly supportsTouchId = signal(false);
  protected readonly touchIdEnabled = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const isMac = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;
    if (!isMac) {
      // Windows Hello / Linux 不在「Touch ID」这条承诺里，这里直接不渲染那一行。
      this.supportsTouchId.set(false);
      return;
    }

    this.supportsTouchId.set(await this.biometricsService.canEnableBiometricUnlock());
    const userId = await this.userId();
    this.touchIdEnabled.set(
      (await this.biometricsService.getBiometricsStatusForUser(userId)) ===
        BiometricsStatus.Available,
    );
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

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
