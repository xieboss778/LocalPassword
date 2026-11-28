import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { GoogleAuthImportComponent } from "@localpass/angular/tools/import-google-auth";

import { BrowserApi } from "../../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";

/** 扩展弹窗入口：紧凑头部，支持截取当前标签页二维码，返回来源列表，完成后回到保险库标签页。 */
@Component({
  selector: "google-auth-import-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [GoogleAuthImportComponent],
  template: `
    <lp-google-auth-import
      [compact]="true"
      [backRoute]="backRoute"
      doneRoute="/tabs/vault"
      [captureTabQr]="captureTab"
    />
  `,
})
export class GoogleAuthImportV2Component {
  private readonly route = inject(ActivatedRoute);
  protected readonly backRoute = this.route.snapshot.queryParamMap.get("next")
    ? `/import-source-v2?next=${encodeURIComponent(this.route.snapshot.queryParamMap.get("next") ?? "")}`
    : "/import-source-v2";

  protected readonly captureTab: (() => Promise<string | null>) | null =
    !BrowserPopupUtils.inPopout(window)
      ? async () => {
          const screenshot = await BrowserApi.captureVisibleTab();
          if (!screenshot) {
            return null;
          }
          const { default: qrcodeParser } = await import("qrcode-parser");
          const decoded = await qrcodeParser(screenshot);
          return typeof decoded === "string" ? decoded : null;
        }
      : null;
}
