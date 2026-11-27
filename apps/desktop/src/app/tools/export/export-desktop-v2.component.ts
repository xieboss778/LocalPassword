import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  LpFieldComponent,
  LpFieldOption,
  LpPageHeaderComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@localpass/common/dirt/event-logs";
import { FileDownloadService } from "@localpass/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, CalloutModule, DialogService } from "@localpass/components";
import { ExportFormat, VaultExportServiceAbstraction } from "@localpass/vault-export-core";

/**
 * 桌面端导出：安全密码 + 格式 + 导出，右侧说明注意事项。
 *
 * 加密格式沿用 `VaultExportService`：密码只用于生成加密文件，不写进 storage 或日志。
 */
@Component({
  selector: "export-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [ButtonModule, CalloutModule, LpFieldComponent, LpPageHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('exportNoun')" [sub]="i18n.t('exportSubtitle')" />

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        <div class="tw-flex tw-items-start tw-gap-4">
          <div
            class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-text-base tw-font-semibold tw-text-main">
              {{ i18n.t("exportEncryptedTitle") }}
            </h2>
            <p class="tw-mb-0 tw-mt-1 tw-text-sm tw-leading-relaxed tw-text-muted">
              {{ i18n.t("exportEncryptedDesc") }}
            </p>

            <div class="tw-mt-4 tw-flex tw-flex-col tw-gap-3">
              @if (encrypted()) {
                <lp-field
                  id="export_input_password"
                  [label]="i18n.t('masterPass')"
                  [password]="true"
                  [autocomplete]="'new-password'"
                  [(value)]="password"
                ></lp-field>
              }

              <lp-field
                id="export_select_format"
                [label]="i18n.t('exportFormatLabel')"
                [options]="formatOptions"
                [(value)]="formatValue"
              ></lp-field>

              <button
                id="export_button_submit"
                type="button"
                bitButton
                buttonType="primary"
                block
                [disabled]="busy()"
                [loading]="busy()"
                (click)="exportNow()"
              >
                {{ i18n.t("exportVerb") }}
              </button>

              @if (error()) {
                <div
                  class="tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-p-3 tw-text-xs tw-leading-relaxed tw-text-fg-danger-strong"
                >
                  {{ error() }}
                </div>
              }
            </div>
          </div>

          <aside
            class="tw-w-5/12 tw-flex-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-text-base tw-font-semibold tw-text-main">
              {{ i18n.t("exportSecurityNote") }}
            </h2>
            <div class="tw-mt-3">
              <bit-callout type="warning" [title]="null">{{ warning() }}</bit-callout>
            </div>
            <p class="tw-mb-0 tw-mt-4 tw-text-sm tw-leading-relaxed tw-text-muted">
              {{ i18n.t("exportForgotPassword") }}
            </p>
          </aside>
        </div>
      </div>
    </div>
  `,
})
export class ExportDesktopV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly exportService = inject(VaultExportServiceAbstraction);
  private readonly fileDownloadService = inject(FileDownloadService);
  private readonly eventCollectionService = inject(EventCollectionService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);

  protected readonly password = signal("");
  protected readonly formatValue = signal<string>("encrypted_json");
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formatOptions: readonly LpFieldOption[] = [
    { value: "encrypted_json", label: this.i18n.t("exportFormatEncrypted") },
    { value: "json", label: this.i18n.t("exportFormatPlain") },
  ];

  protected readonly format = computed<ExportFormat>(() =>
    this.formatValue() === "json" ? "json" : "encrypted_json",
  );
  protected readonly encrypted = computed(() => this.format() === "encrypted_json");
  protected readonly warning = computed(() =>
    this.i18n.t(this.encrypted() ? "exportWarning" : "exportPlainWarning"),
  );

  protected async exportNow(): Promise<void> {
    if (this.busy()) {
      return;
    }

    const format = this.format();
    const password = this.password();
    if (format === "encrypted_json" && !password) {
      this.error.set(this.i18n.t("filePasswordRequired"));
      return;
    }
    if (format === "json") {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "confirmVaultExport" },
        content: { key: "exportPlainWarning" },
        type: "warning",
      });
      if (!confirmed) {
        return;
      }
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const exported = await this.exportService.getExport(
        userId,
        format,
        format === "encrypted_json" ? password : "",
      );
      this.fileDownloadService.download({
        fileName: exported.fileName,
        blobData: exported.data,
        blobOptions: { type: exported.type },
      });
      this.platformUtilsService.showToast("success", "", this.i18n.t("exportSuccess"));
      try {
        await this.eventCollectionService.collect(EventType.User_ClientExportedVault);
      } catch {
        // Telemetry is best-effort; the file is already downloaded.
      }
      await this.router.navigateByUrl("/settings-desktop-v2");
    } catch (error) {
      this.logService.error(error);
      this.error.set(this.i18n.t("exportError"));
    } finally {
      this.busy.set(false);
    }
  }
}
