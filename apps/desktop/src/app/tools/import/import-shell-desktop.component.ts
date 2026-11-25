import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { CollectionService } from "@localpass/admin-console/common";
import { ImportShellProgressComponent, importShellProviders } from "@localpass/importer-ui";

import { DesktopHeaderComponent } from "../../layout/header";

@Component({
  templateUrl: "import-shell-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DesktopHeaderComponent, ImportShellProgressComponent, RouterOutlet],
  providers: importShellProviders(CollectionService),
})
export class ImportShellDesktopComponent {}
