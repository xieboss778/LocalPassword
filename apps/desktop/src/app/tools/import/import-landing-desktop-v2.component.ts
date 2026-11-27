import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { Router } from "@angular/router";

import { LpPageHeaderComponent, LpToastService } from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ButtonModule, IconModule, IconTileComponent, LocalPassIcon } from "@localpass/components";
import { ImportPreviewStagingService } from "@localpass/importer-ui";

interface ImportSourceCard {
  readonly icon: LocalPassIcon;
  readonly variant: "brand" | "warning" | "gray";
  readonly labelKey: string;
  readonly descKey: string;
  /** File cards open a picker and preview the chosen file; route cards go to the full picker. */
  readonly action: "file" | "route";
  readonly route?: string;
}

/**
 * 桌面端导入入口：三张常用来源卡片 + 文件区。
 *
 * 文件卡片和拖放区把选中的文件交给预览页，确认后才写入；其余格式仍交给
 * `@localpass/importer` 的完整选择器（`/import/all`），不复制导入逻辑。
 */
@Component({
  selector: "import-landing-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [ButtonModule, IconModule, IconTileComponent, LpPageHeaderComponent],
  template: `
    <input
      #importFile
      type="file"
      accept=".json,application/json"
      class="tw-hidden"
      [attr.aria-label]="i18n.t('importLocalPassBackup')"
      (change)="onFileSelected($event)"
    />

    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('importNoun')" [sub]="i18n.t('importSubtitle')">
        <button
          type="button"
          bitButton
          buttonType="secondary"
          startIcon="bwi-import"
          data-testid="import_all_sources"
          (click)="openPicker()"
        >
          {{ i18n.t("importMoreSources") }}
        </button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        <div class="tw-flex tw-items-start tw-gap-4">
          <div
            class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
              {{ i18n.t("importPanelSourcesSelect") }}
            </h2>
            <p class="tw-mb-0 tw-mt-1 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("importSourcesSubtitle") }}
            </p>
            <div class="tw-mt-3 tw-flex tw-flex-col tw-gap-2">
              @for (source of sources; track source.labelKey) {
                <button
                  type="button"
                  class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start hover:tw-bg-background-alt"
                  data-testid="import_source_card"
                  (click)="openSource(source)"
                >
                  <bit-icon-tile
                    [icon]="source.icon"
                    [variant]="source.variant"
                    size="lg"
                  ></bit-icon-tile>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                      i18n.t(source.labelKey)
                    }}</span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      i18n.t(source.descKey)
                    }}</span>
                  </span>
                  <bit-icon name="bwi-angle-right" class="tw-text-muted"></bit-icon>
                </button>
              }
            </div>
          </div>

          <div
            class="tw-w-5/12 tw-flex-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
              {{ i18n.t("importPanelFile") }}
            </h2>
            <p class="tw-mb-0 tw-mt-1 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("importFileNote") }}
            </p>
            <button
              type="button"
              class="tw-mt-3 tw-flex tw-w-full tw-flex-col tw-items-center tw-gap-1.5 tw-rounded-xl tw-border tw-border-dashed tw-border-border-base tw-bg-background-alt tw-px-4 tw-py-8 tw-text-center hover:tw-bg-bg-brand-softer"
              [class.tw-border-border-brand]="dragging()"
              [class.tw-bg-bg-brand-softer]="dragging()"
              data-testid="import_drop_zone"
              (click)="pickFile()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave()"
              (drop)="onDrop($event)"
            >
              <bit-icon name="bwi-upload" class="tw-text-2xl tw-text-fg-brand"></bit-icon>
              <span class="tw-text-sm tw-font-medium tw-text-main">{{
                i18n.t("importDropTitle")
              }}</span>
              <span class="tw-text-xs tw-text-muted">{{ i18n.t("importDropHintShort") }}</span>
            </button>
            <p class="tw-mb-0 tw-mt-3 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("importPreviewNote") }}
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ImportLandingDesktopV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly staging = inject(ImportPreviewStagingService);
  private readonly toast = inject(LpToastService);
  private readonly importFile = viewChild<ElementRef<HTMLInputElement>>("importFile");

  protected readonly dragging = signal(false);

  protected readonly sources: readonly ImportSourceCard[] = [
    {
      icon: "bwi-note",
      variant: "gray",
      labelKey: "importLocalPassBackup",
      descKey: "importLocalPassBackupDesc",
      action: "file",
    },
    {
      icon: "bwi-login",
      variant: "brand",
      labelKey: "importBitwardenExport",
      descKey: "importBitwardenExportDesc",
      action: "file",
    },
    {
      icon: "bwi-key",
      variant: "warning",
      labelKey: "importGoogleAuth",
      descKey: "importGoogleAuthDesc",
      action: "route",
      route: "/import/all",
    },
  ];

  protected openSource(source: ImportSourceCard): void {
    if (source.action === "file") {
      this.pickFile();
      return;
    }
    if (source.route) {
      void this.router.navigateByUrl(source.route);
    }
  }

  protected pickFile(): void {
    this.importFile()?.nativeElement.click();
  }

  protected openPicker(): void {
    void this.router.navigateByUrl("/import/all");
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) {
      await this.preview(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(): void {
    this.dragging.set(false);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await this.preview(file);
    }
  }

  /** Hands the file to the preview page; the contents stay in memory and are consumed there. */
  private async preview(file: File): Promise<void> {
    try {
      this.staging.set({
        importType: "localpassjson",
        fileName: file.name,
        contents: await file.text(),
      });
      await this.router.navigateByUrl("/import-preview");
    } catch {
      this.toast.show(this.i18n.t("errorOccurred"));
    }
  }
}
