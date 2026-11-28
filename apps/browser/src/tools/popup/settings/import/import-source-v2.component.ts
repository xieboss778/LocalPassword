import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";

import { JslibModule } from "@localpass/angular/jslib.module";
import {
  LpKindTileComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { IconModule } from "@localpass/components";
import { readImportFileContents, UpgradeImportType } from "@localpass/importer-core";
import { ImportPreviewStagingService } from "@localpass/importer-ui";
import { ItemKind } from "@localpass/local-vault";

type ImportSourceKind = "onepassword" | "localpass" | "bitwarden" | "generic";

interface ImportSourcePlatform {
  readonly mac: boolean;
  readonly safari: boolean;
  readonly firefox: boolean;
}

/** 同一行可能接多种导出格式；扩展名 + 当前平台共同决定解析器。 */
export function resolveImportType(
  source: ImportSourceKind,
  fileName: string,
  platform: ImportSourcePlatform,
): UpgradeImportType {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  switch (source) {
    case "onepassword":
      if (extension === ".1pux") {
        return "1password1pux";
      }
      if (extension === ".1pif") {
        return "1password1pif";
      }
      return platform.mac ? "1passwordmaccsv" : "1passwordwincsv";
    case "bitwarden":
      return extension === ".csv" ? "localpasscsv" : "localpassjson";
    case "generic":
      if (platform.safari) {
        return "safaricsv";
      }
      if (platform.firefox) {
        return "firefoxcsv";
      }
      return "chromecsv";
    default:
      return "localpassjson";
  }
}

/**
 * 导入来源选择（方向 C）。
 *
 * 三张主卡片覆盖真实入口：LocalPass 加密备份与 Bitwarden 加密导出都走
 * `localpassjson`（同一个 `BitwardenPasswordProtectedImporter`，会提示输入导出密码），
 * Google 认证器走独立的扫码流程；其余导入器收在「更多来源」里，一个都不少。
 */
@Component({
  selector: "import-source-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    RouterModule,
    JslibModule,
    IconModule,
    LpKindTileComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      <input
        #backupFile
        type="file"
        accept=".json,application/json"
        class="tw-hidden"
        [attr.aria-label]="i18n.t('importLocalPassBackup')"
        (change)="onBackupFileSelected($event)"
      />

      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('importLabel')"
          [sub]="i18n.t('importSourceSubtitle')"
          [back]="true"
          (backTriggered)="goBack()"
        ></lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('importLabel')"
          [sub]="i18n.t('importSourceSubtitle')"
        ></lp-page-header>
      }

      <div class="agy-ext-scroll">
        <div class="agy-grp">
          <button
            id="import-source_button_onepassword"
            type="button"
            class="agy-setrow"
            (click)="pickOnePassword()"
          >
            <lp-kind-tile [kind]="loginKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="agy-k tw-block">{{ i18n.t("importOnePassword") }}</span>
              <span class="agy-d tw-block tw-truncate">{{ i18n.t("importOnePasswordSub") }}</span>
            </span>
            <span class="agy-chip agy-brand">{{ i18n.t("importSourceRecommended") }}</span>
          </button>

          <button
            id="import-source_button_localpass-backup"
            type="button"
            class="agy-setrow"
            (click)="pickLocalPassBackup()"
          >
            <lp-kind-tile [kind]="noteKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="agy-k tw-block">{{ i18n.t("importLocalPassBackup") }}</span>
              <span class="agy-d tw-block tw-truncate">{{
                i18n.t("importLocalPassBackupSub")
              }}</span>
            </span>
            <span class="agy-chip">{{ i18n.t("importSourceNative") }}</span>
          </button>

          <button
            id="import-source_button_bitwarden-export"
            type="button"
            class="agy-setrow"
            (click)="pickBitwardenExport()"
          >
            <lp-kind-tile [kind]="loginKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="agy-k tw-block">{{ i18n.t("importBitwardenExportAny") }}</span>
              <span class="agy-d tw-block tw-truncate">{{
                i18n.t("importBitwardenExportAnySub")
              }}</span>
            </span>
            <span class="agy-chip">{{ i18n.t("importSourceCompatible") }}</span>
          </button>

          <button
            id="import-source_button_google-authenticator"
            type="button"
            class="agy-setrow"
            (click)="pickGoogleAuth()"
          >
            <lp-kind-tile [kind]="tokenKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="agy-k tw-block">{{ i18n.t("googleAuthenticator") }}</span>
              <span class="agy-d tw-block tw-truncate">{{ i18n.t("googleAuthSub") }}</span>
            </span>
            <span class="agy-chip">{{ i18n.t("importSourceTwoFactor") }}</span>
          </button>

          <button
            id="import-source_button_generic-csv"
            type="button"
            class="agy-setrow"
            (click)="pickGenericCsv()"
          >
            <lp-kind-tile [kind]="loginKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="agy-k tw-block">{{ i18n.t("importGenericCsv") }}</span>
              <span class="agy-d tw-block tw-truncate">{{ i18n.t("importGenericCsvSub") }}</span>
            </span>
            <span class="agy-chip">{{ i18n.t("importSourceGeneric") }}</span>
          </button>
        </div>

        <button
          id="import-source_button_more-sources"
          type="button"
          class="agy-btn agy-lg tw-mt-2 tw-w-full"
          (click)="openMoreSources()"
        >
          <bit-icon name="bwi-import" class="tw-text-sm"></bit-icon>
          {{ i18n.t("moreSources") }}
        </button>

        <p class="agy-hint tw-text-center">
          {{ i18n.t("importFootnote") }}
        </p>
      </div>
    </div>
  `,
})
export class ImportSourceV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly staging = inject(ImportPreviewStagingService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toast = inject(LpToastService);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly noteKind = ItemKind.Note;
  protected readonly loginKind = ItemKind.Login;
  protected readonly tokenKind = ItemKind.Token;
  private readonly backupFile = viewChild<ElementRef<HTMLInputElement>>("backupFile");

  /** 文件选择框是共用的；记住用户点的是哪一行，才能为同类文件选择正确的解析器。 */
  private readonly pendingSource = signal<ImportSourceKind>("localpass");

  protected pickOnePassword(): void {
    this.pickFile("onepassword", ".1pux,.1pif,.csv");
  }

  protected pickLocalPassBackup(): void {
    this.pickFile("localpass", ".json,application/json");
  }

  protected pickBitwardenExport(): void {
    this.pickFile("bitwarden", ".json,.csv,application/json,text/csv");
  }

  protected pickGenericCsv(): void {
    this.pickFile("generic", ".csv,text/csv");
  }

  private pickFile(source: ImportSourceKind, accept: string): void {
    const input = this.backupFile()?.nativeElement;
    if (!input) {
      return;
    }
    this.pendingSource.set(source);
    input.accept = accept;
    input.click();
  }

  protected async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    try {
      const importType = this.importTypeFor(file.name);
      const contents = await readImportFileContents(importType, file);
      this.staging.set({
        importType,
        fileName: file.name,
        contents,
      });
      const next = this.route.snapshot.queryParamMap.get("next");
      await this.router.navigate(["/import-preview-v2"], {
        queryParams: next ? { next } : undefined,
      });
    } catch {
      this.toast.show(this.i18n.t("errorOccurred"));
    }
  }

  private importTypeFor(fileName: string): UpgradeImportType {
    return resolveImportType(this.pendingSource(), fileName, {
      mac: navigator.platform.toLowerCase().includes("mac"),
      safari: this.platformUtilsService.isSafari(),
      firefox: this.platformUtilsService.isFirefox(),
    });
  }

  protected pickGoogleAuth(): void {
    const next = this.route.snapshot.queryParamMap.get("next");
    void this.router.navigate(["/import-google-auth"], {
      queryParams: next ? { next } : undefined,
    });
  }

  /** 不常驻弹窗的格式统一交给完整导入页，避免在紧凑页里再抄一份来源清单。 */
  protected openMoreSources(): void {
    void this.router.navigate(["/import"]);
  }

  protected goBack(): void {
    const next = this.route.snapshot.queryParamMap.get("next");
    void this.router.navigateByUrl(next ?? "/tabs/settings");
  }
}
