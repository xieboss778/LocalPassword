import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** 页头：标题、说明与右侧动作槽。桌面端用大号，扩展弹窗用紧凑号。 */
@Component({
  selector: "lp-page-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="tw-flex tw-items-start tw-gap-3"
      [class.tw-px-6]="!compact()"
      [class.tw-pt-6]="!compact()"
      [class.tw-pb-4]="!compact()"
      [class.tw-px-4]="compact()"
      [class.tw-pt-4]="compact()"
      [class.tw-pb-3]="compact()"
    >
      <div class="tw-min-w-0 tw-flex-1">
        <h1
          class="tw-m-0 tw-font-semibold tw-tracking-tight tw-text-main"
          [class.tw-text-2xl]="!compact()"
          [class.tw-text-xl]="compact()"
        >
          {{ title() }}
        </h1>
        @if (sub()) {
          <div class="tw-mt-1 tw-text-sm tw-text-muted">{{ sub() }}</div>
        }
      </div>
      <div class="tw-flex tw-flex-none tw-items-center tw-gap-1">
        <ng-content />
      </div>
    </div>
  `,
})
export class LpPageHeaderComponent {
  readonly title = input.required<string>();
  readonly sub = input<string>("");
  /** 扩展弹窗的 380px 宽度下用紧凑间距。 */
  readonly compact = input(false);
}
