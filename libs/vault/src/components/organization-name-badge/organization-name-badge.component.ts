// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnChanges } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import { Unassigned } from "@localpass/common/admin-console/models/collections";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ChipActionComponent } from "@localpass/components";
import { OrganizationId } from "@localpass/sdk-internal";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-badge",
  templateUrl: "organization-name-badge.component.html",
  imports: [RouterModule, JslibModule, ChipActionComponent],
})
export class OrganizationNameBadgeComponent implements OnChanges {
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizationId?: OrganizationId | string;
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizationName: string;
  // FIXME(https://localpass.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled: boolean;

  // Need a separate variable or we get weird behavior when used as part of cdk virtual scrolling
  name: string;
  color: string;
  textColor: string;
  isMe: boolean;

  constructor(private i18nService: I18nService) {}

  // ngOnChanges is required since this component might be reused as part of
  // cdk virtual scrolling
  ngOnChanges() {
    if (this.organizationName == null || this.organizationName === "") {
      this.name = this.i18nService.t("me");
    } else {
      this.name = this.organizationName;
    }
  }

  get organizationIdLink() {
    return this.organizationId ?? Unassigned;
  }
}
