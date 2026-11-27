import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LpPopupHeaderComponent, LpRowComponent } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { PinServiceAbstraction } from "@localpass/common/key-management/pin/pin.service.abstraction";
import {
  VaultTimeout,
  VaultTimeoutNumberType,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@localpass/common/key-management/vault-timeout";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { DialogService, IconModule } from "@localpass/components";
import {
  LocalWebAuthnPrfEnrollmentService,
  SessionTimeoutSettingsComponent,
} from "@localpass/key-management-ui";
import { LockService, LockSource } from "@localpass/unlock";

/**
 * 安全设置（扩展弹窗）。
 *
 * 自动锁定直接用 `bit-session-timeout-settings`：它不是只读展示，改完立即生效。
 * PIN 开关读真实的 PIN 状态：开启去账户安全页设置，关闭前确认再解除。
 * Touch ID 是 macOS 桌面端的能力，扩展里只保留一个禁用开关和页尾说明。
 */
@Component({
  selector: "security-settings-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent, LpRowComponent, SessionTimeoutSettingsComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('securitySettings')"
        [sub]="i18n.t('securitySubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        <section class="tw-pb-2">
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
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
              <div class="tw-border-t tw-border-border-light tw-px-1 tw-py-2">
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
            <div
              class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-px-4 tw-py-3 tw-opacity-60"
              aria-disabled="true"
            >
              <span
                class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
              >
                <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-text-sm tw-text-main">{{
                  i18n.t("fingerprintUnlock")
                }}</span>
                <span class="tw-mt-0.5 tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
                  i18n.t("desktopOnlyMac")
                }}</span>
              </span>
              <span
                role="switch"
                aria-checked="false"
                aria-disabled="true"
                tabindex="-1"
                class="tw-relative tw-h-5 tw-w-9 tw-flex-none tw-rounded-full tw-bg-bg-gray-strong"
              >
                <span
                  class="tw-absolute tw-start-0.5 tw-top-0.5 tw-size-4 tw-rounded-full tw-bg-bg-primary tw-shadow-sm"
                ></span>
              </span>
            </div>
          </div>
        </section>

        <section class="tw-pb-2">
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            <lp-row
              icon="bwi-key"
              [label]="i18n.t('securityKey')"
              [sub]="securityKeyText()"
              [chevron]="true"
              [clickable]="true"
              (activated)="go('/security-key')"
            />
            <lp-row
              icon="bwi-download"
              [label]="i18n.t('encryptedBackup')"
              [sub]="i18n.t('encryptedBackupDesc')"
              [chevron]="true"
              [clickable]="true"
              (activated)="go('/backup-settings')"
            />
          </div>
        </section>

        <section class="tw-pb-2">
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
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

        <p class="tw-px-2.5 tw-pt-2 tw-text-center tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ i18n.t("touchIdDesktopOnly") }}
        </p>
      </div>
    </div>
  `,
})
export class SecuritySettingsV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly lockService = inject(LockService);
  private readonly pinService = inject(PinServiceAbstraction);
  private readonly enrollmentService = inject(LocalWebAuthnPrfEnrollmentService);
  private readonly dialogService = inject(DialogService);
  private readonly vaultTimeoutService = inject(VaultTimeoutSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pinSet = signal(false);
  protected readonly securityKeyCount = signal(0);
  protected readonly autoLockExpanded = signal(false);
  protected readonly autoLockLabel = signal("");
  protected readonly securityKeyText = computed(() =>
    this.securityKeyCount() > 0
      ? this.i18n.t("registeredKeysCount", this.securityKeyCount().toString())
      : this.i18n.t("securityKeyDescription"),
  );

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.pinSet.set(await this.pinService.isPinSet(userId));
    this.securityKeyCount.set(await this.enrollmentService.count(userId));
    this.vaultTimeoutService
      .getVaultTimeoutByUserId$(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((timeout) => this.autoLockLabel.set(this.timeoutLabel(timeout)));
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected async togglePin(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    if (!this.pinSet()) {
      await this.router.navigateByUrl("/account-security");
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
