import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, Params, RouterModule } from "@angular/router";
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
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { TotpQrComponent } from "@localpass/vault";

/**
 * 动态口令二维码（方向 C）。
 *
 * 只做一件事：把这一条目的 TOTP 密钥画成二维码，让用户扫进认证器；
 * 链接本身也可以点行复制——复制与二维码是同一个来源，不会对不上。
 */
@Component({
  selector: "totp-qr-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
    TotpQrComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header
        [title]="cipher()?.name ?? ''"
        [sub]="i18n.t('totpQrSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @if (loading()) {
          <p class="tw-px-4 tw-py-6 tw-text-[12px] tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("loading") }}
          </p>
        } @else if (totpUri()) {
          <div class="tw-mx-3 tw-flex tw-justify-center tw-rounded-[14px] tw-bg-[#fff] tw-py-4">
            <vault-totp-qr [value]="totpUri()" [size]="216" [ariaLabel]="cipher()?.name ?? ''" />
          </div>

          <lp-group [label]="i18n.t('totpQrUri')">
            <lp-row
              [label]="totpUri()"
              [mono]="true"
              [copyValue]="totpUri()"
              [copyLabel]="i18n.t('totpQrUri')"
            />
          </lp-group>

          <p class="tw-px-4 tw-pt-3 tw-text-[10.5px] tw-leading-relaxed tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("totpQrWarning") }}
          </p>
        } @else {
          <p class="tw-px-4 tw-py-6 tw-text-[12px] tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("totpNotSet") }}
          </p>
        }
      </div>
    </div>
  `,
})
export class TotpQrV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(true);
  protected readonly cipher = signal<CipherView | null>(null);
  protected readonly totpUri = signal("");

  async ngOnInit(): Promise<void> {
    const params: Params = await firstValueFrom(this.route.queryParams);
    const cipherId = params["cipherId"] as string | undefined;
    if (!cipherId) {
      this.loading.set(false);
      return;
    }

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const cipher = await this.cipherService.get(cipherId, userId);
      const view = await this.cipherService.decrypt(cipher, userId);
      this.cipher.set(view);
      this.totpUri.set(view.login?.totp ?? "");
    } finally {
      this.loading.set(false);
    }
  }
}
