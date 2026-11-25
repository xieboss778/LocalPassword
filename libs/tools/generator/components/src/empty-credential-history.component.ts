import { Component } from "@angular/core";

import { JslibModule } from "@localpass/angular/jslib.module";
import { NoCredentialsIcon } from "@localpass/assets/svg";
import { StatusLockupComponent, SvgComponent } from "@localpass/components";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-empty-credential-history",
  templateUrl: "empty-credential-history.component.html",
  imports: [JslibModule, StatusLockupComponent, SvgComponent],
})
export class EmptyCredentialHistoryComponent {
  noCredentialsIcon = NoCredentialsIcon;

  constructor() {}
}
