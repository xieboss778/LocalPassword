import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

/**
 * The offline-only reassurance line shown under the desktop unlock card, as on the design.
 *
 * It sits outside the card, so it is routed through the anonymous layout's secondary outlet
 * instead of living inside the lock form.
 */
@Component({
  selector: "unlock-offline-footnote",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="tw-m-0 tw-text-center tw-text-xs tw-leading-relaxed tw-text-muted">
      {{ i18n.t("unlockOfflineFootnote") }}
    </p>
  `,
})
export class UnlockOfflineFootnoteComponent {
  protected readonly i18n = inject(I18nService);
}
