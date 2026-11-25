import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, DialogService } from "@localpass/components";
import { S3Client, VaultBackupService, VaultBackupSyncService } from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
  LpRowComponent,
} from "../../local-ui";

interface BackupStatus {
  readonly lastSyncedAt: string | null;
  readonly lastBackupAt: string | null;
}

/**
 * 备份与恢复（方向 C）。
 *
 * 硬约束：**这里没有定时器**。上传只由「立即备份 / 立即同步」两个按钮触发，
 * 任何本地写入都不会自动上传。看一下页面顶部的黄条说得很清楚，用户不用猜。
 */
@Component({
  selector: "backup-settings-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    ButtonModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-[var(--lp-bg)]">
      <lp-page-header
        [title]="i18n.t('backupTitle')"
        [sub]="i18n.t('backupSubtitle')"
      ></lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <div
          class="tw-mx-3 tw-mb-2 tw-rounded-[11px] tw-border tw-border-[#f6e2b8] tw-bg-[#fdf6e6] tw-px-3 tw-py-2.5 tw-text-[11px] tw-leading-relaxed tw-text-[#8a5a00]"
        >
          {{ i18n.t("backupManualNotice") }}
        </div>

        <lp-group [label]="i18n.t('backupStatus')">
          <lp-row
            [label]="i18n.t('lastSynced')"
            [value]="status().lastSyncedAt ?? i18n.t('never')"
            [clickable]="false"
          />
          <lp-row
            [label]="i18n.t('lastBackup')"
            [value]="status().lastBackupAt ?? i18n.t('never')"
            [clickable]="false"
          />
          <lp-row
            [label]="i18n.t('backupMode')"
            [value]="i18n.t('backupManual')"
            [clickable]="false"
          />
        </lp-group>

        <lp-group [label]="i18n.t('backupStorage')">
          <lp-field
            [label]="i18n.t('backupEndpoint')"
            [value]="valueOf('endpoint')"
            (valueChange)="set('endpoint', $event)"
          />
          <lp-field
            [label]="i18n.t('backupBucket')"
            [value]="valueOf('bucket')"
            (valueChange)="set('bucket', $event)"
          />
          <lp-field
            [label]="i18n.t('backupPrefix')"
            [value]="valueOf('prefix')"
            (valueChange)="set('prefix', $event)"
          />
          <lp-field
            [label]="i18n.t('backupAccessKey')"
            [value]="valueOf('accessKeyId')"
            (valueChange)="set('accessKeyId', $event)"
          />
          <lp-field
            [label]="i18n.t('backupSecretKey')"
            [password]="true"
            [value]="valueOf('secretAccessKey')"
            (valueChange)="set('secretAccessKey', $event)"
          />
        </lp-group>

        <lp-group [label]="i18n.t('backupActions')">
          <lp-row
            emoji="🔌"
            [label]="i18n.t('backupTest')"
            [value]="busy() ? i18n.t('loading') : ''"
            [chevron]="true"
            [clickable]="true"
            (activated)="testConnection()"
          />
          <lp-row
            emoji="💾"
            [label]="i18n.t('backupSaveConfig')"
            [chevron]="true"
            [clickable]="true"
            (activated)="save()"
          />
          <lp-row
            emoji="☁️"
            [label]="i18n.t('backupNow')"
            [chevron]="true"
            [clickable]="true"
            (activated)="backupNow()"
          />
          <lp-row
            emoji="↺"
            [label]="i18n.t('syncNow')"
            [chevron]="true"
            [clickable]="true"
            (activated)="syncNow()"
          />
        </lp-group>

        <lp-group [label]="i18n.t('backupPassphrase')">
          <lp-row
            emoji="🔑"
            [label]="i18n.t('backupPassphrase')"
            [value]="passwordVisible() ? (password() ?? '') : '••••••••'"
            [mono]="true"
            [chevron]="!passwordVisible()"
            [clickable]="true"
            (activated)="revealPassword()"
          />
        </lp-group>

        @if (errorMessage()) {
          <p class="tw-px-4 tw-pt-3 tw-text-[11px] tw-text-[var(--lp-danger)]">
            {{ errorMessage() }}
          </p>
        }
      </div>
    </div>
  `,
})
export class BackupSettingsV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly backupService = inject(VaultBackupService);
  private readonly accountService = inject(AccountService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly dialogService = inject(DialogService);

  protected readonly form = this.formBuilder.group({
    endpoint: ["", [Validators.required]],
    region: ["auto"],
    bucket: ["", [Validators.required]],
    accessKeyId: ["", [Validators.required]],
    secretAccessKey: ["", [Validators.required]],
    prefix: ["localpass"],
  });

  protected readonly status = signal<BackupStatus>({ lastSyncedAt: null, lastBackupAt: null });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly password = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);

  async ngOnInit(): Promise<void> {
    const userId = await this.userId();
    const config = await this.syncService.getConfig(userId);
    if (config) {
      this.form.patchValue(config);
    }
    await this.refreshStatus();
  }

  protected valueOf(
    key: "endpoint" | "bucket" | "prefix" | "accessKeyId" | "secretAccessKey",
  ): string {
    return this.form.get(key)?.value ?? "";
  }

  protected set(
    key: "endpoint" | "bucket" | "prefix" | "accessKeyId" | "secretAccessKey",
    value: string,
  ): void {
    this.form.get(key)?.setValue(value);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set(this.i18n.t("backupFieldsRequired"));
      return;
    }

    const userId = await this.userId();
    const value = this.form.getRawValue();
    await this.syncService.configure(userId, {
      provider: "r2",
      endpoint: value.endpoint ?? "",
      region: value.region ?? "auto",
      bucket: value.bucket ?? "",
      accessKeyId: value.accessKeyId ?? "",
      secretAccessKey: value.secretAccessKey ?? "",
      prefix: value.prefix ?? "",
      forcePathStyle: false,
    });

    this.errorMessage.set(null);
    this.platformUtilsService.showToast("success", "", this.i18n.t("backupSaved"));
    await this.refreshStatus();
  }

  protected async testConnection(): Promise<void> {
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const value = this.form.getRawValue();
      const client = new S3Client({
        endpoint: value.endpoint ?? "",
        region: value.region ?? "auto",
        bucket: value.bucket ?? "",
        prefix: value.prefix ?? "",
        forcePathStyle: false,
        credentials: {
          accessKeyId: value.accessKeyId ?? "",
          secretAccessKey: value.secretAccessKey ?? "",
        },
      });
      await client.listObjects("");
      this.platformUtilsService.showToast("success", "", this.i18n.t("backupTestOk"));
    } catch (error) {
      this.errorMessage.set(this.i18n.t("backupTestFailed"));
      throw error;
    } finally {
      this.busy.set(false);
    }
  }

  /** 只有用户点这里才会上传；没有任何后台调度。 */
  protected async backupNow(): Promise<void> {
    this.busy.set(true);
    try {
      const userId = await this.userId();
      const result = await this.backupService.backupNow(userId);
      this.platformUtilsService.showToast(
        result.uploaded ? "success" : "error",
        "",
        this.i18n.t(result.uploaded ? "backupUploaded" : "backupFailed"),
      );
      await this.refreshStatus();
    } finally {
      this.busy.set(false);
    }
  }

  protected async syncNow(): Promise<void> {
    this.busy.set(true);
    try {
      const userId = await this.userId();
      await this.syncService.sync(userId);
      await this.refreshStatus();
    } finally {
      this.busy.set(false);
    }
  }

  protected async revealPassword(): Promise<void> {
    if (this.passwordVisible()) {
      this.passwordVisible.set(false);
      return;
    }
    const userId = await this.userId();
    this.password.set(await this.backupService.ensurePassword(userId));
    this.passwordVisible.set(true);
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
    this.form.reset({ region: "auto", prefix: "localpass" });
    this.status.set({ lastSyncedAt: null, lastBackupAt: null });
  }

  private async refreshStatus(): Promise<void> {
    const userId = await this.userId();
    const state = await this.syncService.getSyncState(userId);
    const settings = await this.backupService.getSettings(userId);
    this.status.set({
      lastSyncedAt: state.lastSyncedAt,
      lastBackupAt: settings.lastBackupAt ?? null,
    });
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
