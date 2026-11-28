import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from "@angular/core";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconComponent, LocalPassIcon } from "@localpass/components";

export interface LpFieldOption {
  readonly value: string;
  readonly label: string;
}

/** 下拉里的「自定义」哨兵值；不会作为字段值写出。 */
const CUSTOM_OPTION = "__lp_custom__";

/** 为未显式传入 id 的字段分配稳定的唯一 id，以便 label 关联与自动化定位。 */
let nextFieldUid = 0;

/**
 * 表单里的一项。桌面端与弹窗都使用「标签在上、输入在下」的堆叠布局；
 * 生成器这类紧凑设置仍可用行布局。
 */
@Component({
  selector: "lp-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  // 静态 `id` 既会被 Angular 当作组件输入，也会留在宿主标签上；宿主与内部 input 同 id
  // 会让自动化与屏幕阅读器拿到重复 id，因此显式清掉宿主上的那一份。
  host: { "[attr.id]": "null" },
  template: `
    @if (layout() === "stacked") {
      <div class="tw-block tw-px-4 tw-py-3">
        <label
          [attr.for]="controlId()"
          class="tw-mb-1.5 tw-block tw-text-xs tw-font-medium tw-text-muted"
          >{{ label() }}</label
        >
        <span class="tw-relative tw-block">
          @if (options().length) {
            @if (usingCustom()) {
              <input
                [id]="controlId()"
                class="tw-w-full tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-pe-16 tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted focus:tw-border-border-focus"
                [class.tw-font-mono]="mono()"
                [class.tw-border-border-danger]="error()"
                [value]="value()"
                [attr.placeholder]="placeholder()"
                [attr.autocomplete]="autocomplete()"
                [attr.aria-invalid]="error() ? 'true' : null"
                [attr.aria-describedby]="error() ? errorId() : null"
                (blur)="blurred.emit()"
                (input)="update($event)"
              />
              <button
                type="button"
                class="agy-preset-back tw-absolute tw-end-1.5 tw-top-1/2 -tw-translate-y-1/2"
                [attr.aria-label]="i18n.t('options')"
                [attr.title]="i18n.t('options')"
                (click)="usePreset()"
              >
                {{ i18n.t("preset") }} ▾
              </button>
            } @else {
              <select
                [id]="controlId()"
                class="tw-w-full tw-appearance-none tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-pe-9 tw-text-sm tw-text-main tw-outline-none focus:tw-border-border-focus"
                [class.tw-border-border-danger]="error()"
                [value]="value()"
                [attr.aria-invalid]="error() ? 'true' : null"
                [attr.aria-describedby]="error() ? errorId() : null"
                (blur)="blurred.emit()"
                (change)="selectOption($event)"
              >
                @if (showBlankOption()) {
                  <option value="">{{ placeholder() || "—" }}</option>
                }
                @for (option of options(); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
                @if (allowCustom()) {
                  <option [value]="customOption">{{ i18n.t("custom") }}</option>
                }
              </select>
              <bit-icon
                name="bwi-angle-down"
                class="tw-pointer-events-none tw-absolute tw-end-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-muted"
              ></bit-icon>
            }
          } @else if (multiline()) {
            <textarea
              [id]="controlId()"
              class="tw-w-full tw-resize-y tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted focus:tw-border-border-focus"
              [class.tw-font-mono]="mono()"
              [class.tw-pe-10]="password()"
              [class.agy-secret-area]="password() && !revealed()"
              [class.tw-border-border-danger]="error()"
              rows="3"
              [value]="value()"
              [attr.placeholder]="placeholder()"
              [attr.autocomplete]="autocomplete()"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? errorId() : null"
              (blur)="blurred.emit()"
              (input)="update($event)"
            ></textarea>
            @if (password()) {
              <button
                type="button"
                class="tw-absolute tw-end-1 tw-top-1 tw-grid tw-size-8 tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-hover hover:tw-text-main"
                [attr.aria-label]="revealed() ? i18n.t('hideValue') : i18n.t('showValue')"
                (click)="revealed.set(!revealed())"
              >
                <bit-icon [name]="revealed() ? 'bwi-visibility-off' : 'bwi-visibility'"></bit-icon>
              </button>
            }
          } @else {
            <input
              [id]="controlId()"
              class="tw-w-full tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted focus:tw-border-border-focus"
              [class.tw-font-mono]="mono()"
              [class.tw-pe-10]="actionIcon() || password()"
              [class.tw-pe-16]="actionIcon() && password()"
              [class.tw-border-border-danger]="error()"
              [type]="inputType()"
              [value]="value()"
              [attr.placeholder]="placeholder()"
              [attr.autocomplete]="autocomplete()"
              [attr.maxlength]="maxlength()"
              [attr.inputmode]="inputMode() || null"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? errorId() : null"
              (blur)="blurred.emit()"
              (input)="update($event)"
            />
            @if (actionIcon() || password()) {
              <span
                class="tw-absolute tw-end-1 tw-top-1/2 tw-flex -tw-translate-y-1/2 tw-items-center"
              >
                @if (password()) {
                  <button
                    type="button"
                    class="tw-grid tw-size-8 tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-hover hover:tw-text-main"
                    [attr.aria-label]="revealed() ? i18n.t('hideValue') : i18n.t('showValue')"
                    (click)="revealed.set(!revealed())"
                  >
                    <bit-icon
                      [name]="revealed() ? 'bwi-visibility-off' : 'bwi-visibility'"
                    ></bit-icon>
                  </button>
                }
                @if (actionIcon()) {
                  <button
                    type="button"
                    class="tw-grid tw-size-8 tw-place-items-center tw-rounded-md tw-text-muted hover:tw-bg-bg-hover hover:tw-text-main"
                    [attr.aria-label]="actionLabel()"
                    [attr.title]="actionLabel()"
                    (click)="actionTriggered.emit()"
                  >
                    <bit-icon [name]="actionIcon() ?? 'bwi-generate'"></bit-icon>
                  </button>
                }
              </span>
            }
          }
        </span>
        @if (hint()) {
          <span class="tw-mt-1 tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
            hint()
          }}</span>
        }
        @if (error()) {
          <span
            [id]="errorId()"
            role="alert"
            class="tw-mt-1 tw-block tw-text-xs tw-leading-relaxed tw-text-fg-danger"
            >{{ error() }}</span
          >
        }
      </div>
    } @else {
      <div class="agy-formrow">
        <div class="agy-ext-field tw-cursor-default">
          <label [attr.for]="controlId()" class="agy-k tw-truncate" [attr.title]="label()">{{
            label()
          }}</label>
          @if (options().length) {
            @if (usingCustom()) {
              <input
                [id]="controlId()"
                class="agy-input"
                [class.agy-mono]="mono()"
                [class.agy-input-error]="error()"
                [value]="value()"
                [attr.placeholder]="placeholder()"
                [attr.autocomplete]="autocomplete()"
                [attr.maxlength]="maxlength()"
                [attr.inputmode]="inputMode() || null"
                [attr.aria-invalid]="error() ? 'true' : null"
                [attr.aria-describedby]="error() ? errorId() : null"
                (blur)="blurred.emit()"
                (input)="update($event)"
              />
            } @else {
              <span class="tw-relative tw-flex tw-min-w-0 tw-items-center">
                <select
                  [id]="controlId()"
                  class="agy-input tw-appearance-none tw-pe-5"
                  [class.agy-input-error]="error()"
                  [value]="value()"
                  [attr.aria-invalid]="error() ? 'true' : null"
                  [attr.aria-describedby]="error() ? errorId() : null"
                  (blur)="blurred.emit()"
                  (change)="selectOption($event)"
                >
                  @if (showBlankOption()) {
                    <option value="">{{ placeholder() || "—" }}</option>
                  }
                  @for (option of options(); track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                  @if (allowCustom()) {
                    <option [value]="customOption">{{ i18n.t("custom") }}</option>
                  }
                </select>
                <bit-icon
                  name="bwi-angle-down"
                  class="tw-pointer-events-none tw-absolute tw-end-0 tw-text-xs tw-text-muted"
                ></bit-icon>
              </span>
            }
          } @else if (multiline()) {
            <textarea
              [id]="controlId()"
              class="agy-input tw-resize-y tw-py-1.5"
              [class.agy-input-error]="error()"
              [class.agy-mono]="mono()"
              [class.agy-secret-area]="password() && !revealed()"
              rows="2"
              [value]="value()"
              [attr.placeholder]="placeholder()"
              [attr.autocomplete]="autocomplete()"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? errorId() : null"
              (blur)="blurred.emit()"
              (input)="update($event)"
            ></textarea>
          } @else {
            <input
              [id]="controlId()"
              class="agy-input"
              [class.agy-mono]="mono()"
              [class.agy-input-error]="error()"
              [type]="inputType()"
              [value]="value()"
              [attr.placeholder]="placeholder()"
              [attr.autocomplete]="autocomplete()"
              [attr.maxlength]="maxlength()"
              [attr.inputmode]="inputMode() || null"
              [attr.aria-invalid]="error() ? 'true' : null"
              [attr.aria-describedby]="error() ? errorId() : null"
              (blur)="blurred.emit()"
              (input)="update($event)"
            />
          }
          <span class="tw-flex tw-flex-none tw-items-center tw-gap-0.5">
            @if (options().length && usingCustom()) {
              <button
                type="button"
                class="agy-preset-back"
                [attr.aria-label]="i18n.t('options')"
                [attr.title]="i18n.t('options')"
                (click)="usePreset()"
              >
                {{ i18n.t("preset") }} ▾
              </button>
            }
            @if (password()) {
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="revealed() ? i18n.t('hideValue') : i18n.t('showValue')"
                [attr.title]="revealed() ? i18n.t('hideValue') : i18n.t('showValue')"
                (click)="revealed.set(!revealed())"
              >
                <bit-icon
                  [name]="revealed() ? 'bwi-visibility-off' : 'bwi-visibility'"
                  class="tw-text-xs"
                ></bit-icon>
              </button>
            }
            @if (actionIcon()) {
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="actionLabel()"
                [attr.title]="actionLabel()"
                (click)="actionTriggered.emit()"
              >
                <bit-icon [name]="actionIcon() ?? 'bwi-generate'" class="tw-text-xs"></bit-icon>
              </button>
            }
            @if (removable()) {
              <button
                type="button"
                class="agy-iconbtn agy-sm"
                [attr.aria-label]="removeLabel()"
                [attr.title]="removeLabel()"
                (click)="removeTriggered.emit()"
              >
                <bit-icon name="bwi-close" class="tw-text-xs"></bit-icon>
              </button>
            }
          </span>
        </div>
        @if (hint()) {
          <span class="agy-hint">{{ hint() }}</span>
        }
        @if (error()) {
          <span [id]="errorId()" role="alert" class="agy-hint agy-hint-error">{{ error() }}</span>
        }
      </div>
    }
  `,
})
export class LpFieldComponent {
  protected readonly i18n = inject(I18nService);
  private readonly fallbackId = `lp-field-${++nextFieldUid}`;

