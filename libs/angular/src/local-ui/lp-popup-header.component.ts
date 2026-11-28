import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";

/**
 * 弹窗页头（AGY 紧凑版）：38px 固定高度，返回键或品牌块 + 标题/副标题 + 右侧动作。
 *
 * 弹窗页头必须固定在滚动区外，不能跟着内容滚走；380px 宽度下标题只保留一行。
 */
@Component({
  selector: "lp-popup-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconModule],
  host: { class: "tw-block tw-flex-none" },
  template: `
    <header class="agy agy-ext-header">
      @if (back()) {
        <button
          type="button"
          class="agy-iconbtn"
          [attr.aria-label]="i18n.t('back')"
          (click)="backTriggered.emit()"
        >
          <bit-icon name="bwi-angle-left" class="tw-text-base"></bit-icon>
        </button>
      } @else if (avatar()) {
        <span class="agy-avatar" aria-hidden="true">LP</span>
      }

      <div class="tw-min-w-0 tw-flex-1">
        <div class="tw-flex tw-items-center tw-gap-1.5">
          <div class="agy-name" [attr.title]="title()">{{ title() }}</div>
          @if (badge()) {
            <span
              class="agy-bridge-pill"
              [class.agy-locked]="badgeTone() === 'warn'"
              [attr.title]="badgeTitle() || badge()"
              >{{ badge() }}</span
            >
          }
        </div>
        @if (sub()) {
          <div class="agy-sub tw-truncate">{{ sub() }}</div>
        }
      </div>

      <div class="agy-right">
        <ng-content select="[slot=actions]"></ng-content>
      </div>
    </header>
  `,
})
export class LpPopupHeaderComponent {
  protected readonly i18n = inject(I18nService);

  readonly title = input.required<string>();
  readonly sub = input<string>("");
  readonly back = input(false);
  /** 首屏（列表/解锁）用品牌块代替返回键。 */
  readonly avatar = input(false);
  /** 可选实时状态胶囊（例如桌面原生消息联动状态）。 */
  readonly badge = input<string>("");
  readonly badgeTone = input<"ok" | "warn">("ok");
  readonly badgeTitle = input<string>("");

  readonly backTriggered = output<void>();
}
