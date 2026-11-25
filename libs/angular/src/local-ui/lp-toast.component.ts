import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { LpToastService } from "./lp-toast.service";

/** 挂在应用外壳上的复制回执浮层。 */
@Component({
  selector: "lp-toast",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="tw-pointer-events-none tw-fixed tw-bottom-6 tw-left-1/2 tw-z-50 tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-[#11151c] tw-px-3.5 tw-py-2.5 tw-text-[12px] tw-text-[#f4f6fa] tw-opacity-0 tw-shadow-[0_10px_26px_#1013183d] tw-transition-all"
      [class.tw-opacity-100]="toast.message() !== null"
      [class.-tw-translate-x-1/2]="true"
      [class.tw-translate-y-2]="toast.message() === null"
      role="status"
    >
      @if (toast.message(); as message) {
        <span aria-hidden="true">✓</span><span>{{ message }}</span>
      }
    </div>
  `,
})
export class LpToastComponent {
  protected readonly toast = inject(LpToastService);
}
