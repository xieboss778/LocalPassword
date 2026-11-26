import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { IconTileComponent, LocalPassIcon } from "@localpass/components";

/** 空状态：彩色图标块 + 一句目的说明 + 动作槽。 */
@Component({
  selector: "lp-empty",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconTileComponent],
  template: `
    <div class="tw-px-6 tw-py-10 tw-text-center">
      <bit-icon-tile class="tw-mb-4" [icon]="icon()" variant="brand" size="xl"></bit-icon-tile>
      <h2 class="tw-m-0 tw-text-lg tw-font-semibold tw-text-main">{{ title() }}</h2>
      @if (text()) {
        <p class="tw-mx-auto tw-mt-2 tw-max-w-sm tw-text-sm tw-leading-relaxed tw-text-muted">
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