  readonly label = input.required<string>();
  /** 给输入控件一个稳定的 id，便于自动化定位；不传则自动分配唯一 id 以关联 label。 */
  readonly id = input<string>("");
  readonly placeholder = input<string>("");
  readonly hint = input<string>("");
  /** Inline validation message; also announces the field as invalid to assistive technology. */
  readonly error = input<string | null>(null);
  readonly password = input(false);
  readonly mono = input(false);
  readonly multiline = input(false);
  readonly autocomplete = input<string>("off");
  readonly layout = input<"row" | "stacked">("stacked");
  readonly options = input<readonly LpFieldOption[]>([]);
  /** 允许在下拉末尾选择「自定义」并输入不在预设里的值。 */
  readonly allowCustom = input(false);
  readonly maxlength = input<number | null>(null);
  readonly inputMode = input<string>("");
  /** 可选的实时格式化回调（如卡有效期 MM/YY），并把格式化结果同步回 DOM 输入框。 */
  readonly format = input<((value: string, deleting: boolean) => string) | null>(null);
  readonly value = model<string>("");
  /** 输入框尾部的动作按钮，例如「生成密码」。 */
  readonly actionIcon = input<LocalPassIcon | undefined>(undefined);
  readonly actionLabel = input<string>("");
  /** 行布局尾部的移除按钮；仅动态表单使用。 */
  readonly removable = input(false);
  readonly removeLabel = input<string>("");

