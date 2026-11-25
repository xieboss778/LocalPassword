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
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { TotpService } from "@localpass/common/vault/abstractions/totp.service";
import { FieldType } from "@localpass/common/vault/enums";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ButtonModule, DialogService, IconButtonModule } from "@localpass/components";
import { kindOf, withoutKindField } from "@localpass/local-vault";

/**
 * 条目详情（方向 C）。复制只有一个入口：点行 —— 行自己负责写剪贴板与三重反馈
 * （见 {@link LpRowComponent}）。这里只把「显示值」和「真正复制的值」分开传：
 * 隐藏字段显示圆点，复制的是真实内容。
 */
@Component({
  selector: "vault-item-view-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header [title]="cipher()?.name ?? ''" [sub]="subtitle()">
        @if (cipher()?.login?.totp) {
          <button
            type="button"
            bitIconButton="bwi-qr-code"
            [label]="i18n.t('totpQrSubtitle')"
            (click)="openTotpQr()"
          ></button>
        }
        <button
          type="button"
          bitIconButton="bwi-pencil-square"
          [label]="i18n.t('edit')"
          (click)="edit()"
        ></button>
        <button
          type="button"
          bitIconButton="bwi-trash"
          [label]="i18n.t('delete')"
          (click)="remove()"
        ></button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        @if (loading()) {
          <p class="tw-px-4 tw-py-6 tw-text-[12px] tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("loading") }}
          </p>
        } @else if (cipher(); as item) {
          <lp-group [label]="i18n.t('credentials')">
            @if (item.login.username) {
              <lp-row
                [label]="i18n.t('username')"
                [value]="item.login.username"
                [mono]="true"
                [copyValue]="item.login.username"
                [copyLabel]="i18n.t('username')"
              />
            }
            @if (item.login.password) {
              <lp-row
                [label]="i18n.t('password')"
                [value]="masked"
                [mono]="true"
                [copyValue]="item.login.password"
                [copyLabel]="i18n.t('password')"
              />
            }
            @if (totpCode()) {
              <lp-row
                [label]="i18n.t('verificationCodeTotp')"
                [value]="formattedTotp()"
                [mono]="true"
                [brand]="true"
                [copyValue]="totpCode()"
                [copyLabel]="i18n.t('verificationCodeTotp')"
              />
            }
          </lp-group>

          @if (item.login.uris.length) {
            <lp-group [label]="i18n.t('autofillOptions')">
              @for (uri of item.login.uris; track uri.uri) {
                <lp-row
                  [label]="uri.uri ?? ''"
                  [mono]="true"
                  [copyValue]="uri.uri ?? ''"
                  [copyLabel]="i18n.t('uri')"
                />
              }
            </lp-group>
          }

          @if (customFields().length) {
            <lp-group [label]="i18n.t('customFields')">
              @for (field of customFields(); track field.name) {
                <lp-row
                  [label]="field.name"
                  [value]="field.type === hiddenFieldType ? masked : field.value"
                  [copyValue]="field.value"
                  [copyLabel]="field.name"
                />
              }
            </lp-group>
          }

          <lp-group [label]="i18n.t('additionalOptions')">
            @if (item.notes) {
              <lp-row [label]="i18n.t('notes')" [sub]="item.notes" [clickable]="false" />
            }
            <lp-row
              [label]="i18n.t('passwordReprompt')"
              [value]="item.reprompt ? i18n.t('enabled') : i18n.t('disabled')"
              [clickable]="false"
            />
            @if (item.attachments.length) {
              <lp-row
                [label]="i18n.t('attachments')"
                [value]="attachmentCount()"
                [clickable]="false"
              />
            }
          </lp-group>

          <p class="tw-px-4 tw-pt-3 tw-text-[10.5px] tw-text-[var(--lp-ink-3)]">
            {{ i18n.t("dateUpdated") }}: {{ item.revisionDate | date: "short" }}
          </p>
        }
      </div>
    </div>
  `,
})
export class VaultItemViewV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly totpService = inject(TotpService);
  private readonly accountService = inject(AccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hiddenFieldType = FieldType.Hidden;
  protected readonly masked = "••••••••••••";
  protected readonly loading = signal(true);
  protected readonly cipher = signal<CipherView | null>(null);
  protected readonly totpCode = signal<string>("");

  protected readonly subtitle = computed(() => this.cipher()?.subTitle ?? "");
  protected readonly customFields = computed(() => withoutKindField(this.cipher()?.fields));
  protected readonly attachmentCount = computed(() => `${this.cipher()?.attachments.length ?? 0}`);
  protected readonly formattedTotp = computed(() => {
    const code = this.totpCode();
    return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
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
      this.cipher.set(view);
      this.watchTotp(view);
    } finally {
      this.loading.set(false);
    }
  }

  protected openTotpQr(): void {
    const id = this.cipher()?.id;
    if (id) {
      void this.router.navigate(["/totp-qr-v2"], { queryParams: { cipherId: id } });
    }
  }

  protected edit(): void {
    const item = this.cipher();
    if (item?.id) {
      void this.router.navigate(["/edit-item-v2"], {
        queryParams: { cipherId: item.id, kind: kindOf(item) },
      });
    }
  }

  protected async remove(): Promise<void> {
    const item = this.cipher();
    if (!item?.id) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherService.softDeleteWithServer(item.id, userId);
    await this.router.navigate(["/vault-list-v2"]);
  }

  private watchTotp(view: CipherView): void {
    const key = view.login?.totp;
    if (!key) {
      return;
    }
    this.totpService
      .getCode$(key)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.totpCode.set(response.code ?? ""));
  }
}
