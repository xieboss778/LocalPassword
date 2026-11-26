import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { LocalPassLogo } from "@localpass/assets/svg";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { SvgModule } from "@localpass/components";

/**
 * 关于：版本、隐私、许可证与源码地址。链接只在用户点击时才交给系统浏览器。
 */
@Component({
  selector: "about-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [JslibModule, SvgModule, LpGroupComponent, LpPopupHeaderComponent, LpRowComponent],
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
          class="tw-flex tw-items-center tw-gap-4 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4"
        >
          <bit-svg
            class="tw-size-12 tw-flex-none"
            [content]="logo"
            [ariaLabel]="i18n.t('appLogoLabel')"
          ></bit-svg>
          <div class="tw-min-w-0">
            <div class="tw-text-lg tw-font-semibold tw-text-main">LocalPass</div>
            <div class="tw-text-sm tw-text-muted">{{ i18n.t("appVersion") }} {{ version() }}</div>
          </div>
        </div>

        <lp-group [label]="i18n.t('about')">
          <lp-row
            icon="bwi-shield"
            [label]="i18n.t('privacy')"
            [value]="i18n.t('privacySummary')"
            [clickable]="false"
          ></lp-row>
          <lp-row
            icon="bwi-file-text"
            [label]="i18n.t('license')"
            [value]="i18n.t('licenseGpl')"
            [clickable]="false"
          ></lp-row>
          <lp-row
            icon="bwi-external-link"
            [label]="i18n.t('sourceCode')"
            [value]="sourceUrl"
            [clickable]="true"
            (activated)="openSource()"
          ></lp-row>
        </lp-group>

        <p class="tw-px-0.5 tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ i18n.t("aboutOfflineNotice") }}
        </p>
      </div>
    </div>
  `,
})
export class AboutV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly router = inject(Router);

  protected readonly logo = LocalPassLogo;
  protected readonly sourceUrl = "github.com/xieboss778/LocalPass";
  protected readonly version = signal("");

  async ngOnInit(): Promise<void> {
    this.version.set(await this.platformUtilsService.getApplicationVersion());
  }

  protected openSource(): void {
    this.platformUtilsService.launchUri("https://github.com/xieboss778/LocalPass");
  }

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }
}
