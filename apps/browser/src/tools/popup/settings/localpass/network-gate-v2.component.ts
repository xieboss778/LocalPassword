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

import { LpPopupHeaderComponent } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";
import { VaultBackupSyncService } from "@localpass/local-vault";

/**
 * 网络闸门（弹窗）。
 *
 * 这一页不解密、不发请求：它只把 `NetworkGatePolicy` 的白名单摊开给用户看，
 * 外加当前存储端点。规则本身是纯函数，有单测（`gate-policy.spec.ts`）。
 * 闸门没有隐藏黑名单，也不保留出站请求历史；页面只呈现完整的允许清单与默认拒绝规则。
 */
@Component({
  selector: "network-gate-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('networkGate')"
        [sub]="i18n.t('networkGateSubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="agy-ext-scroll">
        <div class="agy-callout">
          <bit-icon name="bwi-shield" class="tw-text-xs tw-text-fg-brand"></bit-icon>
          <div>{{ i18n.t("networkGateCallout") }}</div>
        </div>

        <section class="tw-py-2">
          <h2 class="agy-seclbl">{{ i18n.t("whitelist") }}</h2>
          <div class="agy-grp">
            <div class="agy-setrow">
              <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                <bit-icon name="bwi-refresh" class="tw-text-xs"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="agy-k tw-block">{{ i18n.t("cloudflareR2") }}</span>
                <span class="agy-d tw-block">{{ storageDescription() }}</span>
              </span>
              <span class="agy-chip" [class.agy-ok]="storageAllowed()">
                {{ i18n.t(storageAllowed() ? "enabled" : "disabled") }}
              </span>
            </div>
            <div class="agy-setrow">
              <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                <bit-icon name="bwi-search" class="tw-text-xs"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="agy-k tw-block">{{ i18n.t("networkGateBreach") }}</span>
                <span class="agy-d tw-block">{{ i18n.t("breachCheckSub") }}</span>
              </span>
              <span class="agy-chip">{{ i18n.t("disabled") }}</span>
            </div>
          </div>
        </section>

        <section class="tw-pb-2">
          <h2 class="agy-seclbl">{{ i18n.t("rulesTitle") }}</h2>
          <div class="agy-grp">
            <div class="agy-setrow">
              <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                <bit-icon name="bwi-lock" class="tw-text-xs"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="agy-k tw-block">{{ i18n.t("networkGateLockedRuleTitle") }}</span>
                <span class="agy-d tw-block">{{ i18n.t("networkGateLockedRuleDesc") }}</span>
              </span>
              <span class="agy-chip agy-ok">{{ i18n.t("enabled") }}</span>
            </div>
            <div class="agy-setrow">
              <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                <bit-icon name="bwi-globe" class="tw-text-xs"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="agy-k tw-block">{{ i18n.t("networkGateNoFaviconRuleTitle") }}</span>
                <span class="agy-d tw-block">{{ i18n.t("networkGateNoFaviconRuleDesc") }}</span>
              </span>
              <span class="agy-chip agy-ok">{{ i18n.t("enabled") }}</span>
            </div>
          </div>
        </section>

        <section class="tw-pb-2">
          <div class="agy-callout">
            <bit-icon name="bwi-shield" class="tw-text-xs tw-text-fg-brand"></bit-icon>
            <div>
              <div class="agy-k">{{ i18n.t("networkGatePolicyTitle") }}</div>
              <div class="agy-d">{{ i18n.t("networkGatePolicyDesc") }}</div>
            </div>
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
