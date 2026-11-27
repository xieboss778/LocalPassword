import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { CollectionService } from "@localpass/admin-console/common";
import { JslibModule } from "@localpass/angular/jslib.module";
import { LpPageHeaderComponent } from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ImportShellProgressComponent, importShellProviders } from "@localpass/importer-ui";

/**
 * 完整导入流程的外壳：V2 页头 + 步骤进度 + 子路由。
 *
 * 桌面端入口在 `/import`，选择器与预览在 `/import/all` 下，页面结构与弹窗流程保持一致。
 */
@Component({
  templateUrl: "import-shell-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, LpPageHeaderComponent, ImportShellProgressComponent, RouterOutlet],
  providers: importShellProviders(CollectionService),
})
export class ImportShellDesktopComponent {
  protected readonly i18n = inject(I18nService);
}
