import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LpPageHeaderComponent, LpRowComponent } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";
import { VaultBackupSyncService } from "@localpass/local-vault";

interface BlockedHost {
  readonly host: string;
  readonly categoryKey: string;
}

const RECENT_BLOCKED: readonly BlockedHost[] = [
  { host: "sentry.io", categoryKey: "networkGateErrorReporting" },
  { host: "google-analytics.com", categoryKey: "networkGateTelemetry" },
  { host: "cdn.jsdelivr.net", categoryKey: "networkGateFonts" },
];

/**
 * 桌面端网络闸门（只读说明页）。
 *
 * 页面本身不发请求、不解密：把 `NetworkGatePolicy` 的规则与存储端点摊开给用户看。
 */
@Component({
  selector: "network-gate-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPageHeaderComponent, LpRowComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header
        [title]="i18n.t('networkGate')"
        [sub]="i18n.t('networkGateSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        <div
          class="tw-flex tw-items-start tw-gap-2.5 tw-rounded-xl tw-border tw-border-border-brand-soft tw-bg-bg-brand-softer tw-p-3.5 tw-text-sm tw-leading-relaxed tw-text-main"
        >
          <bit-icon name="bwi-shield" class="tw-mt-0.5 tw-text-fg-brand"></bit-icon>
          <span>{{ i18n.t("networkGateIntro") }}</span>
        </div>

        <div class="tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
          {{ i18n.t("networkGateAllowlist") }}
        </div>
        <div
          class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
        >
          <lp-row
            [label]="i18n.t('networkGateStorage')"
            [sub]="storageSub()"
            [toggle]="true"
            [clickable]="false"
          ></lp-row>
          <lp-row
            [label]="i18n.t('networkGateBreach')"
            [sub]="i18n.t('networkGateBreachDefaultOff')"
            [toggle]="false"
            [clickable]="false"
          ></lp-row>
        </div>

        <div class="tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-text-muted">
          {{ i18n.t("networkGateRecentBlocked") }}
        </div>
        <div
          class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
        >
          @for (entry of blocked; track entry.host) {
            <div
              class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
            >
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-truncate tw-text-sm tw-text-main">{{ entry.host }}</span>
                <span class="tw-block tw-text-xs tw-text-muted"
                  >{{ i18n.t(entry.categoryKey) }} · {{ i18n.t("blockedLabel") }}</span
                >
              </span>
              <span class="tw-text-xs tw-text-muted">{{
                i18n.t("networkGateBlockedTimes", 0)
              }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class NetworkGateDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly accountService = inject(AccountService);

  protected readonly blocked = RECENT_BLOCKED;
  protected readonly storageHost = signal("");

  protected readonly storageSub = computed(() => {
    const host = this.storageHost() || this.i18n.t("networkGateNotConfigured");
    return `${host} · ${this.i18n.t("networkGateOnlyManualSync")}`;
  });

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const config = await this.syncService.getConfig(userId);
    this.storageHost.set(hostOf(config?.endpoint ?? ""));
  }
}

function hostOf(endpoint: string): string {
  if (!endpoint) {
    return "";
  }
  try {
    return new URL(endpoint).host.toLowerCase();
  } catch {
    return endpoint;
  }
}
