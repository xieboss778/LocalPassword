import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconButtonModule } from "@localpass/components";
import {
  DEFAULT_PASSWORD_OPTIONS,
  generatePasswords,
  PasswordOptions,
} from "@localpass/local-vault";

/**
 * 密码生成器（方向 C）。
 *
 * 生成逻辑是 `@localpass/local-vault` 里的纯函数（有单测），这里只管选项与呈现；
 * 复制照旧——点结果那一行。
 */
@Component({
  selector: "generator-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    IconButtonModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header [title]="i18n.t('generator')" [sub]="i18n.t('generatorSubtitle')">
        <button
          type="button"
          bitIconButton="bwi-generate"
          [label]="i18n.t('regenerate')"
          (click)="regenerate()"
        ></button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group [label]="i18n.t('candidates')">
          @for (candidate of candidates(); track candidate) {
            <lp-row
              [label]="candidate"
              [mono]="true"
              [copyValue]="candidate"
              [copyLabel]="i18n.t('password')"
            />
          }
        </lp-group>

        <lp-group [label]="i18n.t('options')">
          <div class="tw-flex tw-items-center tw-gap-3 tw-px-3.5 tw-py-2.5">
            <span class="tw-w-[102px] tw-flex-none tw-text-[12.5px] tw-text-[var(--lp-ink-2)]">{{
              i18n.t("length")
            }}</span>
            <input
              type="range"
              class="tw-min-w-0 tw-flex-1"
              min="4"
              max="64"
              [value]="length()"
              (input)="setLength($event)"
            />
            <span class="tw-w-6 tw-text-right tw-text-[12.5px] tw-font-semibold">{{
              length()
            }}</span>
          </div>

          @for (toggle of toggles(); track toggle.key) {
            <lp-row
              [label]="i18n.t(toggle.labelKey)"
              [toggle]="options()[toggle.key]"
              [clickable]="true"
              (activated)="flip(toggle.key)"
            />
          }
        </lp-group>

        @if (strengthLabel()) {
          <p class="tw-px-4 tw-pt-3 tw-text-[10.5px] tw-text-[var(--lp-ink-3)]">
            {{ strengthLabel() }}
          </p>
        }
      </div>
    </div>
  `,
})
export class GeneratorV2Component {
  protected readonly i18n = inject(I18nService);

  protected readonly candidates = signal<string[]>(generatePasswords(5, DEFAULT_PASSWORD_OPTIONS));
  protected readonly options = signal<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);

  protected readonly length = computed(() => this.options().length);
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
      .replace("$LENGTH", `${current.length}`)
      .replace("$CLASSES", `${classes}`)
      .replace("$SCORE", `${score}`);
  });

  protected setLength(event: Event): void {
    const length = Number((event.target as HTMLInputElement).value);
    this.update({ length });
  }

  protected flip(key: "upper" | "lower" | "digits" | "symbols" | "avoidAmbiguous"): void {
    this.update({ [key]: !this.options()[key] } as Partial<PasswordOptions>);
  }

  protected regenerate(): void {
    this.candidates.set(generatePasswords(5, this.options()));
  }

  private update(patch: Partial<PasswordOptions>): void {
    const next = { ...this.options(), ...patch };
    this.options.set(next);
    const classes = [next.upper, next.lower, next.digits, next.symbols].filter(Boolean).length;
    if (classes > 0) {
      this.candidates.set(generatePasswords(5, next));
    }
  }
}
