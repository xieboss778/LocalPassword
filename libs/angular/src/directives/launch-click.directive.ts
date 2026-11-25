import { Directive, HostListener, Input } from "@angular/core";

import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { Utils } from "@localpass/common/platform/misc/utils";

@Directive({
  selector: "[appLaunchClick]",
})
export class LaunchClickDirective {
  constructor(private platformUtilsService: PlatformUtilsService) {}

  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input("appLaunchClick") uriToLaunch = "";

  @HostListener("click") onClick() {
    if (!Utils.isNullOrWhitespace(this.uriToLaunch)) {
      this.platformUtilsService.launchUri(this.uriToLaunch);
    }
  }
}
