import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { CipherService } from "@localpass/common/vault/abstractions/cipher.service";
import { IconModule } from "@localpass/components";
import { ItemKind } from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  LpEmptyComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "../../local-ui";

import {
  HealthIssueKind,
  VaultHealthIssue,
  VaultHealthReport,
  scanVaultHealth,
} from "./vault-health.scan";

const EMPTY_REPORT: VaultHealthReport = {
  totalLogins: 0,
  issues: [],
  reusedGroups: 0,
  weakOrStaleLogins: 0,
  missingTotpLogins: 0,
  strongLogins: 0,
};

/**
 * 离线安全体检。四项规则全部在本机内存计算，密码明文不会离开设备，
 * 也不做 HIBP 或其它联网查询。列表与统计数字来自真实条目，没有演示数据。
 */
@Component({
  selector: "health-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-h-full",
    "(window:keydown)": "onKeydown($event)",
  },
  imports: [
    CommonModule,
    JslibModule,
    IconModule,
    LpEmptyComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div
      class="agy tw-flex tw-h-full tw-flex-col"
      [class.tw-bg-background-alt]="!compact()"
      [class.tw-bg-background]="compact()"
    >
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('healthCheck')"
          [sub]="i18n.t('healthCheckSubtitle')"
          [back]="true"
          (backTriggered)="back()"
        >
          <div slot="actions">
            <button
              type="button"
              class="agy-iconbtn"
              [attr.aria-label]="i18n.t('healthCheckRescan')"
              [attr.title]="i18n.t('healthCheckRescan')"
              (click)="rescan()"
            >
              <bit-icon name="bwi-refresh" class="tw-text-sm"></bit-icon>
            </button>
          </div>
        </lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('healthCheck')"
          [sub]="i18n.t('healthCheckSubtitle')"
          [compact]="true"
        >
          <button type="button" class="agy-btn agy-sm" (click)="rescan()">
            <bit-icon name="bwi-refresh" class="tw-text-xs"></bit-icon>
            {{ i18n.t("healthCheckRescan") }}
          </button>
        </lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7"
        [class.agy-ext-scroll]="compact()"
        [class.tw-px-7]="!compact()"
      >
        @if (loading()) {
          <p class="tw-py-10 tw-text-center tw-text-sm tw-text-muted">{{ i18n.t("loading") }}</p>
        } @else {
          <div
            class="tw-grid tw-gap-1.5"
            [class.tw-grid-cols-3]="compact()"
            [class.tw-grid-cols-4]="!compact()"
          >
            <div class="agy-stat" [class.agy-bad]="report().reusedGroups > 0">
              <div class="agy-n">{{ report().reusedGroups }}</div>
              <div class="agy-l">{{ i18n.t("healthCheckReusedStat") }}</div>
            </div>
            <div class="agy-stat" [class.agy-warn]="report().weakOrStaleLogins > 0">
              <div class="agy-n">{{ report().weakOrStaleLogins }}</div>
              <div class="agy-l">{{ i18n.t("healthCheckWeakOrStaleStat") }}</div>
            </div>
            @if (!compact()) {
              <div class="agy-stat" [class.agy-warn]="report().missingTotpLogins > 0">
                <div class="agy-n">{{ report().missingTotpLogins }}</div>
                <div class="agy-l">{{ i18n.t("healthCheckMissingTotpStat") }}</div>
              </div>
            }
            <div class="agy-stat" [class.agy-ok]="report().strongLogins > 0">
              <div class="agy-n">{{ report().strongLogins }}</div>
              <div class="agy-l">{{ i18n.t("healthCheckStrongStat") }}</div>
            </div>
          </div>

          @if (!report().totalLogins) {
            @if (compact()) {
              <div class="tw-grid tw-min-h-64 tw-place-items-center">
                <lp-empty
                  icon="bwi-shield"
                  [title]="i18n.t('healthCheckNoLogins')"
                  [text]="i18n.t('healthCheckNoLoginsDesc')"
                ></lp-empty>
              </div>
            } @else {
              <div class="agy-empty">
                <span class="agy-empty-ico">
                  <bit-icon name="bwi-shield" class="tw-text-lg"></bit-icon>
                </span>
                <h2 class="agy-empty-h">{{ i18n.t("healthCheckNoLogins") }}</h2>
                <p class="agy-empty-s">{{ i18n.t("healthCheckNoLoginsDesc") }}</p>
              </div>
            }
          } @else if (!issues().length) {
            @if (compact()) {
              <div class="tw-grid tw-min-h-64 tw-place-items-center">
                <lp-empty
                  icon="bwi-shield"
                  [title]="i18n.t('healthCheckAllClear')"
                  [text]="i18n.t('healthCheckAllClearDesc')"
                ></lp-empty>
              </div>
            } @else {
              <div class="agy-empty">
                <span class="agy-empty-ico">
                  <bit-icon name="bwi-shield" class="tw-text-lg"></bit-icon>
                </span>
                <h2 class="agy-empty-h">{{ i18n.t("healthCheckAllClear") }}</h2>
                <p class="agy-empty-s">{{ i18n.t("healthCheckAllClearDesc") }}</p>
              </div>
            }
          } @else {
            <div class="agy-grp tw-mt-2">
              @if (!compact()) {
                <div class="agy-grphead">
                  {{ i18n.t("healthCheckPriority") }}
                  <span class="agy-chip">{{ issues().length }}</span>
                  <span class="tw-ml-auto tw-text-xs tw-text-muted">{{
                    i18n.t("healthCheckPriorityDesc")
                  }}</span>
                </div>
              }
              @for (issue of issues(); track issue.key) {
                <div class="agy-prow">
                  <span
                    class="agy-chip"
                    [class.agy-bad]="issue.kind === HealthIssueKind.Reused"
                    [class.agy-warn]="
                      issue.kind === HealthIssueKind.Weak || issue.kind === HealthIssueKind.Stale
                    "
                  >
                    {{ i18n.t(tagKey(issue.kind)) }}
                  </span>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="agy-t tw-block tw-truncate">{{ issue.name }}</span>
                    <span class="agy-s tw-block tw-truncate">{{ detailOf(issue) }}</span>
                  </span>
                  <span class="agy-right">
                    <button type="button" class="agy-btn agy-sm agy-primary" (click)="fix(issue)">
                      {{ i18n.t("healthCheckFix") }}
                    </button>
                  </span>
                </div>
              }
            </div>
          }

          @if (!compact()) {
            <div class="agy-grp tw-mt-3">
              <div class="agy-grphead">{{ i18n.t("healthCheckPrivacyTitle") }}</div>
              <div class="agy-setrow">
                <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                  <bit-icon name="bwi-lock" class="tw-text-xs"></bit-icon>
                </span>
                <span class="tw-min-w-0 tw-flex-1 agy-d">
                  {{ i18n.t("healthCheckPrivacy") }}
                </span>
                <span class="agy-chip agy-ok">{{ i18n.t("healthCheckOfflineRule") }}</span>
              </div>
            </div>
          } @else {
            <p class="tw-px-2 tw-pt-2 tw-text-xs tw-text-muted">
              {{ i18n.t("healthCheckPrivacy") }}
            </p>
          }
        }
      </div>
    </div>
  `,
})
export class HealthV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly HealthIssueKind = HealthIssueKind;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly passwordStrengthService = inject(PasswordStrengthServiceAbstraction);
  private readonly toast = inject(LpToastService);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly loading = signal(true);
  protected readonly report = signal<VaultHealthReport>(EMPTY_REPORT);
  protected readonly issues = computed(() => this.report().issues);

  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected tagKey(kind: HealthIssueKind): string {
    switch (kind) {
      case HealthIssueKind.Reused:
        return "healthCheckReusedChip";
      case HealthIssueKind.Weak:
        return "healthCheckWeakChip";
      case HealthIssueKind.Stale:
        return "healthCheckStaleChip";
      case HealthIssueKind.MissingTotp:
        return "healthCheckMissingTotpChip";
    }
  }

  /** 只展示非敏感上下文：用户名、同一密码的其它条目名、长度与修改日期。 */
  protected detailOf(issue: VaultHealthIssue): string {
    const username = issue.username;
    switch (issue.kind) {
      case HealthIssueKind.Reused:
        return joinParts([
          username,
          this.i18n.t("healthCheckSharedWith").replace("{NAMES}", issue.sharedWith.join(" · ")),
        ]);
      case HealthIssueKind.Weak:
        return joinParts([
          username,
          this.i18n.t("healthCheckWeakDetail").replace("{COUNT}", String(issue.passwordLength)),
        ]);
      case HealthIssueKind.Stale:
        return joinParts([
          username,
          this.i18n
            .t("healthCheckChangedOn")
            .replace("{DATE}", this.localizedDate(issue.changedAt)),
        ]);
      case HealthIssueKind.MissingTotp:
        return joinParts([username, this.i18n.t("healthCheckMissingTotpDetail")]);
    }
  }

  protected fix(issue: VaultHealthIssue): void {
    if (this.compact()) {
      void this.router.navigate(["/edit-item-v2"], {
        queryParams: {
          cipherId: issue.cipherId,
          kind: ItemKind.Login,
          next: "/health-v2",
        },
      });
      return;
    }
    void this.router.navigate(["/vault"], {
      queryParams: { cipherId: issue.cipherId, edit: "1" },
    });
  }

  protected async rescan(): Promise<void> {
    await this.load();
    this.toast.show(this.i18n.t("healthCheckScanned"));
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.compact() && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
      event.preventDefault();
      void this.rescan();
    }
  }

  private localizedDate(date: Date | null): string {
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(this.locale(), { year: "numeric", month: "short", day: "numeric" })
      : "";
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const ciphers = await this.cipherService.getAllDecrypted(userId);
      this.report.set(scanVaultHealth(ciphers, this.passwordStrengthService));
    } catch {
      this.report.set(EMPTY_REPORT);
      this.toast.show(this.i18n.t("unexpectedError"));
    } finally {
      this.loading.set(false);
    }
  }
}

function joinParts(parts: readonly string[]): string {
  return parts.filter((part) => part.length > 0).join(" · ");
}
