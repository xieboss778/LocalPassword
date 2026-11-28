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
      <div class="agy-seclbl tw-flex tw-items-center tw-gap-1.5">
        {{ label() }}
      </div>
    }
    <div class="agy-grp">
      <ng-content />
    </div>
  `,
  host: { class: "tw-block tw-pb-2" },
})
export class LpGroupComponent {
  readonly label = input<string>("");
}
