import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { filter, firstValueFrom, map, switchMap } from "rxjs";

import {
  LpFieldComponent,
  LpFieldOption,
  LpPopupHeaderComponent,
  LpToastService,
} from "@localpass/angular/local-ui";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@localpass/common/dirt/event-logs";
import { InternalMasterPasswordServiceAbstraction } from "@localpass/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { FileDownloadService } from "@localpass/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";
import { FolderService } from "@localpass/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService, IconModule } from "@localpass/components";
import { ExportFormat, VaultExportServiceAbstraction } from "@localpass/vault-export-core";

import { VaultPopupItemsService } from "../../../../vault/popup/services/vault-popup-items.service";

/**
 * 导出（弹窗）：先校验安全密码，再按格式导出；加密导出另设文件密码。
 *
 * 加密格式沿用 `VaultExportService`：密码只用于生成加密文件，不写进 storage 或日志。
 */
@Component({
  templateUrl: "export-browser-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [IconModule, LpFieldComponent, LpPopupHeaderComponent],
})
export class ExportBrowserV2Component {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly itemsService = inject(VaultPopupItemsService);
  private readonly folderService = inject(FolderService);
  private readonly accountService = inject(AccountService);
  private readonly masterPasswordService = inject(InternalMasterPasswordServiceAbstraction);
  private readonly exportService = inject(VaultExportServiceAbstraction);
  private readonly fileDownloadService = inject(FileDownloadService);
  private readonly eventCollectionService = inject(EventCollectionService);
  private readonly toast = inject(LpToastService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);

  protected readonly vaultPassword = signal("");
  protected readonly filePassword = signal("");
  protected readonly formatValue = signal<string>("encrypted_json");
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly formatOptions: readonly LpFieldOption[] = [
    { value: "encrypted_json", label: this.i18n.t("exportFormatEncrypted") },
    { value: "json", label: this.i18n.t("exportFormatPlain") },
    { value: "csv", label: this.i18n.t("exportFormatCsv") },
  ];

  protected readonly format = computed<ExportFormat>(() => {
    const value = this.formatValue();
    return value === "json" || value === "csv" ? value : "encrypted_json";
  });
  protected readonly encrypted = computed(() => this.format() === "encrypted_json");
  protected readonly warning = computed(() => {
    const format = this.format();
    if (format === "csv") {
      return this.i18n.t("exportCsvWarning");
    }
    return this.i18n.t(format === "json" ? "exportPlainWarning" : "exportWarning");
  });

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
    const vaultPassword = this.vaultPassword();
    if (!vaultPassword) {
      this.error.set(this.i18n.t("masterPasswordRequired"));
      return;
    }
    const filePassword = this.filePassword();
    if (format === "encrypted_json" && !filePassword) {
      this.error.set(this.i18n.t("filePasswordRequired"));
      return;
    }
    if (format !== "encrypted_json") {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "confirmVaultExport" },
        content: { key: format === "csv" ? "exportCsvWarning" : "exportPlainWarning" },
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
      const unlockData = await firstValueFrom(
        this.masterPasswordService.masterPasswordUnlockData$(userId),
      );
      if (unlockData == null) {
        this.error.set(this.i18n.t("exportError"));
        return;
      }
      try {
        await this.masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData(
          vaultPassword,
          unlockData,
        );
      } catch {
        this.error.set(this.i18n.t("invalidMasterPassword"));
        return;
      }

      const exported = await this.exportService.getExport(
        userId,
        format,
        format === "encrypted_json" ? filePassword : "",
      );
      this.fileDownloadService.download({
        fileName: exported.fileName,
        blobData: exported.data,
        blobOptions: { type: exported.type },
      });
      this.vaultPassword.set("");
      this.filePassword.set("");
      this.toast.show(this.i18n.t("exportSuccess"));
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
