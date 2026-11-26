import { ChangeDetectionStrategy, Component, inject, input, output, signal } from "@angular/core";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconComponent, LocalPassIcon } from "@localpass/components";

import { LpToastService } from "./lp-toast.service";

/**
 * 一行。右端只允许「值 / 开关 / chevron / 复制提示」之一。
 *
 * 可复制的行（`copyValue` 非空）点整行即复制，并同时给三重反馈：行底变绿、图标变 ✓、
 * 底部浮层「<字段> 已复制」。
 */
@Component({
  selector: "lp-row",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    class:
      "tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-4 tw-py-3 last:tw-border-b-0 tw-transition-colors hover:tw-bg-bg-hover",
    "[class.tw-cursor-pointer]": "copyValue() || clickable()",
    "[class.tw-cursor-default]": "!copyValue() && !clickable()",
    "[class.tw-bg-bg-success-soft]": "copied()",
    "[class.hover:tw-bg-bg-success-soft]": "copied()",
    "[attr.tabindex]": "copyValue() || clickable() ? 0 : null",
    "[attr.role]": "copyValue() || clickable() ? 'button' : null",
    "(click)": "activate()",
    "(keydown.enter)": "activate()",
    "(keydown.space)": "onSpace($event)",
  },
  template: `
    @if (icon()) {
      <span
        class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
      >
        <bit-icon [name]="icon()" class="tw-text-base"></bit-icon>
      </span>
    }

    <span class="tw-min-w-0 tw-flex-1">
      <span class="tw-block tw-text-sm tw-text-main">{{ label() }}</span>
      @if (sub()) {
        <span class="tw-mt-0.5 tw-block tw-text-xs tw-leading-relaxed tw-text-muted">{{
          sub()
        }}</span>
      }
    </span>

    @if (value()) {
      <span
        class="tw-max-w-28 tw-truncate tw-text-end tw-text-sm tw-text-muted"
        [class.tw-text-fg-brand]="brand()"
        [class.tw-font-mono]="mono()"
        [attr.title]="value()"
        >{{ value() }}</span
      >
    }

    @if (toggle() !== undefined) {
      <span
        class="tw-relative tw-h-5 tw-w-9 tw-flex-none tw-rounded-full tw-transition-colors"
        [class.tw-bg-bg-success]="toggle()"
        [class.tw-bg-bg-gray-strong]="!toggle()"
        role="switch"
        [attr.aria-checked]="toggle()"
      >
        <span
          class="tw-absolute tw-top-0.5 tw-size-4 tw-rounded-full tw-bg-bg-primary tw-shadow-sm tw-transition-all"
          [style.inset-inline-start.px]="toggle() ? 18 : 2"
        ></span>
      </span>
    } @else if (copyValue()) {
      <span class="tw-grid tw-size-6 tw-flex-none tw-place-items-center" aria-hidden="true">
        @if (copied()) {
          <bit-icon name="bwi-check" class="tw-text-base tw-text-fg-success"></bit-icon>
        } @else {
          <bit-icon name="bwi-copy" class="tw-text-base tw-text-muted"></bit-icon>
        }
      </span>
    } @else if (chevron()) {
      <bit-icon name="bwi-angle-right" class="tw-text-base tw-text-muted"></bit-icon>
    }
  `,
})
export class LpRowComponent {
  private readonly toast = inject(LpToastService);
  private readonly i18n = inject(I18nService);

  readonly label = input.required<string>();
  readonly sub = input<string>("");
  readonly value = input<string>("");
  readonly icon = input<LocalPassIcon | undefined>(undefined);
  readonly mono = input(false);
  readonly brand = input(false);
  readonly chevron = input(false);
  readonly toggle = input<boolean | undefined>(undefined);
  /** 非空表示这行可复制；值是真正写进剪贴板的内容。 */
  readonly copyValue = input<string>("");
  readonly copyLabel = input<string>("");
  readonly clickable = input(false);

  readonly activated = output<void>();
  readonly copiedValue = output<string>();

  protected readonly copied = signal(false);
  private readonly timer = signal<ReturnType<typeof setTimeout> | null>(null);

  /** 有副本时复制，否则把点击透给父组件做导航。 */
  protected activate(): void {
    const value = this.copyValue();
    if (!value) {
      if (this.clickable()) {
        this.activated.emit();
      }
      return;
    }
    void this.copy(value);
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.activate();
  }

  private async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // 剪贴板不可用（无权限或非安全上下文）也照常给反馈，别让用户以为没点到。
    }

    this.copied.set(true);
    this.toast.show(this.i18n.t("valueCopied", this.copyLabel() || this.label()));
    this.copiedValue.emit(value);

    const previous = this.timer();
    if (previous) {
      clearTimeout(previous);
    }
    this.timer.set(setTimeout(() => this.copied.set(false), 1300));
  }
}
