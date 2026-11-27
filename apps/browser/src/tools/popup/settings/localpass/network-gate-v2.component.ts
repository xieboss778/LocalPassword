import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LpPopupHeaderComponent, LpRowComponent } from "@localpass/angular/local-ui";
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
 * 网络闸门（弹窗）。
 *
 * 这一页不解密、不发请求：它只把 `NetworkGatePolicy` 的白名单摊开给用户看，
 * 外加当前存储端点。规则本身是纯函数，有单测（`gate-policy.spec.ts`）。
 *
 * 「最近拦截」列的是闸门固定拦掉的三类主机（与桌面端同一份清单），
 * 不是实时请求日志——扩展不保留出站请求历史。
 */
@Component({
  selector: "network-gate-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent, LpRowComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('networkGate')"
        [sub]="i18n.t('networkGateSubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        <div
          class="tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-border tw-border-border-brand-soft tw-bg-bg-brand-softer tw-p-3 tw-text-xs tw-leading-relaxed tw-text-main"
        >
          <bit-icon name="bwi-shield" class="tw-mt-0.5 tw-text-fg-brand"></bit-icon>
          <span>{{ i18n.t("networkGateCallout") }}</span>
        </div>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-pt-2.5 tw-pb-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("whitelist") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            <lp-row
              icon="bwi-download"
              [label]="i18n.t('cloudflareR2')"
              [sub]="storageDescription()"
              [toggle]="storageAllowed()"
            />
            <lp-row
              icon="bwi-search"
              [label]="i18n.t('networkGateBreach')"
              [sub]="i18n.t('breachCheckSub')"
              [toggle]="false"
            />
          </div>
        </section>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("networkGateRecentBlocked") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            @for (entry of blocked; track entry.host) {
              <lp-row
                icon="bwi-globe"
                [label]="entry.host + ' · ' + i18n.t(entry.categoryKey)"
                [sub]="i18n.t('blockedLabel')"
                [clickable]="false"
              />
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class NetworkGateV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly accountService = inject(AccountService);
  private readonly router = inject(Router);

  protected readonly storageHost = signal("");
  protected readonly storageAllowed = signal(false);
  protected readonly blocked = RECENT_BLOCKED;

  protected readonly storageDescription = computed(() => {
    const host = this.storageHost();
    return host
      ? `${host} · ${this.i18n.t("manualSyncOnly")}`
      : this.i18n.t("networkGateNotConfigured");
  });

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const config = await this.syncService.getConfig(userId);
    const host = hostOf(config?.endpoint ?? "");
    this.storageHost.set(host);
    this.storageAllowed.set(host !== "");
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
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
