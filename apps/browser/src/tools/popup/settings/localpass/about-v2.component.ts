import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@localpass/components";

import { BrowserApi } from "../../../../platform/browser/browser-api";

/**
 * 关于：版本、隐私、许可证与源码地址。链接只在用户点击时才交给系统浏览器。
 */
@Component({
  selector: "about-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [JslibModule, LpGroupComponent, LpPopupHeaderComponent, LpRowComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('about')"
        [sub]="i18n.t('appName')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        <div
          class="tw-flex tw-flex-col tw-items-center tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 tw-text-center"
        >
          <img [src]="logoUrl" alt="" class="tw-size-14 tw-rounded-xl" aria-hidden="true" />
          <div class="tw-pt-3 tw-text-xl tw-font-semibold tw-text-main">LocalPass</div>
          <div class="tw-pt-0.5 tw-text-xs tw-text-muted">
            {{ i18n.t("appVersion") }} {{ version() }}
          </div>
          <p class="tw-m-0 tw-pt-2 tw-text-xs tw-leading-relaxed tw-text-muted">
            {{ i18n.t("aboutDescription") }}
          </p>
        </div>

        <lp-group class="tw-pt-3">
          <lp-row
            icon="bwi-shield"
            [label]="i18n.t('privacy')"
            [sub]="i18n.t('privacySummary')"
            [chevron]="true"
            [clickable]="true"
            (activated)="showPrivacy()"
          ></lp-row>
          <lp-row
            icon="bwi-file-text"
            [label]="i18n.t('license')"
            [sub]="i18n.t('licenseGpl')"
            [chevron]="true"
            [clickable]="true"
            (activated)="showLicense()"
          ></lp-row>
          <lp-row
            icon="bwi-external-link"
            [label]="i18n.t('sourceCode')"
            [sub]="sourceUrl"
            [chevron]="true"
            [clickable]="true"
            (activated)="openSource()"
          ></lp-row>
        </lp-group>
      </div>
    </div>
  `,
})
export class AboutV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly sourceUrl = "github.com/xieboss778/LocalPass";
  protected readonly logoUrl = BrowserApi.getRuntimeURL("images/icon128.png");
  protected readonly version = signal("");

  async ngOnInit(): Promise<void> {
    this.version.set(await this.platformUtilsService.getApplicationVersion());
  }

  protected openSource(): void {
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass");
  }

  protected showPrivacy(): void {
    void this.dialogService.openSimpleDialog({
      title: { key: "privacy" },
      content: this.i18n.t("aboutOfflineNotice"),
      acceptButtonText: { key: "ok" },
      type: "info",
    });
  }

  protected showLicense(): void {
    void this.dialogService.openSimpleDialog({
      title: { key: "license" },
      content: this.i18n.t("licenseGpl"),
      acceptButtonText: { key: "ok" },
      type: "info",
    });
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }
}
