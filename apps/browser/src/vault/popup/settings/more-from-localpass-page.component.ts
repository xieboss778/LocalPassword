import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Observable, combineLatest, firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@localpass/angular/jslib.module";
import { OrganizationService } from "@localpass/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { EnvironmentService } from "@localpass/common/platform/abstractions/environment.service";
import { GovModeService } from "@localpass/common/platform/abstractions/gov-mode.service";
import { DialogService, ItemModule } from "@localpass/components";

import { FamiliesPolicyService } from "../../../billing/services/families-policy.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "more-from-localpass-page.component.html",
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
  ],
})
export class MoreFromLocalPassPageComponent {
  protected familySponsorshipAvailable$: Observable<boolean>;
  protected isFreeFamilyPolicyEnabled$: Observable<boolean>;
  protected hasSingleEnterpriseOrg$: Observable<boolean>;

  constructor(
    private dialogService: DialogService,
    private environmentService: EnvironmentService,
    private organizationService: OrganizationService,
    private familiesPolicyService: FamiliesPolicyService,
    private accountService: AccountService,
    private govModeService: GovModeService,
  ) {
    this.familySponsorshipAvailable$ = getUserId(this.accountService.activeAccount$).pipe(
      switchMap((userId) =>
        combineLatest([
          this.organizationService.familySponsorshipAvailable$(userId),
          this.govModeService.isGovMode$(userId),
        ]),
      ),
      map(([familySponsorshipAvailable, isGovMode]) => familySponsorshipAvailable && !isGovMode),
    );
    this.hasSingleEnterpriseOrg$ = this.familiesPolicyService.hasSingleEnterpriseOrg$();
    this.isFreeFamilyPolicyEnabled$ = this.familiesPolicyService.isFreeFamilyPolicyEnabled$();
  }

  async openFreeLocalPassFamiliesPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToWebApp" },
      content: { key: "freeLocalPassFamiliesPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      const env = await firstValueFrom(this.environmentService.environment$);
      const url = env.getWebVaultUrl();
      await BrowserApi.createNewTab(url + "/#/settings/sponsored-families");
    }
  }

  async openLocalPassForBusinessPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToLocalPassDotCom" },
      content: { key: "localpassForBusinessPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://local.invalid/products/business/");
    }
  }

  async openAuthenticatorPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToLocalPassDotCom" },
      content: { key: "continueToAuthenticatorPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://local.invalid/products/authenticator");
    }
  }

  async openSecretsManagerPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToLocalPassDotCom" },
      content: { key: "continueToSecretsManagerPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://local.invalid/products/secrets-manager");
    }
  }

  async openPasswordlessDotDevPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToLocalPassDotCom" },
      content: { key: "continueToPasswordlessDotDevPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://local.invalid/products/passwordless");
    }
  }
}
