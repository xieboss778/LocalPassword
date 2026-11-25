import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  PlatformUtilsService,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import {
  S3Client,
  VaultBackupScheduler,
  VaultBackupService,
  VaultBackupSyncService,
} from "@bitwarden/local-vault";

import { JslibModule } from "../../../jslib.module";

/** What the page shows about the last sync and the newest backup. */
type BackupStatus = {
  lastSyncedAt: string | null;
  pending: boolean;
  lastBackupAt: string | null;
};

/**
 * Configures cloud backup for a local vault: the S3-compatible endpoint, the credential, and the
 * manual actions (test, sync now, back up now, disconnect).
 */
@Component({
  selector: "tools-backup-settings",
  templateUrl: "./backup-settings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    TypographyModule,
  ],
})
export class BackupSettingsComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly backupService = inject(VaultBackupService);
  private readonly scheduler = inject(VaultBackupScheduler);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);

  protected readonly formGroup = this.formBuilder.group({
    provider: ["r2"],
    endpoint: ["", [Validators.required]],
    region: ["auto", [Validators.required]],
    bucket: ["", [Validators.required]],
    accessKeyId: ["", [Validators.required]],
    secretAccessKey: ["", [Validators.required]],
    prefix: ["localpassword"],
    forcePathStyle: [false],
  });

  protected status: BackupStatus = { lastSyncedAt: null, pending: false, lastBackupAt: null };
  protected backupPassword: string | null = null;
  protected busy = false;

  async ngOnInit(): Promise<void> {
    const userId = await this.userId();
    const config = await this.syncService.getConfig(userId);
    if (config != null) {
      this.formGroup.patchValue(config);
    }
    await this.refreshStatus();
  }

  protected async save(): Promise<void> {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    const userId = await this.userId();
    const value = this.formGroup.getRawValue();

    await this.syncService.configure(userId, {
      provider: value.provider === "generic" ? "generic" : "r2",
      endpoint: value.endpoint ?? "",
      region: value.region ?? "auto",
      bucket: value.bucket ?? "",
      accessKeyId: value.accessKeyId ?? "",
      secretAccessKey: value.secretAccessKey ?? "",
      prefix: value.prefix ?? "",
      forcePathStyle: value.forcePathStyle ?? false,
    });

    this.platformUtilsService.showToast("success", null, this.i18nService.t("backupSaved"));
    await this.refreshStatus();
  }

  protected async testConnection(): Promise<void> {
    this.busy = true;
    try {
      const value = this.formGroup.getRawValue();
      const client = new S3Client({
        endpoint: value.endpoint ?? "",
        region: value.region ?? "auto",
        bucket: value.bucket ?? "",
        prefix: value.prefix ?? "",
        forcePathStyle: value.forcePathStyle ?? false,
        credentials: {
          accessKeyId: value.accessKeyId ?? "",
          secretAccessKey: value.secretAccessKey ?? "",
        },
      });
      await client.listObjects("");
      this.platformUtilsService.showToast("success", null, this.i18nService.t("backupTestOk"));
    } catch {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("backupTestFailed"));
    } finally {
      this.busy = false;
    }
  }

  protected async syncNow(): Promise<void> {
    this.busy = true;
    try {
      const userId = await this.userId();
      await this.scheduler.syncNow(userId);
      await this.refreshStatus();
    } finally {
      this.busy = false;
    }
  }

  protected async backupNow(): Promise<void> {
    this.busy = true;
    try {
      const userId = await this.userId();
      const result = await this.backupService.backupNow(userId);
      this.platformUtilsService.showToast(
        result.uploaded ? "success" : "error",
        null,
        this.i18nService.t(result.uploaded ? "backupUploaded" : "backupFailed"),
      );
      await this.refreshStatus();
    } finally {
      this.busy = false;
    }
  }

  protected async disconnect(): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "disconnectBackup" },
      content: { key: "disconnectBackupWarning" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    const userId = await this.userId();
    await this.syncService.disconnect(userId);
    this.formGroup.reset({ provider: "r2", region: "auto", prefix: "localpassword" });
    this.status = { lastSyncedAt: null, pending: false, lastBackupAt: null };
  }

  protected get lastSyncedLabel(): string {
    return this.status.lastSyncedAt ?? this.i18nService.t("never");
  }

  protected get lastBackupLabel(): string {
    return this.status.lastBackupAt ?? this.i18nService.t("never");
  }

  protected async revealPassword(): Promise<void> {
    const userId = await this.userId();
    this.backupPassword = await this.backupService.ensurePassword(userId);
  }

  protected async copyPassword(): Promise<void> {
    const userId = await this.userId();
    const password = this.backupPassword ?? (await this.backupService.ensurePassword(userId));
    await this.platformUtilsService.copyToClipboard(password);
    this.platformUtilsService.showToast("info", null, this.i18nService.t("valueCopied"));
  }

  private async refreshStatus(): Promise<void> {
    const userId = await this.userId();
    const state = await this.syncService.getSyncState(userId);
    const settings = await this.backupService.getSettings(userId);
    this.status = {
      lastSyncedAt: state.lastSyncedAt,
      pending: state.pending,
      lastBackupAt: settings.lastBackupAt,
    };
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
