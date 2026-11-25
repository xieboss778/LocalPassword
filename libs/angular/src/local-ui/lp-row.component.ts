import { ChangeDetectionStrategy, Component, inject, input, output, signal } from "@angular/core";

import { LpToastService } from "./lp-toast.service";

/**
 * 一行。右端只允许「值 / 开关 / chevron / 复制提示」之一。
 *
 * 可复制的行（`copyValue` 非空）点整行即复制，并同时给三重反馈：行底变绿、图标变 ✓、
 * 底部浮层「<字段> 已复制」。见 docs/LocalPass-界面规范.md §3 第 7 条。
 */
@Component({
  selector: "lp-row",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "tw-flex tw-min-h-11 tw-cursor-pointer tw-items-center tw-gap-3 tw-px-3.5 tw-py-2.5 tw-bg-[var(--lp-card)] tw-transition-colors hover:tw-bg-[#f7f9ff] active:tw-bg-[var(--lp-brand-soft)]",
    "[class.tw-cursor-default]": "!copyValue() && !clickable()",
    "[class.tw-bg-[#eef9f0]]": "copied()",
    "[class.hover:tw-bg-[#eef9f0]]": "copied()",
    "(click)": "activate()",
  },
  template: `
    @if (emoji()) {
      <span class="tw-w-[26px] tw-flex-none tw-text-center tw-text-[15px]" aria-hidden="true">{{
        emoji()
      }}</span>
    } @else if (icon()) {
      <span class="tw-flex-none tw-text-[var(--lp-ink-3)]" aria-hidden="true">{{ icon() }}</span>
    }

    <span class="tw-min-w-0 tw-flex-1">
      <span class="tw-text-[13px]">{{ label() }}</span>
      @if (sub()) {
        <span class="tw-mt-0.5 tw-block tw-text-[11px] tw-text-[var(--lp-ink-3)]">{{ sub() }}</span>
      }
    </span>

    @if (value()) {
      <span
        class="tw-truncate tw-text-[12px] tw-text-[var(--lp-ink-3)]"
        [class.tw-text-[var(--lp-brand)]]="brand()"
        [class.tw-font-mono]="mono()"
        >{{ value() }}</span
      >
    }

    @if (toggle() !== undefined) {
      <span
        class="tw-relative tw-h-[22px] tw-w-[38px] tw-flex-none tw-rounded-full tw-transition-colors"
        [class.tw-bg-[var(--lp-green)]]="toggle()"
        [class.tw-bg-[#d3d7de]]="!toggle()"
        role="switch"
        [attr.aria-checked]="toggle()"
      >
        <span
          class="tw-absolute tw-top-0.5 tw-h-[18px] tw-w-[18px] tw-rounded-full tw-bg-[#fff] tw-shadow-[0_1px_2px_#00000026] tw-transition-all"
          [style.left.px]="toggle() ? 18 : 2"
        ></span>
      </span>
    } @else if (copyValue()) {
      <span
        class="tw-grid tw-size-5 tw-flex-none tw-place-items-center"
        [class.tw-text-[#b3b8c2]]="!copied()"
        [class.tw-text-[#1f6b33]]="copied()"
        aria-hidden="true"
        >{{ copied() ? "✓" : "⧉" }}</span
      >
    } @else if (chevron()) {
      <span class="tw-flex-none tw-text-[#b3b8c2]" aria-hidden="true">›</span>
    }
  `,
})
export class LpRowComponent {
  private readonly toast = inject(LpToastService);

  readonly label = input.required<string>();
  readonly sub = input<string>("");
  readonly value = input<string>("");
  readonly emoji = input<string>("");
  readonly icon = input<string>("");
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
      this.activated.emit();
      return;
    }
    void this.copy(value);
  }

  private async copy(value: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      // 剪贴板不可用（无权限或非安全上下文）也照常给反馈，别让用户以为没点到。
    }

    this.copied.set(true);
    this.toast.show(`${this.copyLabel() || this.label()} 已复制`);
    this.copiedValue.emit(value);

    const previous = this.timer();
    if (previous) {
      clearTimeout(previous);
    }
    this.timer.set(setTimeout(() => this.copied.set(false), 1300));
  }
}
