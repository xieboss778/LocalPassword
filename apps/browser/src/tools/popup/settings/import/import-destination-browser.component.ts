import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule } from "@localpass/components";
import { ImportStagingServiceAbstraction, StagedImport } from "@localpass/importer-core";
import {
  ImportDestinationComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
} from "@localpass/importer-ui";

import {
  IMPORT_CONFIRMATION_ROUTE_PATH,
  ImportConfirmationStateService,
} from "./import-confirmation-state.service";

@Component({
  templateUrl: "import-destination-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportDestinationComponent, IconModule],
  providers: [...ImportUpgradeProviders],
})
export class ImportDestinationBrowserComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmationState = inject(ImportConfirmationStateService);
  private readonly stagingService = inject(ImportStagingServiceAbstraction);

  protected readonly i18n = inject(I18nService);
  protected readonly importType = importTypeFromRoute(this.route);

  // A refresh or deep link lands here with nothing staged, so there is nothing to place.
  protected readonly staged = this.stagingService.current();
  protected readonly hasStagedItems = this.staged != null;
  protected readonly importCount = countOf(this.staged);
  protected readonly unrecognizedCount =
    this.staged?.kind === "parsed" ? this.staged.result.errors.length : 0;

  constructor() {
    if (!this.hasStagedItems) {
      void this.router.navigate(["/import-source-select"]);
    }
  }

  // The start of credential parsing, not a page within it.
  protected onBack(): void {
    void this.router.navigate(["/import-source-select", this.importType()]);
  }

  protected onContinue(): void {
    // A finished import left its result for the confirmation page, unless items were skipped.
    void this.router.navigate([
      this.confirmationState.current() != null
        ? `/${IMPORT_CONFIRMATION_ROUTE_PATH}`
        : "/tabs/vault",
    ]);
  }
}

/** 已解析的条目数；SDK 边解析边写入时无法提前给出总数。 */
function countOf(staged: StagedImport | undefined): number | null {
  if (staged == null) {
    return null;
  }
  if (staged.kind === "parsed") {
    return staged.result.ciphers.length;
  }
  if (staged.kind === "file") {
    return staged.itemTypeCounts
      ? Object.values(staged.itemTypeCounts).reduce((total, count) => total + (count ?? 0), 0)
      : null;
  }
  return null;
}
