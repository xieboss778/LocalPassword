import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  LpPopupHeaderComponent,
  LpRowComponent,
  LpToastService,
  PasswordAutoHideService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { ClearClipboardDelaySetting } from "@localpass/common/autofill/types";
import { PinServiceAbstraction } from "@localpass/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeout,
  VaultTimeoutNumberType,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@localpass/common/key-management/vault-timeout";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { DialogService, IconModule } from "@localpass/components";
import {
  BiometricStateService,
  BiometricsService,
  BiometricsStatus,
} from "@localpass/key-management";
import {
  LocalWebAuthnPrfEnrollmentService,
  SessionTimeoutSettingsComponent,
} from "@localpass/key-management-ui";
import { LockService, LockSource } from "@localpass/unlock";

import { SetPinComponent } from "../../../../auth/popup/components/set-pin.component";
import {
  NativeMessagingPermissionDialogComponent,
  NativeMessagingPermissionDialogType,
} from "../../../../key-management/shared-unlock/popup/native-messaging-permission-dialog.component";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";

/**
 * 安全设置（扩展弹窗）。
 *
 * 自动锁定直接用 `bit-session-timeout-settings`：它不是只读展示，改完立即生效。
 * PIN 开关读真实的 PIN 状态：开启去账户安全页设置，关闭前确认再解除。
 * 触控 ID 行展示桌面端代理桥接的真实状态；扩展没有原生指纹接口，开启后仍由
 * `com.localpass.desktop` 请求 Mac 确认。
 */
