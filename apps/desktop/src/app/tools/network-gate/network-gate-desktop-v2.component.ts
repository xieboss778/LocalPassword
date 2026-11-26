import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
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
 * 桌面端网络闸门（只读说明页）。
 *
 * 页面本身不发请求、不解密：把 `NetworkGatePolicy` 的规则与存储端点摊开给用户看。
 */
@Component({
  selector: "network-gate-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpGroupComponent, LpPageHeaderComponent, LpRowComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header
        [title]="i18n.t('networkGate')"
        [sub]="i18n.t('networkGateSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7">
        <div class="tw-mx-4">
          <div
            class="tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-border tw-border-border-brand-soft tw-bg-bg-brand-softer tw-p-3 tw-text-xs tw-leading-relaxed tw-text-main"
          >
            <bit-icon name="bwi-shield" class="tw-mt-0.5 tw-text-fg-brand"></bit-icon>
            <span>{{ i18n.t("networkGateNote") }}</span>
          </div>
        </div>

        <lp-group [label]="i18n.t('networkGateRules')">
          @for (row of rules(); track row.labelKey) {
            <div
              class="tw-flex tw-items-start tw-gap-2.5 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
            >
              <span
                class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
              >
                <bit-icon [name]="row.icon" class="tw-text-base"></bit-icon>
              </span>
              <span class="tw-min-w-0 tw-flex-1">
                <span class="tw-block tw-text-sm tw-text-main">{{ i18n.t(row.labelKey) }}</span>
                @if (row.sub) {
                  <span class="tw-mt-0.5 tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
                    row.sub
                  }}</span>
                }
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
        </lp-group>

        <lp-group [label]="i18n.t('networkGateLocal')">
          <lp-row
            icon="bwi-lock"
            [label]="i18n.t('networkGateSentinel')"
            [value]="sentinel"
            [mono]="true"
            [clickable]="false"
          ></lp-row>
        </lp-group>
      </div>
    </div>
  `,
})
export class NetworkGateDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly accountService = inject(AccountService);

  protected readonly sentinel = "vault.local.invalid";
  protected readonly rules = signal<readonly RuleRow[]>([]);

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const config = await this.syncService.getConfig(userId);
    const host = hostOf(config?.endpoint ?? "");
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
