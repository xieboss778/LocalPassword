import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** 页头：大标题 + 说明 + 右侧动作槽。 */
@Component({
  selector: "lp-page-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-items-start tw-gap-2 tw-px-4 tw-pt-3 tw-pb-2">
      <div class="tw-min-w-0 tw-flex-1">
        <h1 class="tw-m-0 tw-text-[21px] tw-font-bold tw-tracking-[-0.02em]">{{ title() }}</h1>
        @if (sub()) {
          <div class="tw-mt-0.5 tw-text-[11px] tw-text-[var(--lp-ink-3)]">{{ sub() }}</div>
        }
      </div>
      <div class="tw-flex tw-flex-none tw-gap-1.5">
        <ng-content />
      </div>
    </div>
  `,
})
export class LpPageHeaderComponent {
  readonly title = input.required<string>();
  readonly sub = input<string>("");
}