@Component({
  selector: "security-settings-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent, LpRowComponent, SessionTimeoutSettingsComponent],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('securitySettings')"
        [sub]="i18n.t('securitySubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        <section class="tw-pb-2">
          <div class="agy-grp">
            <lp-row
              icon="bwi-shield"
              [label]="i18n.t('masterPassword')"
              [sub]="i18n.t('masterPasswordLocalDesc')"
            />
            <lp-row
              icon="bwi-clock"
              [label]="i18n.t('autoLock')"
              [sub]="autoLockLabel()"
              [chevron]="true"
              [clickable]="true"
              (activated)="autoLockExpanded.set(!autoLockExpanded())"
            />
            @if (autoLockExpanded()) {
              <div class="tw-p-1">
                <bit-session-timeout-settings></bit-session-timeout-settings>
              </div>
            }
            <lp-row
              icon="bwi-pin"
              [label]="i18n.t('pinUnlock')"
              [sub]="i18n.t('pinUnlockDesc')"
              [toggle]="pinSet()"
              [clickable]="true"
              (activated)="togglePin()"
            />
            <lp-row
              icon="bwi-lock"
              [label]="i18n.t('fingerprintUnlock')"
              [sub]="touchIdStatusLabel()"
              [toggle]="touchIdEnabled()"
              [clickable]="true"
              (activated)="toggleTouchId()"
            />
          </div>
        </section>

        <section class="tw-pb-2">
          <div class="agy-grp">
            <lp-row
              icon="bwi-key"
              [label]="i18n.t('securityKey')"
              [sub]="securityKeyText()"
              [chevron]="true"
              [clickable]="true"
              (activated)="go('/security-key')"
            />
            <lp-row
              icon="bwi-copy"
              [label]="i18n.t('clearClipboard')"
              [sub]="i18n.t('clearClipboardDesc')"
              [value]="clipboardLabel()"
              [brand]="true"
              [chevron]="true"
              [clickable]="true"
              (activated)="clipboardExpanded.set(!clipboardExpanded())"
            />
            @if (clipboardExpanded()) {
              <div class="tw-flex tw-flex-wrap tw-gap-1 tw-px-2.5 tw-pb-2.5">
                @for (option of clipboardOptions; track option.value) {
                  <button
                    type="button"
                    class="agy-btn agy-sm"
                    [class.agy-primary]="clipboardDelay() === option.value"
                    (click)="setClipboardDelay(option.value)"
                  >
                    {{ i18n.t(option.labelKey) }}
                  </button>
                }
              </div>
            }
            <lp-row
              icon="bwi-eye-slash"
              [label]="i18n.t('passwordAutoHide')"
              [sub]="i18n.t('passwordAutoHideDesc')"
              [toggle]="autoHide()"
              [clickable]="true"
              (activated)="toggleAutoHide()"
            />
            <lp-row
              icon="bwi-refresh"
              [label]="i18n.t('encryptedBackup')"
              [sub]="i18n.t('encryptedBackupDesc')"
              [chevron]="true"
              [clickable]="true"
              (activated)="go('/backup-settings')"
            />
          </div>
        </section>

        <section class="tw-pb-2">
          <div class="agy-grp">
            <lp-row
              icon="bwi-lock"
              [label]="i18n.t('lockNow')"
              [sub]="i18n.t('lockVaultHint')"
              [chevron]="true"
              [clickable]="true"
              (activated)="lock()"
            />
          </div>
        </section>

        <p class="agy-hint tw-text-center">
          {{ i18n.t("touchIdDesktopOnly") }}
        </p>
      </div>
    </div>
  `,
})
export class SecuritySettingsV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly lockService = inject(LockService);
  private readonly pinService = inject(PinServiceAbstraction);
  private readonly enrollmentService = inject(LocalWebAuthnPrfEnrollmentService);
  private readonly dialogService = inject(DialogService);
  private readonly vaultTimeoutService = inject(VaultTimeoutSettingsService);
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction);
  private readonly passwordAutoHideService = inject(PasswordAutoHideService);
  private readonly biometricsService = inject(BiometricsService);
  private readonly biometricStateService = inject(BiometricStateService);
  private readonly messagingService = inject(MessagingService);
  private readonly toast = inject(LpToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly clipboardOptions: readonly {
    value: ClearClipboardDelaySetting;
    labelKey: string;
  }[] = [
    { value: ClearClipboardDelay.Never, labelKey: "never" },
    { value: ClearClipboardDelay.TenSeconds, labelKey: "tenSeconds" },
    { value: ClearClipboardDelay.TwentySeconds, labelKey: "twentySeconds" },
    { value: ClearClipboardDelay.ThirtySeconds, labelKey: "thirtySeconds" },
    { value: ClearClipboardDelay.OneMinute, labelKey: "oneMinute" },
    { value: ClearClipboardDelay.TwoMinutes, labelKey: "twoMinutes" },
    { value: ClearClipboardDelay.FiveMinutes, labelKey: "fiveMinutes" },
  ];

  protected readonly pinSet = signal(false);
  protected readonly securityKeyCount = signal(0);
  protected readonly autoLockExpanded = signal(false);
  protected readonly clipboardExpanded = signal(false);
  protected readonly autoLockLabel = signal("");
  protected readonly touchIdEnabled = signal(false);
  private readonly touchIdStatus = signal<BiometricsStatus | null>(null);
  private readonly touchIdBusy = signal(false);
  protected readonly autoHide = toSignal(this.passwordAutoHideService.autoHide$, {
    initialValue: true,
  });
  protected readonly clipboardDelay = toSignal(this.autofillSettingsService.clearClipboardDelay$, {
    initialValue: ClearClipboardDelay.ThirtySeconds,
  });
  protected readonly clipboardLabel = computed(() =>
    this.clipboardDelayLabel(this.clipboardDelay()),
  );
  protected readonly securityKeyText = computed(() =>
    this.securityKeyCount() > 0
      ? this.i18n.t("registeredKeysCount", this.securityKeyCount().toString())
      : this.i18n.t("securityKeyDescription"),
  );
  protected readonly touchIdStatusLabel = computed(() => this.touchIdStatusText());

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.pinSet.set(await this.pinService.isPinSet(userId));
    this.securityKeyCount.set(await this.enrollmentService.count(userId));
    this.vaultTimeoutService
      .getVaultTimeoutByUserId$(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((timeout) => this.autoLockLabel.set(this.timeoutLabel(timeout)));

    const [touchIdEnabled, touchIdStatus] = await Promise.all([
      firstValueFrom(this.biometricStateService.biometricUnlockEnabled$(userId)),
      this.readBiometricsStatus(),
    ]);
    this.touchIdEnabled.set(touchIdEnabled);
    this.touchIdStatus.set(touchIdStatus);

    if (
      BrowserPopupUtils.inPopout(window) &&
      this.route.snapshot.queryParamMap.get("autoRequestBiometrics") === "true" &&
      !(await BrowserApi.permissionsGranted(["nativeMessaging"]))
    ) {
      await this.toggleTouchId();
    }
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected async setClipboardDelay(delay: ClearClipboardDelaySetting): Promise<void> {
    await this.autofillSettingsService.setClearClipboardDelay(delay);
    this.clipboardExpanded.set(false);
  }

  protected toggleAutoHide(): void {
    void this.passwordAutoHideService.setAutoHide(!this.autoHide());
  }

  protected async toggleTouchId(): Promise<void> {
    if (this.touchIdBusy()) {
      return;
    }
    this.touchIdBusy.set(true);

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

      if (this.touchIdEnabled()) {
        await this.biometricStateService.setBiometricUnlockEnabled(false, userId);
        this.touchIdEnabled.set(false);
        return;
      }

      const hadPermission = await BrowserApi.permissionsGranted(["nativeMessaging"]);
      if (!hadPermission) {
        if (!BrowserPopupUtils.inPopout(window)) {
          const url = new URL(window.location.href);
          url.hash += (url.hash.includes("?") ? "&" : "?") + "autoRequestBiometrics=true";
          await BrowserPopupUtils.openCurrentPagePopout(window, url.href);
          return;
        }
        const granted = await firstValueFrom(
          NativeMessagingPermissionDialogComponent.open(this.dialogService, {
            type: NativeMessagingPermissionDialogType.Biometrics,
          }).closed,
        );
        if (!granted) {
          return;
        }
        await this.biometricStateService.setBiometricUnlockEnabled(true, userId);
        this.messagingService.send("reloadExtension");
        await BrowserPopupUtils.closeCurrentPopupOrPopout(window);
        return;
      }

      const status = await this.readBiometricsStatus();
      this.touchIdStatus.set(status);
      if (status !== BiometricsStatus.Available) {
        this.toast.show(this.touchIdStatusText());
        return;
      }

      await this.biometricStateService.setBiometricUnlockEnabled(true, userId);
      this.touchIdEnabled.set(true);
    } finally {
      this.touchIdBusy.set(false);
    }
  }

  protected async togglePin(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    if (!this.pinSet()) {
      const dialogRef = SetPinComponent.open(this.dialogService);
      if (!dialogRef) {
        return;
      }
      const enabled = await firstValueFrom(dialogRef.closed);
      if (enabled) {
        this.pinSet.set(true);
        this.toast.show(this.i18n.t("unlockPinSet"));
      }
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removePin" },
      content: { key: "removePinConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    await this.pinService.unsetPin(userId);
    this.pinSet.set(false);
  }

  protected async lock(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService.lock(userId, LockSource.Manual);
    await this.router.navigateByUrl("/");
  }

  private clipboardDelayLabel(delay: ClearClipboardDelaySetting): string {
    switch (delay) {
      case ClearClipboardDelay.Never:
        return this.i18n.t("never");
      case ClearClipboardDelay.TenSeconds:
        return this.i18n.t("tenSeconds");
      case ClearClipboardDelay.TwentySeconds:
        return this.i18n.t("twentySeconds");
      case ClearClipboardDelay.ThirtySeconds:
        return this.i18n.t("thirtySeconds");
      case ClearClipboardDelay.OneMinute:
        return this.i18n.t("oneMinute");
      case ClearClipboardDelay.TwoMinutes:
        return this.i18n.t("twoMinutes");
      case ClearClipboardDelay.FiveMinutes:
        return this.i18n.t("fiveMinutes");
      default:
        return this.i18n.t("thirtySeconds");
    }
  }

  private async readBiometricsStatus(): Promise<BiometricsStatus | null> {
    try {
      return await this.biometricsService.getBiometricsStatus();
    } catch {
      return null;
    }
  }

  private touchIdStatusText(): string {
    if (this.touchIdEnabled()) {
      return this.i18n.t("touchIdBridgeOn");
    }

    switch (this.touchIdStatus()) {
      case BiometricsStatus.Available:
        return this.i18n.t("touchIdBridgeReady");
      case BiometricsStatus.NativeMessagingPermissionMissing:
        return this.i18n.t("touchIdBridgeNeedsPermission");
      case BiometricsStatus.DesktopDisconnected:
        return this.i18n.t("touchIdBridgeOffline");
      case BiometricsStatus.NotEnabledInConnectedDesktopApp:
        return this.i18n.t("touchIdBridgeDesktopSetup");
      default:
        return this.i18n.t("touchIdBridgeUnavailable");
    }
  }

  private timeoutLabel(timeout: VaultTimeout): string {
    switch (timeout) {
      case VaultTimeoutNumberType.Immediately:
        return this.i18n.t("immediately");
      case VaultTimeoutNumberType.OnMinute:
        return this.i18n.t("oneMinute");
      case 5:
        return this.i18n.t("fiveMinutes");
      case 15:
        return this.i18n.t("fifteenMinutes");
      case 30:
        return this.i18n.t("thirtyMinutes");
      case 60:
        return this.i18n.t("oneHour");
      case 240:
        return this.i18n.t("fourHours");
      case VaultTimeoutStringType.OnRestart:
        return this.i18n.t("sessionTimeoutOnRestart");
      case VaultTimeoutStringType.OnLocked:
        return this.i18n.t("onLocked");
      case VaultTimeoutStringType.OnSleep:
        return this.i18n.t("onSleep");
      case VaultTimeoutStringType.OnIdle:
        return this.i18n.t("onIdle");
      case VaultTimeoutStringType.Never:
        return this.i18n.t("never");
      case VaultTimeoutStringType.Custom:
        return this.i18n.t("custom");
      default:
        return `${timeout} ${this.i18n.t("minutes")}`;
    }
  }
}
