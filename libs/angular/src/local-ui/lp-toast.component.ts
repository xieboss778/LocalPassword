import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { IconComponent } from "@localpass/components";

import { LpToastService } from "./lp-toast.service";

/** 挂在应用外壳上的复制回执浮层。 */
@Component({
  selector: "lp-toast",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      class="tw-pointer-events-none tw-fixed tw-bottom-20 tw-left-1/2 tw-z-50 tw-inline-flex -tw-translate-x-1/2 tw-items-center tw-gap-2 tw-rounded-full tw-bg-bg-contrast tw-px-4 tw-py-2 tw-text-sm tw-text-fg-contrast tw-opacity-0 tw-shadow-lg tw-transition-all"
      [class.tw-opacity-100]="toast.message() !== null"
      [class.tw-translate-y-2]="toast.message() === null"
      role="status"
    >
      @if (toast.message(); as message) {
        <bit-icon name="bwi-check" class="tw-text-fg-success"></bit-icon>
        <span>{{ message }}</span>
      }
    </div>
  `,
})
export class LpToastComponent {
  protected readonly toast = inject(LpToastService);
}
