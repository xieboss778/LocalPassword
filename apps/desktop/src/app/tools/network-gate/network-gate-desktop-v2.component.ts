import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LpPageHeaderComponent } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";
import { VaultBackupSyncService } from "@localpass/local-vault";

/**
 * 桌面端网络闸门（只读策略页）。
 *
 * 页面本身不发请求、不解密：把 `NetworkGatePolicy` 的规则与存储端点摊开给用户看。
 */
@Component({
  selector: "network-gate-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPageHeaderComponent],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header
        [title]="i18n.t('networkGate')"
        [sub]="i18n.t('networkGateSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        <div class="agy-callout">
          <bit-icon name="bwi-shield" class="tw-text-xs tw-text-fg-brand"></bit-icon>
          <span>{{ i18n.t("networkGateIntroDesktop") }}</span>
        </div>

        <div class="agy-seclbl tw-mt-3">
          {{ i18n.t("networkGateAllowlist") }}
        </div>
        <div class="agy-grp">
          <div class="agy-setrow">
            <div class="tw-min-w-0 tw-flex-1">
              <span class="agy-k">{{ i18n.t("networkGateStorage") }}</span>
              <span class="agy-d">{{ storageSub() }}</span>
            </div>
            <span class="agy-chip" [class.agy-ok]="storageConfigured()">
              {{ i18n.t(storageConfigured() ? "enabled" : "networkGateNotConfigured") }}
            </span>
          </div>
          <div class="agy-setrow">
            <div class="tw-min-w-0 tw-flex-1">
              <span class="agy-k">{{ i18n.t("networkGateBreach") }}</span>
              <span class="agy-d">{{ i18n.t("networkGateBreachDefaultOff") }}</span>
            </div>
            <span class="agy-chip">{{ i18n.t("disabled") }}</span>
          </div>
          <div class="agy-setrow">
            <div class="tw-min-w-0 tw-flex-1">
              <span class="agy-k">{{ i18n.t("networkGateLockedRuleTitle") }}</span>
              <span class="agy-d">{{ i18n.t("networkGateLockedRuleDesc") }}</span>
            </div>
            <span class="agy-chip agy-ok">{{ i18n.t("enabled") }}</span>
          </div>
          <div class="agy-setrow">
            <div class="tw-min-w-0 tw-flex-1">
              <span class="agy-k">{{ i18n.t("networkGateNoFaviconRuleTitle") }}</span>
              <span class="agy-d">{{ i18n.t("networkGateNoFaviconRuleDesc") }}</span>
            </div>
            <span class="agy-chip agy-ok">{{ i18n.t("enabled") }}</span>
          </div>
        </div>

        <div class="agy-grp tw-mt-3">
          <div class="agy-grphead">{{ i18n.t("networkGatePolicyTitle") }}</div>
          <div class="agy-setrow">
            <span class="agy-d">{{ i18n.t("networkGatePolicyDesc") }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class NetworkGateDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly accountService = inject(AccountService);

  protected readonly storageHost = signal("");
  protected readonly storageConfigured = signal(false);

  protected readonly storageSub = computed(() => {
    const host = this.storageHost() || this.i18n.t("networkGateNotConfigured");
    return `${host} · ${this.i18n.t("networkGateOnlyManualSync")}`;
  });

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const config = await this.syncService.getConfig(userId);
    const host = hostOf(config?.endpoint ?? "");
    this.storageHost.set(host);
    this.storageConfigured.set(host !== "");
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
