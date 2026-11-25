import { ChangeDetectionStrategy, Component, input, model } from "@angular/core";

/**
 * 表单里的一行：左边标签，右边可编辑值。
 * 与 {@link LpRowComponent} 同一套度量，区别只在值能否编辑。
 */
@Component({
  selector: "lp-field",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="tw-flex tw-min-h-11 tw-items-center tw-gap-3 tw-border-b tw-border-[#0000000a] tw-px-3.5 tw-py-2.5 last:tw-border-b-0"
    >
      <span class="tw-w-[102px] tw-flex-none tw-text-[12.5px] tw-text-[var(--lp-ink-2)]">{{ label() }}</span>
      @if (multiline()) {
        <textarea
          class="tw-min-w-0 tw-flex-1 tw-resize-none tw-border-0 tw-bg-transparent tw-text-[12.5px] tw-outline-none"
          rows="2"
          [value]="value()"
          [attr.placeholder]="placeholder()"
          (input)="update($event)"
        ></textarea>
      } @else {
        <input
          class="tw-min-w-0 tw-flex-1 tw-border-0 tw-bg-transparent tw-text-[12.5px] tw-outline-none"
          [type]="password() ? 'password' : 'text'"
          [value]="value()"
          [attr.placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          (input)="update($event)"
        />
      }
    </label>
  `,
})
export class LpFieldComponent {
  readonly label = input.required<string>();
  readonly placeholder = input<string>("");
  readonly password = input(false);
  readonly multiline = input(false);
  readonly autocomplete = input<string>("off");
  readonly value = model<string>("");

  protected update(event: Event): void {
    this.value.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
