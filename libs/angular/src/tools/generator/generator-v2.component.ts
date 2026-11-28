import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@localpass/common/autofill/services/autofill-settings.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, IconModule } from "@localpass/components";
import { Type } from "@localpass/generator-core";
import { GeneratedCredential, GeneratorHistoryService } from "@localpass/generator-history";
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  DEFAULT_USERNAME_OPTIONS,
  generatePassphrases,
  generatePasswords,
  generateUsernames,
  PassphraseOptions,
  PasswordOptions,
  UsernameOptions,
} from "@localpass/local-vault";
import { LockService, LockSource } from "@localpass/unlock";

import { JslibModule } from "../../jslib.module";
import {
  clipboardClearSeconds,
  clearClipboardIfStillHolding,
  GENERATOR_HISTORY_MASK,
  LpPageHeaderComponent,
  LpPasswordSyntaxComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
  LpToastService,
} from "../../local-ui";

/**
 * 密码生成器。
 *
 * 生成逻辑是 `@localpass/local-vault` 里的纯函数（有单测），这里只管选项与呈现。
 * 生成不联网。用户复制或重新生成的值只记录在当前解锁会话的内存中，锁库即清空。
 */
type GeneratorMode = "password" | "passphrase" | "username";

interface UsernameSettings {
  readonly includeNumber: boolean;
  readonly useHyphen: boolean;
}

const DEFAULT_USERNAME_SETTINGS: UsernameSettings = Object.freeze({
  includeNumber: true,
  useHyphen: true,
});

