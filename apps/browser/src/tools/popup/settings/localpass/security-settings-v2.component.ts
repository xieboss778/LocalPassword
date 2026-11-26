import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LpPopupHeaderComponent } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule, LocalPassIcon } from "@localpass/components";
import { SessionTimeoutSettingsComponent } from "@localpass/key-management-ui";
import { LockService, LockSource } from "@localpass/unlock";

interface SecurityRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly descKey: string;
  readonly route?: string;
  readonly action?: "lock";
}

const UNLOCK_ROWS: readonly SecurityRow[] = [
  {
    icon: "bwi-shield",
    labelKey: "masterPassword",
    descKey: "masterPasswordLocalDesc",
  },
  {
    icon: "bwi-key",
    labelKey: "securityKey",
    descKey: "securityKeyRegistered",
    route: "/security-key",
  },
  {
    icon: "bwi-unlock",
    labelKey: "accountSecurity",
    descKey: "unlockOptionsDesc",
    route: "/account-security",
  },
];

/**
 * 安全设置（扩展弹窗）。
 *
 * 自动锁定直接用 `bit-session-timeout-settings`：它不是只读展示，改完立即生效。
 * Touch ID 是 macOS 桌面端的能力，扩展里不出现这个开关——只在页尾说一句它在哪里。
 */
@Component({
  selector: "security-settings-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent, SessionTimeoutSettingsComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('security')"
        [sub]="i18n.t('securitySubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("unlockAndAccess") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            @for (row of unlockRows; track row.labelKey) {
              <button
                type="button"
                [disabled]="!row.route"
                class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 tw-text-start last:tw-border-b-0 enabled:hover:tw-bg-background-alt disabled:tw-cursor-default"
                (click)="go(row.route)"
              >
                <span
                  class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
                >
                  <bit-icon [name]="row.icon" class="tw-text-base"></bit-icon>
                </span>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                    i18n.t(row.labelKey)
                  }}</span>
                  <span class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">{{
                    i18n.t(row.descKey)
                  }}</span>
                </span>
                @if (row.route) {
                  <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
                }
              </button>
            }
          </div>
        </section>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("autoLock") }}
          </h2>
          <div class="tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3">
            <bit-session-timeout-settings></bit-session-timeout-settings>
          </div>
        </section>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("session") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            <button
              type="button"
              class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-text-start hover:tw-bg-background-alt"
              (click)="lock()"
            >
              <span
                class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
              >
                <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                  i18n.t("lockNow")
                }}</span>
                <span class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">{{
                  i18n.t("lockVaultHint")
                }}</span>
              </span>
              <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
            </button>
          </div>
        </section>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("advanced") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            <button
              type="button"
              class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-text-start hover:tw-bg-background-alt"
              (click)="go('/settings-network-v2')"
            >
              <span
                class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
              >
                <bit-icon name="bwi-globe" class="tw-text-base"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                  i18n.t("networkGate")
                }}</span>
                <span class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">{{
                  i18n.t("networkGateOn")
                }}</span>
              </span>
              <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
            </button>
          </div>
        </section>

        <p class="tw-px-2.5 tw-pt-2 tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ i18n.t("touchIdDesktopOnly") }}
        </p>
      </div>
    </div>
  `,
})
export class SecuritySettingsV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly lockService = inject(LockService);

  protected readonly unlockRows = UNLOCK_ROWS;

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected go(route: string | undefined): void {
    if (route) {
      void this.router.navigateByUrl(route);
    }
  }

  protected async lock(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService.lock(userId, LockSource.Manual);
    await this.router.navigateByUrl("/");
  }
}
