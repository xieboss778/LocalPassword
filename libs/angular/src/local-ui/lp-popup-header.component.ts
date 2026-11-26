import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";

/**
 * 弹窗页头：返回键 + 标题/副标题 + 右侧动作。
 *
 * 与桌面端的 `lp-page-header` 分开，是因为 380px 宽度下标题、返回键和动作要更紧凑，
 * 且弹窗页头必须固定在滚动区外，不能跟着内容滚走。
 */
@Component({
  selector: "lp-popup-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconModule],
  host: { class: "tw-block tw-flex-none" },
  template: `
    <header class="tw-flex tw-items-start tw-gap-2 tw-bg-background tw-px-3.5 tw-pt-3.5 tw-pb-2.5">
      @if (back()) {
        <button
          type="button"
          class="-tw-ms-1.5 -tw-mt-0.5 tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
          [attr.aria-label]="i18n.t('back')"
          (click)="backTriggered.emit()"
        >
          <bit-icon name="bwi-angle-left" class="tw-text-lg"></bit-icon>
        </button>
      }

      <div class="tw-min-w-0 tw-flex-1">
        <h1 class="tw-m-0 tw-truncate tw-text-lg tw-font-semibold tw-leading-tight tw-text-main">
          {{ title() }}
        </h1>
        @if (sub()) {
          <p class="tw-m-0 tw-mt-0.5 tw-truncate tw-text-xs tw-leading-snug tw-text-muted">
            {{ sub() }}
          </p>
        }
      </div>

      <div class="tw-flex tw-flex-none tw-items-center tw-gap-0.5 tw-pt-0.5">
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

  readonly backTriggered = output<void>();
}
