import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import {
  ImportStagingServiceAbstraction,
  ImportUpgradeMetadataServiceAbstraction,
} from "@localpass/importer-core";
import {
  IMPORT_DESTINATION_SEGMENT,
  ImportControlsComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
  navigateCarryingImportParams,
  SYSTEM_SERVICE_PROVIDER,
} from "@localpass/importer-ui";
import { safeProvider } from "@localpass/ui-common";
import { vaultCommandsAfterImport } from "@localpass/vault";

import { DesktopImportUpgradeMetadataService } from "./desktop-import-upgrade-metadata.service";

@Component({
  templateUrl: "import-controls-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportControlsComponent],
  providers: [
    ...ImportUpgradeProviders,
    safeProvider({
      provide: ImportUpgradeMetadataServiceAbstraction,
      useClass: DesktopImportUpgradeMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER, I18nService],
    }),
  ],
})
export class ImportControlsDesktopComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stagingService = inject(ImportStagingServiceAbstraction);

  protected readonly importType = importTypeFromRoute(this.route);

  protected onBack(): void {
    void navigateCarryingImportParams(this.router, this.route, ["/import"], {
      queryParams: { source: this.importType() },
    });
  }

  protected onContinue(): void {
    // Staged items mean the user still has to pick where they go.
    if (this.stagingService.current() != null) {
      void navigateCarryingImportParams(this.router, this.route, [
        "/import",
        this.importType(),
        IMPORT_DESTINATION_SEGMENT,
      ]);
      return;
    }
    void this.router.navigate(vaultCommandsAfterImport(this.route));
  }
}
