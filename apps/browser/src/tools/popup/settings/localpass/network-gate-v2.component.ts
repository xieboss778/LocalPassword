import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { VaultBackupSyncService } from "@localpass/local-vault";

/**
 * 网络闸门（方向 C）。
 *
 * 这一页不解密、不发请求：它只把 `NetworkGatePolicy` 的三条规则摊开给用户看，
 * 外加当前存储端点。规则本身是纯函数，有单测（`gate-policy.spec.ts`）。
 */
@Component({
  selector: "network-gate-v2",
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
        [title]="i18n.t('networkGate')"
        [sub]="i18n.t('networkGateSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group [label]="i18n.t('networkGateRules')">
          <lp-row
            emoji="✅"
            [label]="i18n.t('networkGateStorage')"
            [value]="i18n.t('networkGateAllowed')"
            [sub]="storageHost() || i18n.t('networkGateNotConfigured')"
            [clickable]="false"
          />
          <lp-row
            emoji="🔍"
            [label]="i18n.t('networkGateBreach')"
            [value]="i18n.t('networkGateUserInitiated')"
            [clickable]="false"
          />
          <lp-row
            emoji="⛔"
            [label]="i18n.t('networkGateEverythingElse')"
            [value]="i18n.t('networkGateBlocked')"
            [clickable]="false"
          />
        </lp-group>

        <lp-group [label]="i18n.t('networkGateLocal')">
          <lp-row
            emoji="🏠"
            [label]="i18n.t('networkGateSentinel')"
            [value]="sentinel"
            [mono]="true"
            [clickable]="false"
          />
        </lp-group>

        <p class="tw-px-4 tw-pt-3 tw-text-[10.5px] tw-leading-relaxed tw-text-[var(--lp-ink-3)]">
          {{ i18n.t("networkGateNote") }}
        </p>
      </div>
    </div>
  `,
})
export class NetworkGateV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly accountService = inject(AccountService);

  protected readonly sentinel = "vault.local.invalid";
  protected readonly storageHost = signal<string>("");

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
