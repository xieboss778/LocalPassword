import { CommonModule } from "@angular/common";
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
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { PasswordRepromptService, TotpQrComponent } from "@localpass/vault";

import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";

/**
 * 动态口令二维码（方向 C）。
 *
 * 只做一件事：把这一条目的 TOTP 密钥画成二维码，让用户扫进认证器；
 * 链接本身也可以点行复制——复制与二维码是同一个来源，不会对不上。
 */
@Component({
  selector: "totp-qr-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
    TotpQrComponent,
  ],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('totpQrTitle')"
          [sub]="cipher()?.name ?? ''"
          [back]="true"
          (backTriggered)="goBack()"
        ></lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('totpQrTitle')"
          [sub]="cipher()?.name ?? ''"
        ></lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-auto"
        [class.agy-ext-scroll]="compact()"
        [class.tw-px-4]="!compact()"
        [class.tw-pb-8]="!compact()"
      >
        @if (loading()) {
          <p class="tw-py-6 tw-text-xs tw-text-muted">
            {{ i18n.t("loading") }}
          </p>
        } @else if (totpUri()) {
          <div class="agy-grp tw-mx-auto tw-mt-1 tw-w-fit tw-p-3">
            <vault-totp-qr
              class="tw-block tw-w-fit"
              [value]="totpUri()"
              [size]="164"
              [ariaLabel]="cipher()?.name ?? ''"
            />
            <p class="agy-hint tw-px-1 tw-pt-2 tw-text-center">
              {{ i18n.t("totpQrCardHint") }}
            </p>
          </div>

          <lp-group class="tw-pt-2" [label]="i18n.t('manualEntry')">
            @if (totpCode()) {
              <lp-row
                [label]="i18n.t('verificationCode')"
                [sub]="totpMeta()"
                [value]="formattedCode()"
                [mono]="true"
                [brand]="true"
                [copyValue]="totpCode()"
                [copyLabel]="i18n.t('verificationCode')"
              />
            }
            <lp-row
              [label]="i18n.t('totpSecret')"
              [value]="totpSecret()"
              [mono]="true"
              [copyValue]="totpSecret()"
              [copyLabel]="i18n.t('totpSecret')"
            />
          </lp-group>

          <p class="agy-hint tw-text-center">
            {{ i18n.t("totpQrFootnote") }}
          </p>
        } @else {
          <p class="tw-py-6 tw-text-xs tw-text-muted">
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
  private readonly totpService = inject(TotpService);
  private readonly accountService = inject(AccountService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly loading = signal(true);
  protected readonly cipher = signal<CipherView | null>(null);
  protected readonly totpUri = signal("");
  protected readonly totpCode = signal("");
  protected readonly totpPeriod = signal(30);
  protected readonly totpRemaining = signal(30);
  /** 手动输入只需要密钥本体；otpauth 链接里取出 secret，裸密钥原样展示。 */
  protected readonly totpSecret = computed(() => totpSecretOf(this.totpUri()));
  protected readonly formattedCode = computed(() => {
    const code = this.totpCode();
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
  });
  protected readonly totpMeta = computed(() => {
    const params = totpParamsOf(this.totpUri());
    return `${params.algorithm} · ${params.digits} · ${this.totpPeriod()}s · ${this.totpRemaining()}s`;
  });

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
      // The QR encodes the TOTP secret, so a protected item must be re-authorized even when
      // this route is opened directly instead of from the item page.
      if (!(await this.passwordRepromptService.passwordRepromptCheck(view))) {
        this.dismiss();
        return;
      }
      this.cipher.set(view);
      const totp = view.login?.totp ?? "";
      this.totpUri.set(totp);
      if (totp) {
        this.totpService
          .getCode$(totp)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((response) => {
            this.totpCode.set(response.code ?? "");
            const period = response.period || 30;
            const epoch = Math.floor(Date.now() / 1000);
            this.totpPeriod.set(period);
            this.totpRemaining.set(period - (epoch % period));
          });
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(["/view-cipher-v2"], {
      queryParams: { cipherId: this.cipher()?.id },
    });
  }

  /** Leaving the page after a cancelled reprompt. In a popout that means closing the window. */
  private dismiss(): void {
    if (BrowserPopupUtils.inPopout(window)) {
      void BrowserPopupUtils.closeCurrentPopupOrPopout(window);
      return;
    }
    void this.router.navigateByUrl(this.compact() ? "/tabs/vault" : "/vault");
  }
}

function totpSecretOf(value: string): string {
  if (!value.toLowerCase().startsWith("otpauth://")) {
    return value;
  }
  try {
    return new URL(value).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function totpParamsOf(value: string): { algorithm: string; digits: string } {
  if (!value.toLowerCase().startsWith("otpauth://")) {
    return { algorithm: "SHA1", digits: "6" };
  }
  try {
    const params = new URL(value).searchParams;
    return {
      algorithm: (params.get("algorithm") || "SHA1").toUpperCase(),
      digits: params.get("digits") || "6",
    };
  } catch {
    return { algorithm: "SHA1", digits: "6" };
  }
}
