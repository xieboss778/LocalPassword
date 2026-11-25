import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";

import { ButtonModule, DIALOG_DATA, DialogModule } from "@localpass/components";
import { I18nPipe } from "@localpass/ui-common";

import { TotpQrComponent } from "../../components/totp-qr/totp-qr.component";

export interface TotpQrDialogParams {
  /** The `otpauth://` uri to encode. */
  readonly uri: string;
  /** Shown as the dialog title; usually the item name. */
  readonly label: string;
}

/** Shows the TOTP seed of a login as a QR code, so it can be scanned into an authenticator. */
@Component({
  selector: "vault-totp-qr-dialog",
  template: `
    <bit-dialog>
      <span bitDialogTitle>{{ params.label }}</span>
      <div bitDialogContent class="tw-flex tw-flex-col tw-items-center tw-gap-3">
        <vault-totp-qr [value]="params.uri" [size]="220" [ariaLabel]="params.label" />
        <code class="tw-text-xs tw-break-all">{{ params.uri }}</code>
      </div>
      <div bitDialogFooter>
        <button type="button" bitButton bitDialogClose>{{ "close" | i18n }}</button>
      </div>
    </bit-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, TotpQrComponent, I18nPipe],
})
export class TotpQrDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected readonly params: TotpQrDialogParams) {}
}
