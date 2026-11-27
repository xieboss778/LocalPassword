import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import {
  LpFieldComponent,
  LpFieldOption,
  LpPopupHeaderComponent,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@localpass/common/dirt/event-logs";
import { FileDownloadService } from "@localpass/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { UserId } from "@localpass/common/types/guid";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { ButtonModule, DialogService, IconModule } from "@localpass/components";
import { ExportFormat, VaultExportServiceAbstraction } from "@localpass/vault-export-core";

import { VaultPopupItemsService } from "../../../../vault/popup/services/vault-popup-items.service";

/**
 * 导出（弹窗）：安全密码 + 格式 + 导出，下面是条目 / 文件夹 / 回收站的真实计数。
 *
 * 加密格式沿用 `VaultExportService`：密码只用于生成加密文件，不写进 storage 或日志。
 */
@Component({
  templateUrl: "export-browser-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, IconModule, LpFieldComponent, LpPopupHeaderComponent],
})
export class ExportBrowserV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly itemsService = inject(VaultPopupItemsService);
  private readonly folderService = inject(FolderService);
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

  protected readonly itemCount = toSignal(
    this.itemsService.activeCiphers$.pipe(map((ciphers) => ciphers.length)),
    { initialValue: 0 },
  );
  protected readonly trashCount = toSignal(
    this.itemsService.deletedCiphers$.pipe(
      takeUntilDestroyed(),
      map((ciphers) => ciphers.length),
    ),
    { initialValue: 0 },
  );
  protected readonly folderCount = toSignal(
    this.accountService.activeAccount$.pipe(
      takeUntilDestroyed(),
      getUserId,
      filter((userId): userId is UserId => userId != null),
      switchMap((userId) => this.folderService.folderViews$(userId)),
      map((folders) => folders.filter((folder) => folder.id !== "").length),
    ),
    { initialValue: 0 },
  );

  protected back(): void {
    void this.router.navigateByUrl("/tabs/settings");
  }

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
      await this.router.navigateByUrl("/tabs/settings");
    } catch (error) {
      this.logService.error(error);
      this.error.set(this.i18n.t("exportError"));
    } finally {
      this.busy.set(false);
    }
  }
}
