import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, DialogService, IconButtonModule, IconModule } from "@localpass/components";
import { GeneratedCredential, GeneratorHistoryService } from "@localpass/generator-history";

import { JslibModule } from "../../jslib.module";
import {
  LpEmptyComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "../../local-ui";

/**
 * 生成历史（方向 C）。
 *
 * 记录与加密全部交给 `GeneratorHistoryService`：历史随保险库密钥加密，只在本机，
 * 不上传也不写日志。这里只负责列出、复制与清除。
 */
@Component({
  selector: "generator-history-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    IconModule,
    LpEmptyComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('generatorHistory')"
          [sub]="i18n.t('generatorHistorySubtitle')"
          [back]="true"
          (backTriggered)="goBack()"
        >
          @if (credentials().length > 0) {
            <div slot="actions">
              <button
                type="button"
                class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
                [attr.aria-label]="i18n.t('clearGeneratorHistoryTitle')"
                [attr.title]="i18n.t('clearGeneratorHistoryTitle')"
                (click)="clear()"
              >
                <bit-icon name="bwi-trash" class="tw-text-base"></bit-icon>
              </button>
            </div>
          }
        </lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('generatorHistory')"
          [sub]="i18n.t('generatorHistorySubtitle')"
        >
          <button
            type="button"
            bitButton
            buttonType="secondary"
            startIcon="bwi-trash"
            [disabled]="credentials().length === 0"
            (click)="clear()"
          >
            {{ i18n.t("clearHistory") }}
          </button>
        </lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7"
        [class.tw-px-7]="!compact()"
        [class.tw-px-4]="compact()"
      >
        @if (credentials().length === 0) {
          <div class="tw-grid tw-min-h-72 tw-place-items-center">
            <lp-empty
              icon="bwi-clock"
              [title]="i18n.t('generatorHistoryEmpty')"
              [text]="i18n.t('generatorHistoryEmptyHint')"
            ></lp-empty>
          </div>
        } @else {
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-shadow-sm"
          >
            @for (credential of credentials(); track credential.credential) {
              <div
                class="tw-flex tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
              >
                <span
                  class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
                >
                  <bit-icon name="bwi-clock" class="tw-text-base"></bit-icon>
                </span>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-break-all tw-font-mono tw-text-sm tw-text-main">{{
                    credential.credential
                  }}</span>
                  <span class="tw-mt-0.5 tw-block tw-text-xs tw-leading-relaxed tw-text-muted">
                    {{ credential.generationDate | date: "short" }} ·
                    {{ labelOf(credential) }}
                  </span>
                </span>
                <button
                  type="button"
                  bitIconButton="bwi-copy"
                  [label]="i18n.t('copy')"
                  (click)="copy(credential)"
                ></button>
              </div>
            }
          </div>
          <p class="tw-px-1 tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
            {{ i18n.t("generatorHistoryLocalOnly") }}
          </p>
        }
      </div>
    </div>
  `,
})
export class GeneratorHistoryV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly history = inject(GeneratorHistoryService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(LpToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected readonly credentials = toSignal(
    this.userId$.pipe(switchMap((userId) => this.history.credentials$(userId))),
    { initialValue: [] as GeneratedCredential[] },
  );

  protected goBack(): void {
    void this.router.navigateByUrl(this.compact() ? "/tabs/generator" : "/generator");
  }

  protected labelOf(credential: GeneratedCredential): string {
    if (credential.algorithm === "passphrase") {
      return this.i18n.t("passphrase");
    }
    if (credential.algorithm === "username") {
      return this.i18n.t("username");
    }
    return this.i18n.t("password");
  }

  protected copy(credential: GeneratedCredential): void {
    const copied = this.platformUtilsService.copyToClipboard(credential.credential, { window });
    if (copied !== false) {
      this.toast.show(this.i18n.t("valueCopied", this.labelOf(credential)));
    }
  }

  protected async clear(): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "clearGeneratorHistoryTitle" },
      content: { key: "clearGeneratorHistoryDescription" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    await this.history.clear(await firstValueFrom(this.userId$));
    this.toast.show(this.i18n.t("generatorHistoryCleared"));
  }
}
