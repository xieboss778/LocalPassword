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
} from "@localpass/angular/local-ui";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { IconModule } from "@localpass/components";
import { ImportPreviewStagingService } from "@localpass/importer-ui";
import { ItemKind } from "@localpass/local-vault";

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
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
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

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <div class="tw-flex tw-flex-col tw-gap-2 tw-px-4 tw-pt-2">
          <button
            id="import-source_button_localpass-backup"
            type="button"
            class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start hover:tw-bg-background-alt"
            (click)="pickLocalPassBackup()"
          >
            <lp-kind-tile [kind]="noteKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                i18n.t("importLocalPassBackup")
              }}</span>
              <span class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">{{
                i18n.t("importLocalPassBackupSub")
              }}</span>
            </span>
            <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
          </button>

          <button
            id="import-source_button_bitwarden-export"
            type="button"
            class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start hover:tw-bg-background-alt"
            (click)="pickBitwardenExport()"
          >
            <lp-kind-tile [kind]="loginKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                i18n.t("importBitwardenExport")
              }}</span>
              <span class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">{{
                i18n.t("importBitwardenExportSub")
              }}</span>
            </span>
            <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
          </button>

          <button
            id="import-source_button_google-authenticator"
            type="button"
            class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3 tw-text-start hover:tw-bg-background-alt"
            (click)="pickGoogleAuth()"
          >
            <lp-kind-tile [kind]="tokenKind" size="sm"></lp-kind-tile>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="tw-block tw-text-sm tw-font-medium tw-text-main">{{
                i18n.t("googleAuthenticator")
              }}</span>
              <span class="tw-block tw-truncate tw-text-xs tw-leading-relaxed tw-text-muted">{{
                i18n.t("googleAuthSub")
              }}</span>
            </span>
            <bit-icon name="bwi-angle-right" class="tw-text-sm tw-text-muted"></bit-icon>
          </button>
        </div>

        <div class="tw-px-4 tw-pt-3">
          <button
            id="import-source_button_drop-zone"
            type="button"
            class="tw-flex tw-w-full tw-flex-col tw-items-center tw-gap-1 tw-rounded-xl tw-border-2 tw-border-dashed tw-border-border-base tw-bg-background-alt tw-px-3 tw-py-5 tw-text-center hover:tw-bg-bg-hover"
            (click)="pickLocalPassBackup()"
          >
            <bit-icon name="bwi-upload" class="tw-text-2xl tw-text-muted"></bit-icon>
            <span class="tw-text-sm tw-font-medium tw-text-main">{{
              i18n.t("dropZoneTitle")
            }}</span>
            <span class="tw-text-xs tw-text-muted">{{ i18n.t("dropZoneSub") }}</span>
          </button>
        </div>

        <p class="tw-px-4 tw-pt-3 tw-text-center tw-text-xs tw-leading-relaxed tw-text-muted">
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

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly noteKind = ItemKind.Note;
  protected readonly loginKind = ItemKind.Login;
  protected readonly tokenKind = ItemKind.Token;
  private readonly backupFile = viewChild<ElementRef<HTMLInputElement>>("backupFile");

  /** LocalPass 备份与 Bitwarden 加密导出共用同一个密码保护 JSON 导入器。 */
  protected pickLocalPassBackup(): void {
    this.backupFile()?.nativeElement.click();
  }

  protected pickBitwardenExport(): void {
    this.backupFile()?.nativeElement.click();
  }

  protected async onBackupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }

    try {
      const contents = await file.text();
      this.staging.set({
        importType: "localpassjson",
        fileName: file.name,
        contents,
      });
      await this.router.navigateByUrl("/import-preview-v2");
    } catch {
      this.platformUtilsService.showToast("error", "", this.i18n.t("errorOccurred"));
    }
  }

  protected pickGoogleAuth(): void {
    void this.router.navigate(["/import-google-auth"]);
  }

  protected goBack(): void {
    const next = this.route.snapshot.queryParamMap.get("next");
    void this.router.navigateByUrl(next ?? "/tabs/settings");
  }
}
