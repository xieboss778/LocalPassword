import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import { LpPopupHeaderComponent } from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { IconModule, LocalPassIcon } from "@localpass/components";

interface FactRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly value: string;
}

interface LinkRow {
  readonly icon: LocalPassIcon;
  readonly labelKey: string;
  readonly subKey: string;
  readonly route: string;
}

const FACTS: readonly FactRow[] = [
  { icon: "bwi-file", labelKey: "dataFile", value: "data.json" },
  { icon: "bwi-files", labelKey: "dataFileBackup", value: "data.json.bak" },
  { icon: "bwi-lock", labelKey: "dataNetworkFree", value: "enabled" },
];

const LINKS: readonly LinkRow[] = [
  {
    icon: "bwi-download",
    labelKey: "exportData",
    subKey: "exportSettingsDesc",
    route: "/export",
  },
  {
    icon: "bwi-import",
    labelKey: "importData",
    subKey: "importSettingsDesc",
    route: "/import-source-v2",
  },
  {
    icon: "bwi-trash",
    labelKey: "trash",
    subKey: "trashHint",
    route: "/trash",
  },
];

/**
 * 数据与安全（弹窗）。
 *
 * 这一页只说事实：数据文件在哪、备份文件是什么、导入导出走哪个页面。
 * 不做「一键清空」这种没有第二道确认就不该出现的入口。
 */
@Component({
  selector: "data-safety-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpPopupHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      <lp-popup-header
        [title]="i18n.t('dataAndSafety')"
        [sub]="i18n.t('dataAndSafetySubtitle')"
        [back]="true"
        (backTriggered)="back()"
      ></lp-popup-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-6">
        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("localData") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            @for (fact of facts; track fact.labelKey) {
              <div
                class="tw-flex tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 last:tw-border-b-0"
              >
                <span
                  class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
                >
                  <bit-icon [name]="fact.icon" class="tw-text-base"></bit-icon>
                </span>
                <span class="tw-min-w-0 tw-flex-1 tw-text-sm tw-text-main">{{
                  i18n.t(fact.labelKey)
                }}</span>
                <span class="tw-max-w-40 tw-truncate tw-font-mono tw-text-xs tw-text-muted">{{
                  fact.labelKey === "dataNetworkFree" ? i18n.t("enabled") : fact.value
                }}</span>
              </div>
            }
          </div>
        </section>

        <section class="tw-pb-2">
          <h2 class="tw-m-0 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("dataMove") }}
          </h2>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            @for (row of links; track row.labelKey) {
              <button
                type="button"
                class="tw-flex tw-w-full tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 tw-text-start last:tw-border-b-0 hover:tw-bg-background-alt"
                (click)="go(row.route)"
              >
                <span
                  class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
                >
                  <bit-icon [name]="row.icon" class="tw-text-base"></bit-icon>
                </span>
                <span class="tw-min-w-0 tw-flex-1">
                  <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                    i18n.t(row.labelKey)
                  }}</span>
                  <span class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">{{
                    i18n.t(row.subKey)
                  }}</span>
                </span>
                <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
              </button>
            }
          </div>
        </section>

        <p class="tw-px-2.5 tw-pt-2 tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ i18n.t("dataFileWarning") }}
        </p>
      </div>
    </div>
  `,
})
export class DataSafetyV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly facts = FACTS;
  protected readonly links = LINKS;

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }
}
