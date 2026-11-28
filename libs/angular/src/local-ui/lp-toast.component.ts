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
      class="tw-pointer-events-none tw-fixed tw-bottom-16 tw-left-1/2 tw-z-50 tw-inline-flex tw-max-w-[calc(100vw-24px)] -tw-translate-x-1/2 tw-items-center tw-gap-2 tw-rounded-full tw-bg-bg-contrast tw-px-3.5 tw-py-2 tw-text-xs tw-text-fg-contrast tw-opacity-0 tw-shadow-lg tw-transition-all"
      [class.tw-opacity-100]="toast.message() !== null"
      [class.tw-translate-y-2]="toast.message() === null"
      role="status"
      aria-live="polite"
    >
      @if (toast.message(); as message) {
        <bit-icon name="bwi-check" class="tw-flex-none tw-text-fg-success"></bit-icon>
        <span class="tw-truncate">{{ message }}</span>
        @if (toast.countdown(); as seconds) {
          <span class="tw-flex-none tw-font-mono tw-text-[11px] tw-opacity-80">{{ seconds }}s</span>
        }
        @if (toast.action(); as action) {
          <button
            type="button"
            class="tw-pointer-events-auto tw-flex-none tw-cursor-pointer tw-rounded-full tw-border-0 tw-bg-transparent tw-px-1.5 tw-py-0.5 tw-text-xs tw-font-semibold tw-text-fg-contrast tw-underline"
            (click)="toast.invokeAction()"
          >
            {{ action.label }}
          </button>
        }
      }
    </div>
  `,
})
export class LpToastComponent {
  protected readonly toast = inject(LpToastService);
}
