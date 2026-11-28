import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** 页头：标题、说明与右侧动作槽。桌面端用大号，扩展弹窗用紧凑号。 */
@Component({
  selector: "lp-page-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="agy-pagehead" [class.agy-pagehead-compact]="compact()">
      <div class="agy-pagehead-main">
        <h1 class="agy-pagehead-h">{{ title() }}</h1>
        @if (sub()) {
          <div class="agy-pagehead-s">{{ sub() }}</div>
        }
      </div>
      <div class="agy-pagehead-actions">
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
