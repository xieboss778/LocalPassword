import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * 一组同类的行：小号大写标题 + 一张带描边的卡片。
 * 原型里「凭据 / 自动填充 / 自定义字段」每一段都是它。
 */
@Component({
  selector: "lp-group",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <div
        class="tw-px-1 tw-pt-4 tw-pb-2 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-muted"
      >
        {{ label() }}
      </div>
    }
    <div class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background">
      <ng-content />
    </div>
  `,
  host: { class: "tw-block tw-px-4" },
})
export class LpGroupComponent {
  readonly label = input<string>("");
}
