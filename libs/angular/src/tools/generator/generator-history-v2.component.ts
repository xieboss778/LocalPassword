import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, DialogService, IconModule } from "@localpass/components";
import { GeneratedCredential, GeneratorHistoryService } from "@localpass/generator-history";

import { JslibModule } from "../../jslib.module";
import {
  GENERATOR_HISTORY_MASK,
  LpEmptyComponent,
  LpPageHeaderComponent,
  LpPasswordSyntaxComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "../../local-ui";

/**
 * 生成历史（方向 C）。
 *
 * 记录与内存清理由 `GeneratorHistoryService` 负责：历史只保存在当前解锁会话的内存中，
 * 不上传、不写磁盘、不写日志，锁库或退出时自动清空。这里只负责默认遮罩下列出、逐条展开、复制与清除。
 */
@Component({
  selector: "generator-history-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    JslibModule,
    ButtonModule,
    IconModule,
    LpEmptyComponent,
    LpPageHeaderComponent,
    LpPasswordSyntaxComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
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
                class="agy-iconbtn"
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
            startIcon="bwi-angle-left"
            (click)="goBack()"
          >
            {{ i18n.t("backToGenerator") }}
          </button>
        </lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7"
        [class.agy-ext-scroll]="compact()"
        [class.tw-px-7]="!compact()"
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
            [class.agy-grp]="compact()"
            [class.tw-overflow-hidden]="!compact()"
            [class.tw-rounded-xl]="!compact()"
            [class.tw-border]="!compact()"
            [class.tw-border-border-light]="!compact()"
            [class.tw-bg-background]="!compact()"
            [class.tw-shadow-sm]="!compact()"
          >
            @if (!compact()) {
              <div
                class="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-border-light tw-px-4 tw-py-2.5"
              >
                <span class="tw-text-xs tw-font-semibold tw-text-main">{{
                  i18n.t("recentGenerated")
                }}</span>
                <span class="tw-text-xs tw-text-muted">{{
                  i18n.t("historyCount", credentials().length)
                }}</span>
                <span class="tw-flex-1"></span>
                <button
                  type="button"
                  class="agy-btn agy-sm"
                  data-testid="generator_history_clear"
                  (click)="clear()"
                >
                  {{ i18n.t("clearHistory") }}
                </button>
              </div>
            }
            @for (credential of credentials(); track $index) {
              <div
                [class.agy-prow]="compact()"
                [class.tw-flex]="!compact()"
                [class.tw-items-center]="!compact()"
                [class.tw-gap-3]="!compact()"
                [class.tw-border-b]="!compact()"
                [class.tw-border-border-light]="!compact()"
                [class.tw-px-4]="!compact()"
                [class.tw-py-3]="!compact()"
                [class.last:tw-border-b-0]="!compact()"
              >
                @if (!compact()) {
                  <span
                    class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
                  >
                    <bit-icon name="bwi-clock" class="tw-text-base"></bit-icon>
                  </span>
                }
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-break-all tw-font-mono tw-text-xs tw-text-main">
                    @if (revealed().has($index)) {
                      <lp-password-syntax [value]="credential.credential" />
                    } @else {
                      {{ mask }}
                    }
                  </span>
                  <span class="tw-mt-0.5 tw-block tw-text-xs tw-leading-relaxed tw-text-muted">
                    {{ displayTime(credential.generationDate) }} · {{ labelOf(credential) }}
                  </span>
                </span>
                <button
                  type="button"
                  class="agy-iconbtn agy-sm"
                  [attr.aria-label]="
                    i18n.t(revealed().has($index) ? 'hidePassword' : 'showPassword')
                  "
                  [attr.title]="i18n.t(revealed().has($index) ? 'hidePassword' : 'showPassword')"
                  (click)="toggleReveal($index)"
                >
                  <bit-icon
                    [name]="revealed().has($index) ? 'bwi-eye-slash' : 'bwi-eye'"
                    class="tw-text-xs"
                  ></bit-icon>
                </button>
                <button
                  type="button"
                  class="agy-iconbtn agy-sm"
                  [attr.aria-label]="i18n.t('copy')"
                  [attr.title]="i18n.t('copy')"
                  (click)="copy(credential)"
                >
                  <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                </button>
              </div>
            }
          </div>
          @if (compact()) {
            <button
              type="button"
              class="agy-btn agy-danger agy-lg agy-block tw-mt-2"
              data-testid="generator_history_clear"
              (click)="clear()"
            >
              {{ i18n.t("clearHistory") }}
            </button>
            <p class="agy-hint tw-mt-2 tw-text-center">
              {{ i18n.t("generatorHistoryLocalOnly") }}
            </p>
          }
        }
      </div>
    </div>
  `,
})
export class GeneratorHistoryV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });
  private readonly history = inject(GeneratorHistoryService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogService = inject(DialogService);
  private readonly toast = inject(LpToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly mask = GENERATOR_HISTORY_MASK;
  protected readonly revealed = signal<ReadonlySet<number>>(new Set());

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

  /** 桌面端历史时间按原型用相对日期；弹窗复用同一格式。 */
  protected displayTime(date: Date): string {
    const now = new Date();
    const time = date.toLocaleTimeString(this.locale().startsWith("zh") ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (sameDay) {
      return `${this.i18n.t("recentlyActiveToday")} ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate()
    ) {
      return `${this.i18n.t("yesterday")} ${time}`;
    }

    return date.toLocaleDateString(this.locale().startsWith("zh") ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  }

  protected toggleReveal(index: number): void {
    const next = new Set(this.revealed());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.revealed.set(next);
  }

  protected copy(credential: GeneratedCredential): void {
    const copied = this.platformUtilsService.copyToClipboard(credential.credential, { window });
    if (copied !== false) {
      this.toast.showClipboard(this.i18n.t("valueCopied", this.labelOf(credential)), () => {
        this.platformUtilsService.copyToClipboard("", { window, clearing: true });
      });
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
    this.revealed.set(new Set());
    this.toast.show(this.i18n.t("generatorHistoryCleared"));
  }
}
