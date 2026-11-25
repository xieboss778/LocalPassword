import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterModule, Router } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

/**
 * 数据与安全（方向 C）。
 *
 * 这一页只说事实：数据文件在哪、备份文件是什么、导入导出走哪个页面。
 * 不做「一键清空」这种没有第二道确认就不该出现的入口。
 */
@Component({
  selector: "data-safety-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header
        [title]="i18n.t('dataAndSafety')"
        [sub]="i18n.t('dataAndSafetySubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group [label]="i18n.t('localData')">
          <lp-row
            emoji="📄"
            [label]="i18n.t('dataFile')"
            [value]="'data.json'"
            [clickable]="false"
          />
          <lp-row
            emoji="🗂️"
            [label]="i18n.t('dataFileBackup')"
            [value]="'data.json.bak'"
            [clickable]="false"
          />
          <lp-row
            emoji="🔕"
            [label]="i18n.t('dataNetworkFree')"
            [value]="i18n.t('enabled')"
            [clickable]="false"
          />
        </lp-group>

        <lp-group [label]="i18n.t('dataMove')">
          <lp-row
            emoji="⤓"
            [label]="i18n.t('exportData')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/export')"
          />
          <lp-row
            emoji="⤒"
            [label]="i18n.t('importData')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/import')"
          />
        </lp-group>

        <lp-group [label]="i18n.t('trash')">
          <lp-row
            emoji="🗑️"
            [label]="i18n.t('trash')"
            [value]="i18n.t('trashHint')"
            [chevron]="true"
            [clickable]="true"
            (activated)="go('/trash')"
          />
        </lp-group>

        <p class="tw-px-4 tw-pt-3 tw-text-[10.5px] tw-leading-relaxed tw-text-[var(--lp-ink-3)]">
          {{ i18n.t("dataFileWarning") }}
        </p>
      </div>
    </div>
  `,
})
export class DataSafetyV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }
}
