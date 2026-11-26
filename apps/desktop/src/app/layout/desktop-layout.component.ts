import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, RouterModule } from "@angular/router";
import { of } from "rxjs";

import { LocalPassLogo } from "@localpass/assets/svg";
import { DeviceType } from "@localpass/common/enums";
import { FeatureFlag } from "@localpass/common/enums/feature-flag.enum";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { DialogService, LayoutComponent, NavigationModule } from "@localpass/components";
import { I18nPipe } from "@localpass/ui-common";
import { VaultManageNavComponent, VaultNavSectionComponent } from "@localpass/vault";

import { VaultFilterComponent } from "../../vault/app/vault-v3/vault-filter/vault-filter.component";
import { ExportDesktopComponent } from "../tools/export/export-desktop.component";
import { CredentialGeneratorComponent } from "../tools/generator/credential-generator.component";
import { ImportDesktopComponent } from "../tools/import/import-desktop.component";
import { SendFiltersNavComponent } from "../tools/send/send-filters-nav.component";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

// FIXME(https://localpass.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-layout",
  imports: [
    RouterModule,
    I18nPipe,
    LayoutComponent,
    NavigationModule,
    DesktopSideNavComponent,
    VaultFilterComponent,
    SendFiltersNavComponent,
    VaultNavSectionComponent,
    VaultManageNavComponent,
  ],
  templateUrl: "./desktop-layout.component.html",
})
export class DesktopLayoutComponent {
  private dialogService = inject(DialogService);
  private configService = inject(ConfigService);
  private platformUtilsService = inject(PlatformUtilsService);
  private router = inject(Router);

  protected readonly logo = LocalPassLogo;

  // LocalPass: Send relays a secret through a server, so a local vault never offers it.
  protected readonly sendEnabled = toSignal(of(false), { initialValue: false });

  protected readonly vfo1Foundation = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  // TODO: remove once pm-35053-import-upgrade is retired
  // The flag's default is the literal `true`, so spell out `boolean` or the signal only accepts
  // `true` as its initial value.
  protected readonly importUpgradeEnabled = toSignal<boolean, boolean>(
    this.configService.getFeatureFlag$(FeatureFlag.ImportUpgrade),
    { initialValue: false },
  );

  protected readonly isMacOs = this.platformUtilsService.getDevice() === DeviceType.MacOsDesktop;

  protected openGenerator() {
    this.dialogService.open(CredentialGeneratorComponent);
  }

  protected async openImport() {
    if (await this.configService.getFeatureFlag(FeatureFlag.ImportUpgrade)) {
      await this.router.navigate(["/import"]);
      return;
    }
    this.dialogService.open(ImportDesktopComponent);
  }

  protected openExport() {
    this.dialogService.open(ExportDesktopComponent);
  }
}
