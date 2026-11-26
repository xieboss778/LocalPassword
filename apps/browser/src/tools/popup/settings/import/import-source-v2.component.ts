import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpRowComponent,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { importOptions } from "@localpass/importer-core";
import { pickerVendorFor } from "@localpass/importer-ui";

/**
 * 导入来源选择（方向 C）。
 *
 * 列表来自 `importer-core` 的 `importOptions`——也就是真正的导入器清单，不是手抄的一份名单：
 * 新增一个导入器，这一屏自动多一行。点一行进对应的导入流程。
 */
@Component({
  selector: "import-source-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('importData')"
          [sub]="i18n.t('importSourceSubtitle')"
          [back]="true"
          (backTriggered)="goBack()"
        ></lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('importData')"
          [sub]="i18n.t('importSourceSubtitle')"
        ></lp-page-header>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <lp-group [label]="i18n.t('importFeatured')">
          @for (option of featured(); track option.id) {
            <lp-row
              icon="bwi-star-filled"
              [label]="option.name"
              [value]="option.isBrowser ? i18n.t('importFromBrowser') : ''"
              [chevron]="true"
              [clickable]="true"
              (activated)="pick(option.id)"
            />
          }
        </lp-group>

        <lp-group [label]="i18n.t('importAllSources')">
          @for (option of others(); track option.id) {
            <lp-row
              icon="bwi-import"
              [label]="option.name"
              [value]="option.isBrowser ? i18n.t('importFromBrowser') : ''"
              [chevron]="true"
              [clickable]="true"
              (activated)="pick(option.id)"
            />
          }
        </lp-group>

        <div class="tw-flex tw-flex-col tw-gap-2 tw-px-3 tw-pt-3">
          <button type="button" bitButton buttonType="secondary" (click)="pickGoogleAuth()">
            {{ i18n.t("importGoogleAuth") }}
          </button>
        </div>

        <p class="tw-px-4 tw-pt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
          {{ i18n.t("importSourceHint") }}
        </p>
      </div>
    </div>
  `,
})
export class ImportSourceV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  private readonly options = computed(() => importOptions);

  protected readonly featured = computed(() => {
    const featured = this.options().filter((option) => option.featuredImporter);
    return featured.length > 0 ? featured : this.options().slice(0, 4);
  });

  protected readonly others = computed(() => {
    const featuredIds = new Set(this.featured().map((option) => option.id));
    return this.options()
      .filter((option) => !featuredIds.has(option.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected pick(id: string): void {
    // 清单按格式列出（LocalPass json/csv），导入控件只接受厂商 id；先把格式归到厂商。
    const vendor = pickerVendorFor(id) ?? id;
    void this.router.navigate(["/import-source-select", vendor]);
  }

  protected pickGoogleAuth(): void {
    void this.router.navigate(["/import-google-auth"]);
  }

  protected goBack(): void {
    const next = this.route.snapshot.queryParamMap.get("next");
    void this.router.navigateByUrl(next ?? "/tabs/settings");
  }
}
