import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import {
  DefaultImportUpgradeMetadataService,
  ImportStagingServiceAbstraction,
  ImportUpgradeMetadataServiceAbstraction,
} from "@localpass/importer-core";
import {
  IMPORT_DESTINATION_SEGMENT,
  ImportControlsComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
  SYSTEM_SERVICE_PROVIDER,
} from "@localpass/importer-ui";
import { safeProvider } from "@localpass/ui-common";

import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";

import { ImportConfirmationPopupService } from "./import-confirmation-popup.service";
import {
  IMPORT_CONFIRMATION_ROUTE_PATH,
  ImportConfirmationStateService,
} from "./import-confirmation-state.service";

@Component({
  templateUrl: "import-controls-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportControlsComponent],
  providers: [
    ...ImportUpgradeProviders,
    safeProvider({
      provide: ImportUpgradeMetadataServiceAbstraction,
      useClass: DefaultImportUpgradeMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
  ],
})
export class ImportControlsBrowserComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stagingService = inject(ImportStagingServiceAbstraction);
  private readonly confirmationState = inject(ImportConfirmationStateService);
  private readonly confirmationPopup = inject(ImportConfirmationPopupService);
  private readonly accountService = inject(AccountService);

  protected readonly importType = importTypeFromRoute(this.route);

  protected onBack(): void {
    void this.router.navigate(["/import-source-select"], {
      queryParams: { source: this.importType() },
    });
  }

  protected async onContinue(): Promise<void> {
    // Staged items mean the user still has to pick where they go.
    if (this.stagingService.current() != null) {
      void this.router.navigate([
        "/import-source-select",
        this.importType(),
        IMPORT_DESTINATION_SEGMENT,
      ]);
      return;
    }
    const finished = this.confirmationState.current() != null;
    // The confirmation page exists to bring the toolbar popup forward from an extension tab. Inside
    // the popup that page has nothing to open, so show the result dialog here instead.
    if (finished && BrowserPopupUtils.inPopup(window)) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.confirmationPopup.conditionallyOpen(userId);
      void this.router.navigate(["/tabs/vault"]);
      return;
    }
    // A finished import left its result for the confirmation page, unless items were skipped.
    void this.router.navigate([finished ? `/${IMPORT_CONFIRMATION_ROUTE_PATH}` : "/tabs/vault"]);
  }
}
