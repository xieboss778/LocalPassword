import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { LocalPassMark } from "@localpass/assets/svg";
import { IconComponent, LocalPassIcon, SvgModule } from "@localpass/components";

/**
 * 弹窗首屏的居中主视觉：一枚品牌图标 + 标题 + 一句说明。
 * 解锁、创建保险库、安全密钥这几页在原型里共用同一套版式。
 */
@Component({
  selector: "lp-hero",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SvgModule],
  template: `
    <div class="tw-px-5 tw-pt-6 tw-pb-1 tw-text-center">
      <span
        class="tw-mx-auto tw-mb-3 tw-grid tw-size-16 tw-place-items-center tw-rounded-2xl tw-bg-bg-brand-softer tw-text-fg-brand"
      >
        @if (brandMark()) {
          <bit-svg class="tw-size-9" [content]="logoMark"></bit-svg>
        } @else {
          <bit-icon [name]="icon()" class="tw-text-3xl"></bit-icon>
        }
      </span>
      <h2 class="tw-m-0 tw-text-lg tw-font-semibold tw-text-main">{{ title() }}</h2>
      @if (text()) {
        <p class="tw-mx-auto tw-mt-1 tw-max-w-72 tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ text() }}
        </p>
      }
      <div class="empty:tw-hidden tw-mt-4"><ng-content /></div>
    </div>
  `,
})
export class LpHeroComponent {
  readonly icon = input.required<LocalPassIcon>();
  readonly title = input.required<string>();
  readonly text = input<string>("");

  /** 原型里品牌主视觉用 LP 单色标，其余页面仍用图标字体的功能图标。 */
  protected readonly logoMark = LocalPassMark;
  protected readonly brandMark = computed(() => this.icon() === "bwi-localpass-shield");
}
