import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** 空状态：圆底图标 + 一句目的说明 + 动作槽。 */
@Component({
  selector: "lp-empty",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-px-6 tw-pt-6 tw-pb-2 tw-text-center">
      <div
        class="tw-mx-auto tw-mb-3 tw-grid tw-size-16 tw-place-items-center tw-rounded-full tw-bg-[var(--lp-brand-soft)] tw-text-[26px]"
        aria-hidden="true"
      >
        {{ icon() }}
      </div>
      <h3 class="tw-m-0 tw-text-[15px] tw-font-semibold">{{ title() }}</h3>
      @if (text()) {
        <p class="tw-m-0 tw-mt-1.5 tw-text-[11.5px] tw-leading-relaxed tw-text-[var(--lp-ink-3)]">
          {{ text() }}
        </p>
      }
    </div>
    <div class="tw-flex tw-flex-col tw-gap-2 tw-px-4 tw-pt-4">
      <ng-content />
    </div>
  `,
})
export class LpEmptyComponent {
  readonly icon = input<string>("");
  readonly title = input.required<string>();
  readonly text = input<string>("");
}
