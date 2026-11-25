import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { LocalPassLogo, LocalPassLogoBeta } from "@localpass/assets/svg";
import { flagEnabled } from "@localpass/common/platform/misc/flags";
import { BitIconButtonComponent, SvgComponent, TypographyModule } from "@localpass/components";
import { I18nPipe } from "@localpass/ui-common";

/**
 * Draggable header for the passkey modal window. Mirrors the browser extension's `popup-header`.
 */
@Component({
  selector: "app-fido2-modal-header",
  templateUrl: "fido2-modal-header.component.html",
  imports: [BitIconButtonComponent, I18nPipe, SvgComponent, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2ModalHeaderComponent {
  readonly pageTitle = input.required<string>();
  readonly closeModal = output<void>();

  protected readonly logo = flagEnabled("prereleaseBuild") ? LocalPassLogoBeta : LocalPassLogo;
}
