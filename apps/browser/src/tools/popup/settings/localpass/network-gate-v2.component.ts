import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LpPopupHeaderComponent } from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule, LocalPassIcon } from "@localpass/components";
import { VaultBackupSyncService } from "@localpass/local-vault";

interface RuleRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly sub: string;
  readonly value: string;
  readonly allowed: boolean;
}

/**
 * 网络闸门（弹窗）。
 *
 * 这一页不解密、不发请求：它只把 `NetworkGatePolicy` 的三条规则摊开给用户看，
 * 外加当前存储端点。规则本身是纯函数，有单测（`gate-policy.spec.ts`）。
 */
@Component({
  selector: "network-gate-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent],
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
          <span>{{ i18n.t("networkGateNote") }}</span>
        </div>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-pt-2.5 tw-pb-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("networkGateRules") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            @for (row of rules(); track row.labelKey) {
              <div
                class="tw-flex tw-items-start tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 last:tw-border-b-0"
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
                  <span class="tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
                    row.sub
                  }}</span>
                </span>
                <span
                  class="tw-inline-flex tw-flex-none tw-items-center tw-rounded-full tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium"
                  [class.tw-bg-bg-success-soft]="row.allowed"
                  [class.tw-text-fg-success]="row.allowed"
                  [class.tw-bg-bg-danger-soft]="!row.allowed"
                  [class.tw-text-fg-danger]="!row.allowed"
                >
                  {{ row.value }}
                </span>
              </div>
            }
          </div>
        </section>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("networkGateLocal") }}
          </h2>
          <div
            class="tw-flex tw-items-center tw-gap-2.5 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-px-3 tw-py-2.5"
          >
            <span
              class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
            >
              <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
            </span>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                i18n.t("networkGateSentinel")
              }}</span>
              <span class="tw-block tw-font-mono tw-text-xs tw-text-muted">{{ sentinel }}</span>
            </span>
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

  protected readonly sentinel = "vault.local.invalid";
  protected readonly storageHost = signal("");
  protected readonly rules = signal<readonly RuleRow[]>([]);

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const config = await this.syncService.getConfig(userId);
    const host = hostOf(config?.endpoint ?? "");
    this.storageHost.set(host);
    this.rules.set([
      {
        icon: "bwi-download",
        labelKey: "networkGateStorage",
        sub: host || this.i18n.t("networkGateNotConfigured"),
        value: this.i18n.t("networkGateAllowed"),
        allowed: true,
      },
      {
        icon: "bwi-search",
        labelKey: "networkGateBreach",
        sub: this.i18n.t("networkGateUserInitiated"),
        value: this.i18n.t("networkGateUserInitiated"),
        allowed: true,
      },
      {
        icon: "bwi-globe",
        labelKey: "networkGateEverythingElse",
        sub: "",
        value: this.i18n.t("networkGateBlocked"),
        allowed: false,
      },
    ]);
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
