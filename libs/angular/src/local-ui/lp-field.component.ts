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

/**
 * 表单里的一项。桌面端与弹窗都使用「标签在上、输入在下」的堆叠布局；
 * 生成器这类紧凑设置仍可用行布局。
 */
@Component({
  selector: "lp-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (layout() === "stacked") {
      <label class="tw-block tw-px-4 tw-py-3">
        <span class="tw-mb-1.5 tw-block tw-text-xs tw-font-medium tw-text-muted">{{
          label()
        }}</span>
        <span class="tw-relative tw-block">
          @if (options().length) {
            <select
              class="tw-w-full tw-appearance-none tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-pe-9 tw-text-sm tw-text-main tw-outline-none focus:tw-border-border-focus"
              [value]="value()"
              (change)="update($event)"
            >
              @for (option of options(); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            <bit-icon
              name="bwi-angle-down"
              class="tw-pointer-events-none tw-absolute tw-end-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-muted"
            ></bit-icon>
          } @else if (multiline()) {
            <textarea
              class="tw-w-full tw-resize-y tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted focus:tw-border-border-focus"
              rows="3"
              [value]="value()"
              [attr.placeholder]="placeholder()"
              [attr.autocomplete]="autocomplete()"
              (input)="update($event)"
            ></textarea>
          } @else {
            <input
              class="tw-w-full tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted focus:tw-border-border-focus"
              [class.tw-font-mono]="mono()"
              [class.tw-pe-10]="actionIcon() || password()"
              [class.tw-pe-16]="actionIcon() && password()"
              [type]="inputType()"
              [value]="value()"
              [attr.placeholder]="placeholder()"
              [attr.autocomplete]="autocomplete()"
              (input)="update($event)"
            />
            @if (actionIcon() || password()) {
              <span
                class="tw-absolute tw-end-1 tw-top-1/2 tw-flex -tw-translate-y-1/2 tw-items-center"
              >
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
              </span>
            }
          }
        </span>
        @if (hint()) {
          <span class="tw-mt-1 tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
            hint()
          }}</span>
        }
      </label>
    } @else {
      <label
        class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0"
      >
        <span class="tw-w-28 tw-flex-none tw-text-sm tw-text-muted">{{ label() }}</span>
        <input
          class="tw-min-w-0 tw-flex-1 tw-border-0 tw-bg-transparent tw-text-sm tw-text-main tw-outline-none placeholder:tw-text-muted"
          [type]="inputType()"
          [value]="value()"
          [attr.placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          (input)="update($event)"
        />
      </label>
    }
  `,
})
export class LpFieldComponent {
  protected readonly i18n = inject(I18nService);

  readonly label = input.required<string>();
  readonly placeholder = input<string>("");
  readonly hint = input<string>("");
  readonly password = input(false);
  readonly mono = input(false);
  readonly multiline = input(false);
  readonly autocomplete = input<string>("off");
  readonly layout = input<"row" | "stacked">("stacked");
  readonly options = input<readonly LpFieldOption[]>([]);
  readonly value = model<string>("");
  /** 输入框尾部的动作按钮，例如「生成密码」。 */
  readonly actionIcon = input<LocalPassIcon | undefined>(undefined);
  readonly actionLabel = input<string>("");

  readonly actionTriggered = output<void>();

  protected readonly revealed = signal(false);
  protected readonly inputType = computed(() =>
    this.password() && !this.revealed() ? "password" : "text",
  );

  protected update(event: Event): void {
    this.value.set(
      (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value,
    );
  }
}
