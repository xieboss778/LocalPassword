import { Component, inject } from "@angular/core";

import { JslibModule } from "@localpass/angular/jslib.module";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { IconComponent, LinkModule, PopoverModule } from "@localpass/components";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "show-quick-copy-actions-details-popover",
  templateUrl: "./show-quick-copy-actions-details-popover.component.html",
  imports: [IconComponent, PopoverModule, JslibModule, LinkModule],
})
export class ShowQuickCopyActionsDetailsPopoverComponent {
  private platformUtilService = inject(PlatformUtilsService);

  openLearnMore(e: Event) {
    e.preventDefault();
    this.platformUtilService.launchUri("https://github.com/xieboss778/LocalPass/tree/main/docs");
  }
}
