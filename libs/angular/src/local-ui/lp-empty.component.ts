import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { IconComponent, LocalPassIcon } from "@localpass/components";

/** 空状态：圆形品牌图标块 + 一句目的说明 + 动作槽。 */
@Component({
  selector: "lp-empty",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="tw-px-7 tw-py-12 tw-text-center">
      <span
        class="tw-mx-auto tw-mb-4 tw-grid tw-size-16 tw-place-items-center tw-rounded-full tw-bg-bg-brand-softer tw-text-fg-brand"
      >
        <bit-icon [name]="icon()" class="tw-text-3xl"></bit-icon>
      </span>
      <h2 class="tw-m-0 tw-text-base tw-font-semibold tw-text-main">{{ title() }}</h2>
      @if (text()) {
        <p class="tw-mx-auto tw-mt-2 tw-max-w-xs tw-text-sm tw-leading-relaxed tw-text-muted">
          {{ text() }}
        </p>
      }
      <div class="tw-mt-5 tw-flex tw-flex-col tw-items-center tw-gap-2">
        <ng-content />
      </div>
    </div>
  `,
  host: { class: "tw-block" },
})
export class LpEmptyComponent {
  readonly icon = input.required<LocalPassIcon>();
  readonly title = input.required<string>();
  readonly text = input<string>("");
}
