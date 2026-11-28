import { ChangeDetectionStrategy, Component } from "@angular/core";

import { GoogleAuthImportComponent } from "@localpass/angular/tools/import-google-auth";

/** 桌面端入口：使用桌面页头，返回导入来源页，完成后回到保险库。 */
@Component({
  selector: "google-auth-import-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleAuthImportComponent],
  template: ` <lp-google-auth-import backRoute="/import" doneRoute="/vault" /> `,
})
export class GoogleAuthImportDesktopV2Component {}
