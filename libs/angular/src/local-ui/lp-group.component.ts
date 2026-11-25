import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * 一组同类的行：小号大写标题 + 一张圆角卡片。
 * 原型里「凭据 / 自动填充 / 自定义字段」每一段都是它。
 */
@Component({
  selector: "lp-group",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <div
        class="tw-px-[18px] tw-pt-4 tw-pb-1.5 tw-text-[10.5px] tw-uppercase tw-tracking-[0.07em] tw-text-[var(--lp-ink-3)]"
      >
        {{ label() }}
      </div>
    }
    <div
      class="tw-mx-3 tw-overflow-hidden tw-rounded-[14px] tw-bg-[var(--lp-card)] tw-shadow-[0_1px_2px_#10131812]"
    >
      <ng-content />
    </div>
  `,
})
export class LpGroupComponent {
  readonly label = input<string>("");
}
