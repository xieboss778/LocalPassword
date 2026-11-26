import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, IconButtonModule, IconModule } from "@localpass/components";
import { Type } from "@localpass/generator-core";
import { GeneratorHistoryService } from "@localpass/generator-history";
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

import { JslibModule } from "../../jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
  LpToastService,
} from "../../local-ui";

/**
 * 密码生成器。
 *
 * 生成逻辑是 `@localpass/local-vault` 里的纯函数（有单测），这里只管选项与呈现。
 * 生成不联网。用户复制或重新生成的值会写入本机加密的生成历史。
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
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    ButtonModule,
    IconButtonModule,
    IconModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      @if (compact()) {
        <lp-popup-header [title]="i18n.t('generator')" [sub]="i18n.t('generatorSubtitle')">
          <div slot="actions" class="tw-flex tw-items-center tw-gap-0.5">
            <a
              [routerLink]="historyRoute()"
              class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
              [attr.aria-label]="i18n.t('generatorHistory')"
              [attr.title]="i18n.t('generatorHistory')"
            >
              <bit-icon name="bwi-clock" class="tw-text-base"></bit-icon>
            </a>
            <button
              type="button"
              class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
              [attr.aria-label]="i18n.t('regenerate')"
              [attr.title]="i18n.t('regenerate')"
              (click)="regenerate()"
            >
              <bit-icon name="bwi-generate" class="tw-text-base"></bit-icon>
            </button>
          </div>
        </lp-popup-header>
      } @else {
        <lp-page-header [title]="i18n.t('generator')" [sub]="i18n.t('generatorSubtitle')">
          <a bitButton buttonType="secondary" startIcon="bwi-clock" [routerLink]="historyRoute()">
            {{ i18n.t("generatorHistory") }}
          </a>
          <button
            type="button"
            bitButton
            buttonType="secondary"
            startIcon="bwi-generate"
            (click)="regenerate()"
          >
            {{ i18n.t("regenerate") }}
          </button>
        </lp-page-header>
      }

      <div
        class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pb-7"
        [class.tw-px-7]="!compact()"
        [class.tw-px-4]="compact()"
      >
        <div class="tw-grid tw-gap-4 xl:tw-grid-cols-5">
          <div class="tw-space-y-4 xl:tw-col-span-3">
            <div
              class="tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-shadow-sm"
              [class.tw-p-5]="!compact()"
              [class.tw-p-4]="compact()"
            >
              <div
                class="tw-mb-4 tw-grid tw-grid-cols-3 tw-gap-1 tw-rounded-lg tw-bg-background-alt tw-p-1"
                role="tablist"
                [attr.aria-label]="i18n.t('generator')"
              >
                @for (tab of modes; track tab.key) {
                  <button
                    type="button"
                    role="tab"
                    class="tw-rounded-md tw-px-3 tw-py-1.5 tw-text-sm tw-font-medium"
                    [class.tw-bg-background]="mode() === tab.key"
                    [class.tw-text-main]="mode() === tab.key"
                    [class.tw-shadow-sm]="mode() === tab.key"
                    [class.tw-text-muted]="mode() !== tab.key"
                    [attr.aria-selected]="mode() === tab.key"
                    (click)="setMode(tab.key)"
                  >
                    {{ i18n.t(tab.labelKey) }}
                  </button>
                }
              </div>

              <div
                class="tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border tw-border-border-light tw-bg-background-alt tw-px-4 tw-py-3"
              >
                <code
                  class="tw-min-w-0 tw-flex-1 tw-break-all tw-font-mono tw-text-lg tw-font-medium tw-text-main"
                  >{{ primary() }}</code
                >
                <button
                  type="button"
                  bitIconButton="bwi-copy"
                  [label]="i18n.t('copy')"
                  (click)="copy(primary())"
                ></button>
              </div>

              <div class="tw-mt-4 tw-flex tw-gap-2">
                <button
                  type="button"
                  bitButton
                  buttonType="primary"
                  startIcon="bwi-copy"
                  (click)="copy(primary())"
                >
                  {{ i18n.t("copy") }}
                </button>
                <button
                  type="button"
                  bitButton
                  buttonType="secondary"
                  startIcon="bwi-generate"
                  (click)="regenerate()"
                >
                  {{ i18n.t("regenerate") }}
                </button>
              </div>

              @if (mode() === "password") {
                <div class="tw-mt-5">
                  <div class="tw-flex tw-items-center tw-justify-between">
                    <span class="tw-text-sm tw-text-main">{{ i18n.t("length") }}</span>
                    <span class="tw-text-sm tw-font-semibold tw-text-main">{{ length() }}</span>
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

                <div class="tw-mt-3">
                  @for (toggle of toggles(); track toggle.key) {
                    <lp-row
                      [label]="i18n.t(toggle.labelKey)"
                      [toggle]="options()[toggle.key]"
                      [clickable]="true"
                      (activated)="flip(toggle.key)"
                    ></lp-row>
                  }
                </div>

                @if (strengthLabel()) {
                  <p class="tw-mt-4 tw-text-xs tw-leading-relaxed tw-text-muted">
                    {{ strengthLabel() }}
                  </p>
                }
              } @else if (mode() === "passphrase") {
                <div class="tw-mt-5">
                  <div class="tw-flex tw-items-center tw-justify-between">
                    <span class="tw-text-sm tw-text-main">{{ i18n.t("numWords") }}</span>
                    <span class="tw-text-sm tw-font-semibold tw-text-main">{{ wordCount() }}</span>
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
                    class="tw-block tw-text-sm tw-text-main"
                    >{{ i18n.t("wordSeparator") }}</label
                  >
                  <input
                    id="generator-v2_input_separator"
                    type="text"
                    class="tw-mt-1 tw-w-full tw-rounded-lg tw-border tw-border-border-light tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main"
                    maxlength="3"
                    [value]="passphraseOptions().separator"
                    (input)="setSeparator($event)"
                  />
                </div>

                <div class="tw-mt-3">
                  <lp-row
                    [label]="i18n.t('capitalize')"
                    [toggle]="passphraseOptions().capitalize"
                    [clickable]="true"
                    (activated)="flipPassphrase('capitalize')"
                  ></lp-row>
                  <lp-row
                    [label]="i18n.t('includeNumber')"
                    [toggle]="passphraseOptions().includeNumber"
                    [clickable]="true"
                    (activated)="flipPassphrase('includeNumber')"
                  ></lp-row>
                </div>
              } @else {
                <div class="tw-mt-5 tw-flex tw-flex-col tw-gap-2">
                  <lp-row
                    [label]="i18n.t('includeNumber')"
                    [toggle]="usernameSettings().includeNumber"
                    [clickable]="true"
                    (activated)="flipUsername('includeNumber')"
                  ></lp-row>
                  <lp-row
                    [label]="i18n.t('usernameUseHyphen')"
                    [toggle]="usernameSettings().useHyphen"
                    [clickable]="true"
                    (activated)="flipUsername('useHyphen')"
                  ></lp-row>
                </div>
                <p class="tw-mt-4 tw-text-xs tw-leading-relaxed tw-text-muted">
                  {{ i18n.t("generatorUsernameNotice") }}
                </p>
              }
            </div>

            @if (!compact()) {
              <lp-group [label]="i18n.t('candidates')">
                @for (candidate of candidates(); track candidate; let index = $index) {
                  @if (index > 0) {
                    <lp-row
                      [label]="candidate"
                      [mono]="true"
                      [copyValue]="candidate"
                      [copyLabel]="i18n.t(mode())"
                      (copiedValue)="record($event)"
                    />
                  }
                }
              </lp-group>
            }
          </div>

          @if (!compact()) {
            <aside
              class="tw-self-start tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 xl:tw-col-span-2"
            >
              <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
                {{ i18n.t("options") }}
              </h2>
              <dl class="tw-mt-3 tw-space-y-3">
                @if (mode() === "password") {
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("length") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-font-medium tw-text-main">{{ length() }}</dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("uppercase") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{ options().upper ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("lowercase") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{ options().lower ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("numbers") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{ options().digits ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("symbols") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{ options().symbols ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("avoidAmbiguous") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{ options().avoidAmbiguous ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                } @else if (mode() === "passphrase") {
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("numWords") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-font-medium tw-text-main">{{ wordCount() }}</dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("wordSeparator") }}</dt>
                    <dd class="tw-m-0 tw-font-mono tw-text-sm tw-text-main">
                      "{{ passphraseOptions().separator }}"
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("capitalize") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{ passphraseOptions().capitalize ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("includeNumber") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{
                        passphraseOptions().includeNumber ? i18n.t("enabled") : i18n.t("disabled")
                      }}
                    </dd>
                  </div>
                } @else {
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("includeNumber") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{
                        usernameSettings().includeNumber ? i18n.t("enabled") : i18n.t("disabled")
                      }}
                    </dd>
                  </div>
                  <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <dt class="tw-text-sm tw-text-muted">{{ i18n.t("usernameUseHyphen") }}</dt>
                    <dd class="tw-m-0 tw-text-sm tw-text-main">
                      {{ usernameSettings().useHyphen ? i18n.t("enabled") : i18n.t("disabled") }}
                    </dd>
                  </div>
                }
              </dl>
              <p class="tw-mt-4 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("generatorLocalOnlyNotice") }}
              </p>
            </aside>
          }
        </div>
      </div>
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

  /** 弹窗路由在 route.data 里标记 compact；桌面端保持完整两栏。 */
  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);

  /** 弹窗里历史页挂在 `tabs` 下，桌面端是顶层路由。 */
  protected readonly historyRoute = computed(() =>
    this.compact() ? "/tabs/generator-history-v2" : "/generator-history-v2",
  );

  protected readonly mode = signal<GeneratorMode>("password");
  protected readonly modes: readonly { key: GeneratorMode; labelKey: string }[] = [
    { key: "password", labelKey: "password" },
    { key: "passphrase", labelKey: "passphrase" },
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

  /** 粗粒度的强度提示：长度 × 字符集数，够用且不假装精确。 */
  protected readonly strengthLabel = computed(() => {
    const current = this.options();
    const classes = [current.upper, current.lower, current.digits, current.symbols].filter(
      Boolean,
    ).length;
    if (classes === 0) {
      return this.i18n.t("generatorNoCharset");
    }
    const score = current.length * classes;
    return this.i18n
      .t("generatorStrength")
      .replace("{LENGTH}", `${current.length}`)
      .replace("{CLASSES}", `${classes}`)
      .replace("{SCORE}", `${score}`);
  });

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

  protected copy(value: string): void {
    if (!value) {
      return;
    }
    const copied = this.platformUtilsService.copyToClipboard(value, { window });
    if (copied !== false) {
      this.toast.show(this.i18n.t("valueCopied", this.i18n.t(this.mode())));
      void this.record(value, this.mode());
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