@Component({
  selector: "generator-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-h-full",
    "(window:keydown)": "onKeydown($event)",
  },
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    IconModule,
    LpPageHeaderComponent,
    LpPasswordSyntaxComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div
      class="agy tw-flex tw-h-full tw-flex-col"
      [class.tw-bg-background]="compact()"
      [class.tw-bg-background-alt]="!compact()"
    >
      <ng-template #recentHistoryPanel>
        <div class="tw-flex tw-items-center tw-justify-between tw-gap-2">
          <span class="tw-text-xs tw-font-semibold tw-text-main"
            >{{ i18n.t("generatorHistory") }}
            @if (history().length > 0) {
              <span class="tw-font-normal tw-text-muted">({{ history().length }})</span>
            }
          </span>
          <a
            [routerLink]="historyRoute"
            class="tw-text-xs tw-font-semibold tw-text-fg-brand tw-no-underline"
            >{{ i18n.t("showAll") }}</a
          >
        </div>
        <div class="agy-grp tw-mt-2">
          @if (recentHistory().length === 0) {
            <p class="tw-m-0 tw-p-3 tw-text-xs tw-text-muted">
              {{ i18n.t("generatorHistoryEmpty") }}
            </p>
          }
          @for (credential of recentHistory(); track $index) {
            <div class="agy-prow">
              <span class="tw-min-w-0 tw-flex-1">
                <span class="agy-t tw-block tw-font-mono">{{ mask }}</span>
                <span class="agy-s tw-block"
                  >{{ historyTime(credential.generationDate) }} ·
                  {{ historyKind(credential) }}</span
                >
              </span>
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="i18n.t('copy')"
                [attr.title]="i18n.t('copy')"
                (click)="copyHistory(credential)"
              >
                <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
              </button>
            </div>
          }
        </div>
        <p class="agy-hint tw-mt-1.5">{{ i18n.t("generatorHistoryLocalOnly") }}</p>
      </ng-template>

      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('generator')"
          [sub]="i18n.t('generatorSubtitle')"
          [avatar]="true"
        >
          <div slot="actions" class="tw-flex tw-items-center tw-gap-0.5">
            <a
              [routerLink]="historyRoute"
              class="agy-iconbtn"
              [attr.aria-label]="i18n.t('generatorHistory')"
              [attr.title]="i18n.t('generatorHistory')"
            >
              <bit-icon name="bwi-clock" class="tw-text-base"></bit-icon>
            </a>
            <button
              type="button"
              class="agy-iconbtn"
              [attr.aria-label]="i18n.t('lockNow')"
              [attr.title]="i18n.t('lockNow')"
              (click)="lockVault()"
            >
              <bit-icon name="bwi-lock" class="tw-text-base"></bit-icon>
            </button>
          </div>
        </lp-popup-header>
      } @else {
        <lp-page-header [title]="i18n.t('generator')" [sub]="i18n.t('generatorSubtitle')">
          <a bitButton buttonType="secondary" startIcon="bwi-clock" [routerLink]="historyRoute">
            {{ i18n.t("generatorHistory") }}
          </a>
        </lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto"
        [class.agy-ext-scroll]="compact()"
        [class.tw-pb-7]="!compact()"
        [class.tw-px-7]="!compact()"
      >
        <div class="tw-grid tw-gap-4 lg:tw-grid-cols-5">
          <div class="tw-space-y-4 lg:tw-col-span-3">
            <div
              class="tw-rounded-xl tw-bg-background"
              [class.tw-border]="!compact()"
              [class.tw-border-border-light]="!compact()"
              [class.tw-shadow-sm]="!compact()"
              [class.tw-p-5]="!compact()"
              [class.tw-pt-2]="compact()"
            >
              <div
                class="agy-segtabs tw-mb-2"
                role="tablist"
                [attr.aria-label]="i18n.t('generator')"
              >
                @for (tab of modes; track tab.key) {
                  <button
                    type="button"
                    role="tab"
                    [class.agy-on]="mode() === tab.key"
                    [attr.aria-selected]="mode() === tab.key"
                    (click)="setMode(tab.key)"
                  >
                    {{ i18n.t(tab.labelKey) }}
                  </button>
                }
              </div>

              <div class="agy-genout">
                <code class="agy-genval"><lp-password-syntax [value]="primary()" /></code>
              </div>

              <div class="tw-mt-2 tw-flex tw-gap-1.5">
                <button type="button" class="agy-btn agy-lg tw-flex-1" (click)="regenerate()">
                  <bit-icon name="bwi-refresh" class="tw-text-xs"></bit-icon>
                  {{ i18n.t("regenerate") }}
                </button>
                <button
                  type="button"
                  class="agy-btn agy-primary agy-lg tw-flex-1"
                  (click)="copy(primary())"
                >
                  <bit-icon name="bwi-copy" class="tw-text-xs"></bit-icon>
                  {{ i18n.t("copy") }}
                </button>
              </div>

              @if (mode() === "password") {
                <div [class.tw-mt-3]="compact()" [class.tw-mt-5]="!compact()">
                  <div class="tw-flex tw-items-center tw-justify-between">
                    <span class="tw-text-xs tw-text-main">{{
                      i18n.t(compact() ? "length" : "passwordLength")
                    }}</span>
                    <span class="tw-text-xs tw-font-semibold tw-text-main">{{ length() }}</span>
                  </div>
                  <input
                    type="range"
                    class="tw-mt-1 tw-w-full"
                    min="4"
                    max="64"
                    [value]="length()"
                    [attr.aria-label]="i18n.t('length')"
                    (input)="setLength($event)"
                  />
                </div>

                <div class="tw-mt-2">
                  @for (toggle of toggles(); track toggle.key) {
                    <lp-row
                      [label]="i18n.t(toggle.labelKey)"
                      [toggle]="options()[toggle.key]"
                      [clickable]="true"
                      [dense]="compact()"
                      [divider]="false"
                      (activated)="flip(toggle.key)"
                    ></lp-row>
                  }
                </div>

                <div class="tw-mt-2.5 tw-flex tw-items-center tw-gap-3">
                  <span
                    class="tw-block tw-h-1 tw-flex-1 tw-overflow-hidden tw-rounded-full tw-bg-background-alt"
                  >
                    <span
                      class="tw-block tw-h-full tw-rounded-full tw-transition-all"
                      [class.tw-bg-bg-danger]="strengthTone() === 'bad'"
                      [class.tw-bg-bg-warning]="strengthTone() === 'warn'"
                      [class.tw-bg-bg-success]="strengthTone() === 'ok'"
                      [style.width.%]="strengthPercent()"
                    ></span>
                  </span>
                  <span class="tw-flex-none tw-text-xs tw-text-muted">{{ strengthText() }}</span>
                </div>
              } @else if (mode() === "passphrase") {
                <div [class.tw-mt-3]="compact()" [class.tw-mt-5]="!compact()">
                  <div class="tw-flex tw-items-center tw-justify-between">
                    <span class="tw-text-xs tw-text-main">{{ i18n.t("numWords") }}</span>
                    <span class="tw-text-xs tw-font-semibold tw-text-main">{{ wordCount() }}</span>
                  </div>
                  <input
                    type="range"
                    class="tw-mt-1 tw-w-full"
                    min="3"
                    max="12"
                    [value]="wordCount()"
                    [attr.aria-label]="i18n.t('numWords')"
                    (input)="setWordCount($event)"
                  />
                </div>

                <div class="tw-mt-4">
                  <label
                    for="generator-v2_input_separator"
                    class="tw-block tw-text-xs tw-text-main"
                    >{{ i18n.t("wordSeparator") }}</label
                  >
                  <input
                    id="generator-v2_input_separator"
                    type="text"
                    class="tw-mt-1 tw-w-full tw-rounded-lg tw-border tw-border-border-light tw-bg-background tw-px-3 tw-py-2 tw-text-xs tw-text-main"
                    maxlength="3"
                    [value]="passphraseOptions().separator"
                    (input)="setSeparator($event)"
                  />
                </div>

                <div class="tw-mt-2">
                  <lp-row
                    [label]="i18n.t('capitalize')"
                    [toggle]="passphraseOptions().capitalize"
                    [clickable]="true"
                    [dense]="compact()"
                    [divider]="false"
                    (activated)="flipPassphrase('capitalize')"
                  ></lp-row>
                  <lp-row
                    [label]="i18n.t('includeNumber')"
                    [toggle]="passphraseOptions().includeNumber"
                    [clickable]="true"
                    [dense]="compact()"
                    [divider]="false"
                    (activated)="flipPassphrase('includeNumber')"
                  ></lp-row>
                </div>
              } @else {
                <div
                  class="tw-flex tw-flex-col tw-gap-2"
                  [class.tw-mt-2]="compact()"
                  [class.tw-mt-5]="!compact()"
                >
                  <lp-row
                    [label]="i18n.t('includeNumber')"
                    [toggle]="usernameSettings().includeNumber"
                    [clickable]="true"
                    [dense]="compact()"
                    [divider]="false"
                    (activated)="flipUsername('includeNumber')"
                  ></lp-row>
                  <lp-row
                    [label]="i18n.t('usernameUseHyphen')"
                    [toggle]="usernameSettings().useHyphen"
                    [clickable]="true"
                    [dense]="compact()"
                    [divider]="false"
                    (activated)="flipUsername('useHyphen')"
                  ></lp-row>
                </div>
                <p class="tw-mt-4 tw-text-xs tw-leading-relaxed tw-text-muted">
                  {{ i18n.t("generatorUsernameNotice") }}
                </p>
              }
            </div>
            @if (compact()) {
              <div class="tw-mt-4">
                <ng-container [ngTemplateOutlet]="recentHistoryPanel" />
              </div>
            }
          </div>

          @if (!compact()) {
            <aside
              class="tw-self-start tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 lg:tw-col-span-2"
            >
              <h2 class="tw-m-0 tw-text-xs tw-font-semibold tw-text-main">
                {{ i18n.t("rulesTitle") }}
              </h2>
              <dl class="tw-mt-4 tw-space-y-3">
                @if (mode() === "password") {
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("length") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-font-medium tw-text-main">{{ length() }}</dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("charset") }}</dt>
                    <dd class="tw-m-0 tw-font-mono tw-text-xs tw-text-main">
                      {{ charsetSummary() }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("avoidAmbiguous") }}</dt>
                    <dd class="tw-m-0 tw-font-mono tw-text-xs tw-text-main">
                      {{ options().avoidAmbiguous ? "0 O l 1" : "—" }}
                    </dd>
                  </div>
                } @else if (mode() === "passphrase") {
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("numWords") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-font-medium tw-text-main">{{ wordCount() }}</dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("wordSeparator") }}</dt>
                    <dd class="tw-m-0 tw-font-mono tw-text-xs tw-text-main">
                      "{{ passphraseOptions().separator }}"
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("capitalize") }}</dt>
                    <dd class="tw-m-0 tw-text-xs tw-text-main">
                      {{ passphraseOptions().capitalize ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("includeNumber") }}</dt>
                    <dd class="tw-m-0 tw-text-xs tw-text-main">
                      {{
                        passphraseOptions().includeNumber ? i18n.t("enabled") : i18n.t("disabled")
                      }}
                    </dd>
                  </div>
                } @else {
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("includeNumber") }}</dt>
                    <dd class="tw-m-0 tw-text-xs tw-text-main">
                      {{
                        usernameSettings().includeNumber ? i18n.t("enabled") : i18n.t("disabled")
                      }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("usernameUseHyphen") }}</dt>
                    <dd class="tw-m-0 tw-text-xs tw-text-main">
                      {{ usernameSettings().useHyphen ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                }
              </dl>
              <p class="tw-mt-4 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("generatorRulesNote") }}
              </p>
              <div class="tw-mt-5 tw-border-t tw-border-border-light tw-pt-4">
                <ng-container [ngTemplateOutlet]="recentHistoryPanel" />
              </div>
            </aside>
          }
        </div>
      </div>

      @if (compact() && mode() === "password") {
        <p
          class="tw-flex-none tw-px-3 tw-pt-1 tw-pb-0.5 tw-text-xs tw-leading-relaxed tw-tracking-tighter tw-text-muted"
        >
          {{ i18n.t("generatorFootnote") }}
        </p>
      }
    </div>
  `,
})
export class GeneratorV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(LpToastService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly generatorHistoryService = inject(GeneratorHistoryService);
  private readonly logService = inject(LogService);
  private readonly lockService = inject(LockService, { optional: true });
  private readonly autofillSettingsService = inject(AutofillSettingsServiceAbstraction, {
    optional: true,
  });

  /** 复制回执的倒计时跟随全局「清除剪贴板」设置；服务缺席时沿用默认 30 秒。 */
  private readonly clearClipboardDelay = this.autofillSettingsService
    ? toSignal(this.autofillSettingsService.clearClipboardDelay$, {
        initialValue: ClearClipboardDelay.ThirtySeconds,
      })
    : signal(ClearClipboardDelay.ThirtySeconds);

  /** 弹窗路由在 route.data 里标记 compact；桌面端保持完整两栏。 */
  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  /**
   * 历史页是独立二级页：不挂在 `tabs` 下，弹窗与桌面都用同一个顶层路由，打开时不显示底部导航。
   */
  protected readonly historyRoute = "/generator-history-v2";
  protected readonly mask = GENERATOR_HISTORY_MASK;

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected readonly history = toSignal(
    this.userId$.pipe(switchMap((userId) => this.generatorHistoryService.credentials$(userId))),
    { initialValue: [] as GeneratedCredential[] },
  );
  /** 侧栏只露最近几条：弹窗 2 条，桌面 3 条；完整列表仍是独立历史页。 */
  protected readonly recentHistory = computed(() =>
    this.history().slice(0, this.compact() ? 2 : 3),
  );

  protected readonly mode = signal<GeneratorMode>("password");
  protected readonly modes: readonly { key: GeneratorMode; labelKey: string }[] = [
    { key: "password", labelKey: "password" },
    { key: "passphrase", labelKey: "passphraseShort" },
    { key: "username", labelKey: "username" },
  ];

  private readonly passwordCandidates = signal<string[]>(
    generatePasswords(5, DEFAULT_PASSWORD_OPTIONS),
  );
  private readonly passphraseCandidates = signal<string[]>(
    generatePassphrases(5, DEFAULT_PASSPHRASE_OPTIONS),
  );
  private readonly usernameCandidates = signal<string[]>(
    generateUsernames(5, DEFAULT_USERNAME_OPTIONS),
  );
  protected readonly candidates = computed(() => {
    switch (this.mode()) {
      case "password":
        return this.passwordCandidates();
      case "passphrase":
        return this.passphraseCandidates();
      case "username":
        return this.usernameCandidates();
    }
  });

  protected readonly options = signal<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  protected readonly passphraseOptions = signal<PassphraseOptions>(DEFAULT_PASSPHRASE_OPTIONS);
  protected readonly usernameSettings = signal<UsernameSettings>(DEFAULT_USERNAME_SETTINGS);
  protected readonly primary = computed(() => this.candidates()[0] ?? "");

  protected readonly length = computed(() => this.options().length);
  protected readonly wordCount = computed(() => this.passphraseOptions().words);
  protected readonly toggles = computed(() => [
    { key: "upper" as const, labelKey: "uppercase" },
    { key: "lower" as const, labelKey: "lowercase" },
    { key: "digits" as const, labelKey: "numbers" },
    { key: "symbols" as const, labelKey: "symbols" },
    { key: "avoidAmbiguous" as const, labelKey: "avoidAmbiguous" },
  ]);

  protected readonly charsetSummary = computed(() => {
    const current = this.options();
    const parts: string[] = [];
    if (current.upper) {
      parts.push("A-Z");
    }
    if (current.lower) {
      parts.push("a-z");
    }
    if (current.digits) {
      parts.push("0-9");
    }
    if (current.symbols) {
      parts.push("!@#$%");
    }
    return parts.join(" ") || this.i18n.t("generatorNoCharset");
  });

  /** 粗略熵值：长度 × log2(可用字符数)；只用于展示强度条，不参与生成。 */
  protected readonly entropy = computed(() => {
    const current = this.options();
    const poolSize =
      (current.upper ? 26 : 0) +
      (current.lower ? 26 : 0) +
      (current.digits ? 10 : 0) +
      (current.symbols ? 8 : 0);
    if (poolSize === 0 || current.length === 0) {
      return 0;
    }
    return Math.round(current.length * Math.log2(poolSize));
  });

  protected readonly strengthPercent = computed(() => Math.min(100, (this.entropy() / 128) * 100));

  protected readonly strengthTone = computed<"bad" | "warn" | "ok">(() => {
    const bits = this.entropy();
    if (bits < 45) {
      return "bad";
    }
    if (bits < 75) {
      return "warn";
    }
    return "ok";
  });

  protected readonly strengthText = computed(() =>
    this.entropy() > 0
      ? this.i18n.t("entropyLabel", this.entropy())
      : this.i18n.t("generatorNoCharset"),
  );

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.compact() && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
      event.preventDefault();
      this.regenerate();
    }
  }

  protected async lockVault(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.lockService?.lock(userId, LockSource.Manual);
  }

  protected setMode(mode: GeneratorMode): void {
    this.mode.set(mode);
  }

  protected setLength(event: Event): void {
    const length = Number((event.target as HTMLInputElement).value);
    this.update({ length });
  }

  protected setWordCount(event: Event): void {
    const words = Number((event.target as HTMLInputElement).value);
    this.updatePassphrase({ words });
  }

  protected setSeparator(event: Event): void {
    const separator = (event.target as HTMLInputElement).value.slice(0, 3);
    this.updatePassphrase({ separator });
  }

  protected flip(key: "upper" | "lower" | "digits" | "symbols" | "avoidAmbiguous"): void {
    this.update({ [key]: !this.options()[key] } as Partial<PasswordOptions>);
  }

  protected flipPassphrase(key: "capitalize" | "includeNumber"): void {
    this.updatePassphrase({ [key]: !this.passphraseOptions()[key] } as Partial<PassphraseOptions>);
  }

  protected flipUsername(key: keyof UsernameSettings): void {
    this.updateUsername({ [key]: !this.usernameSettings()[key] });
  }

  protected regenerate(): void {
    switch (this.mode()) {
      case "password":
        this.passwordCandidates.set(generatePasswords(5, this.options()));
        break;
      case "passphrase":
        this.passphraseCandidates.set(generatePassphrases(5, this.passphraseOptions()));
        break;
      case "username":
        this.usernameCandidates.set(generateUsernames(5, this.usernameOptions()));
        break;
    }
    void this.record(this.primary(), this.mode());
  }

  protected historyKind(credential: GeneratedCredential): string {
    if (credential.algorithm === "passphrase") {
      return this.i18n.t("passphrase");
    }
    if (credential.algorithm === "username") {
      return this.i18n.t("username");
    }
    return this.i18n.t("password");
  }

  /** 侧栏历史时间：当天只显示时分，跨天显示日期，不暴露无关细节。 */
  protected historyTime(date: Date): string {
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (sameDay) {
      const time = date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${this.i18n.t("recentlyActiveToday")} ${time}`;
    }

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /** 从侧栏复制历史值：不再次 track，也不改变当前生成模式。 */
  protected copyHistory(credential: GeneratedCredential): void {
    const copied = this.platformUtilsService.copyToClipboard(credential.credential, { window });
    if (copied !== false) {
      this.showCopyReceipt(
        credential.credential,
        this.i18n.t("valueCopied", this.historyKind(credential)),
      );
    }
  }

  protected copy(value: string): void {
    if (!value) {
      return;
    }
    const copied = this.platformUtilsService.copyToClipboard(value, { window });
    if (copied !== false) {
      this.showCopyReceipt(value, this.i18n.t("valueCopied", this.i18n.t(this.mode())));
      void this.record(value, this.mode());
    }
  }

  /**
   * 复制回执的倒计时使用全局「清除剪贴板」设置。设为「永不」时只显示提示，
   * 不登记自动清理；需要清理时也只在剪贴板仍持有本次复制值时才清空。
   */
  private showCopyReceipt(value: string, message: string): void {
    const delay = clipboardClearSeconds(this.clearClipboardDelay());
    if (delay > 0) {
      this.toast.showClipboard(
        message,
        () => clearClipboardIfStillHolding(this.platformUtilsService, value),
        delay,
      );
    } else {
      this.toast.show(message);
    }
  }

  /** 写进本机加密历史。值本身不进日志，出错只记异常。 */
  protected async record(
    credential: string,
    algorithm: GeneratorMode = this.mode(),
  ): Promise<void> {
    if (!credential) {
      return;
    }
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const category = algorithm === "username" ? Type.username : Type.password;
      await this.generatorHistoryService.track(userId, credential, category, new Date(), algorithm);
    } catch (error) {
      this.logService.error(error);
    }
  }

  private usernameOptions(): UsernameOptions {
    const settings = this.usernameSettings();
    return {
      separator: settings.useHyphen ? "-" : "",
      includeNumber: settings.includeNumber,
    };
  }

  private update(patch: Partial<PasswordOptions>): void {
    const next = { ...this.options(), ...patch };
    this.options.set(next);
    const classes = [next.upper, next.lower, next.digits, next.symbols].filter(Boolean).length;
    if (classes > 0) {
      this.passwordCandidates.set(generatePasswords(5, next));
    }
  }

  private updatePassphrase(patch: Partial<PassphraseOptions>): void {
    const next = { ...this.passphraseOptions(), ...patch };
    this.passphraseOptions.set(next);
    this.passphraseCandidates.set(generatePassphrases(5, next));
  }

  private updateUsername(patch: Partial<UsernameSettings>): void {
    this.usernameSettings.set({ ...this.usernameSettings(), ...patch });
    this.usernameCandidates.set(generateUsernames(5, this.usernameOptions()));
  }
}