  readonly actionTriggered = output<void>();
  readonly removeTriggered = output<void>();
  /** 输入框失焦；用于「离开密码框后再去校验/读取」这类不在每次按键触发的逻辑。 */
  readonly blurred = output<void>();

  protected readonly revealed = signal(false);
  protected readonly customMode = signal(false);
  protected readonly customOption = CUSTOM_OPTION;
  protected readonly controlId = computed(() => this.id() || this.fallbackId);
  /** 预设下拉当前值为空且选项表里不含空值时，插入占位空项避免浏览器默认选中首项而状态仍为空。 */
  protected readonly showBlankOption = computed(
    () => this.value() === "" && !this.options().some((option) => option.value === ""),
  );
  /**
   * 有预设但当前值不在预设里时（例如从旧条目读出的自定义环境），直接进入输入态。
   * 用户主动选「自定义」时由 customMode 标记。
   */
  protected readonly usingCustom = computed(() => {
    if (!this.options().length) {
      return false;
    }
    if (this.customMode()) {
      return true;
    }
    const value = this.value();
    return value !== "" && !this.options().some((option) => option.value === value);
  });
  protected readonly inputType = computed(() =>
    this.password() && !this.revealed() ? "password" : "text",
  );
  protected readonly errorId = computed(() => `${this.controlId()}-error`);

  protected update(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    let next = target.value;
    const formatter = this.format();
    if (formatter) {
      const deleting =
        typeof InputEvent !== "undefined" &&
        event instanceof InputEvent &&
        event.inputType.startsWith("delete");
      next = formatter(next, deleting);
      if (target.value !== next) {
        target.value = next;
      }
    }
    this.value.set(next);
  }

  protected selectOption(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (this.allowCustom() && value === CUSTOM_OPTION) {
      this.customMode.set(true);
      this.value.set("");
      return;
    }
    this.customMode.set(false);
    this.value.set(value);
  }

  /** 从自定义输入切回预设：选中第一个预设，与原型「预设 ▾」一致。 */
  protected usePreset(): void {
    const [preset] = this.options();
    this.customMode.set(false);
    this.value.set(preset?.value ?? "");
  }
}
