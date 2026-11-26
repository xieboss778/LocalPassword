import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, DialogService } from "@localpass/components";
import {
  MergeConflict,
  S3Client,
  VaultBackupService,
  VaultBackupSyncService,
} from "@localpass/local-vault";

import { JslibModule } from "../../jslib.module";
import {
  LpFieldComponent,
  LpGroupComponent,
  LpPageHeaderComponent,
  LpPopupHeaderComponent,
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
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    ButtonModule,
    LpFieldComponent,
    LpGroupComponent,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
    LpRowComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      @if (compact()) {
        <lp-popup-header
          [title]="i18n.t('backupTitle')"
          [sub]="i18n.t('backupSubtitle')"
          [back]="true"
          (backTriggered)="goBack()"
        ></lp-popup-header>
      } @else {
        <lp-page-header
          [title]="i18n.t('backupTitle')"
          [sub]="i18n.t('backupSubtitle')"
        ></lp-page-header>
      }

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-auto tw-pb-8">
        <div
          class="tw-mx-3 tw-mb-2 tw-rounded-xl tw-border tw-border-border-warning-soft tw-bg-bg-warning-soft tw-px-3 tw-py-2.5 tw-text-xs tw-leading-relaxed tw-text-fg-warning-strong"
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
            icon="bwi-wireless"
            [label]="i18n.t('backupTest')"
            [value]="busy() ? i18n.t('loading') : ''"
            [chevron]="true"
            [clickable]="true"
            (activated)="testConnection()"
          />
          <lp-row
            icon="bwi-check"
            [label]="i18n.t('backupSaveConfig')"
            [chevron]="true"
            [clickable]="true"
            (activated)="save()"
          />
          <lp-row
            icon="bwi-upload"
            [label]="i18n.t('backupNow')"
            [chevron]="true"
            [clickable]="true"
            (activated)="backupNow()"
          />
          <lp-row
            icon="bwi-refresh"
            [label]="i18n.t('syncNow')"
            [chevron]="true"
            [clickable]="true"
            (activated)="syncNow()"
          />
        </lp-group>

        <lp-group [label]="i18n.t('backupPassphrase')">
          <lp-row
            icon="bwi-key"
            [label]="i18n.t('backupPassphrase')"
            [value]="passwordVisible() ? (password() ?? '') : '••••••••'"
            [mono]="true"
            [chevron]="!passwordVisible()"
            [copyValue]="passwordVisible() ? (password() ?? '') : ''"
            [copyLabel]="i18n.t('backupPassphrase')"
            [clickable]="true"
            (activated)="revealPassword()"
          />
        </lp-group>

        @if (passwordVisible()) {
          <div class="tw-px-3 tw-pt-2">
            <button type="button" bitButton buttonType="secondary" (click)="hidePassword()">
              {{ i18n.t("hideValue") }}
            </button>
          </div>
        }

        @if (configured()) {
          <lp-group [label]="i18n.t('backupStorage')">
            <lp-row
              icon="bwi-trash"
              [label]="i18n.t('disconnectBackup')"
              [sub]="i18n.t('backupManualNotice')"
              [chevron]="true"
              [clickable]="true"
              (activated)="disconnect()"
            />
          </lp-group>
        }

        @switch (phase()) {
          @case ("loading") {
            <lp-group [label]="i18n.t('syncPhaseTitle')">
              <lp-row
                icon="bwi-refresh"
                [label]="i18n.t('syncLoading')"
                [value]="i18n.t('loading')"
                [clickable]="false"
              />
            </lp-group>
          }
          @case ("conflict") {
            <lp-group [label]="i18n.t('syncConflictTitle')">
              @for (conflict of conflicts(); track conflict.id) {
                <lp-row
                  [label]="conflict.id"
                  [sub]="conflict.localRevision + ' → ' + conflict.remoteRevision"
                  [value]="
                    conflict.winner === 'local'
                      ? i18n.t('restoreWinnerLocal')
                      : i18n.t('restoreWinnerRemote')
                  "
                  [clickable]="false"
                />
              }
            </lp-group>
            <div class="tw-px-3 tw-pt-2">
              <button type="button" bitButton buttonType="secondary" (click)="dismissConflict()">
                {{ i18n.t("syncConflictAccept") }}
              </button>
            </div>
          }
          @case ("error") {
            <div
              class="tw-mx-3 tw-mt-2 tw-rounded-xl tw-border tw-border-border-danger-soft tw-bg-bg-danger-soft tw-px-3 tw-py-2.5 tw-text-xs tw-text-fg-danger-strong"
            >
              {{ i18n.t("backupSyncFailed") }}
            </div>
            <div class="tw-px-3 tw-pt-2">
              <button type="button" bitButton buttonType="secondary" (click)="syncNow()">
                {{ i18n.t("retry") }}
              </button>
            </div>
          }
        }

        @if (errorMessage()) {
          <p class="tw-px-4 tw-pt-3 tw-text-xs tw-text-fg-danger">
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  protected readonly configured = signal(false);

  protected readonly form = this.formBuilder.group({
    endpoint: ["", [Validators.required]],
    region: ["auto"],
    bucket: ["", [Validators.required]],
    accessKeyId: ["", [Validators.required]],
    secretAccessKey: ["", [Validators.required]],
    prefix: ["localpass"],
  });

  protected readonly status = signal<BackupStatus>({ lastSyncedAt: null, lastBackupAt: null });
  /** 同步的三态：idle / loading / conflict / error——由真实调用驱动，不是摆出来的。 */
  protected readonly phase = signal<"idle" | "loading" | "conflict" | "error">("idle");
  protected readonly conflicts = signal<readonly MergeConflict[]>([]);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly password = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);

  async ngOnInit(): Promise<void> {
    const userId = await this.userId();
    const config = await this.syncService.getConfig(userId);
    if (config) {
      this.form.patchValue(config);
      this.configured.set(true);
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
    this.configured.set(true);
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
    } catch {
      this.errorMessage.set(this.i18n.t("backupTestFailed"));
    } finally {
      this.busy.set(false);
    }
  }

  /** 只有用户点这里才会上传；没有任何后台调度。 */
  protected async backupNow(): Promise<void> {
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const userId = await this.userId();
      const result = await this.backupService.backupNow(userId);
      this.platformUtilsService.showToast(
        result.uploaded ? "success" : "error",
        "",
        this.i18n.t(result.uploaded ? "backupUploaded" : "backupFailed"),
      );
      await this.refreshStatus();
    } catch {
      // 端点不可达或凭证无效都走同一条回执；不要抛到 Angular 事件循环里。
      this.errorMessage.set(this.i18n.t("backupFailed"));
      this.platformUtilsService.showToast("error", "", this.i18n.t("backupFailed"));
    } finally {
      this.busy.set(false);
    }
  }

  protected async syncNow(): Promise<void> {
    this.busy.set(true);
    this.phase.set("loading");
    this.conflicts.set([]);
    try {
      const userId = await this.userId();
      const result = await this.syncService.sync(userId);
      await this.refreshStatus();

      // 冲突条目由拉取时的合并给出：冷启动不再用「不知道发生了什么」的提示。
      if (result.pulled.conflicts.length > 0) {
        this.conflicts.set(result.pulled.conflicts);
        this.phase.set("conflict");
      } else {
        this.phase.set("idle");
      }
    } catch {
      this.errorMessage.set(this.i18n.t("backupSyncFailed"));
      this.phase.set("error");
    } finally {
      this.busy.set(false);
    }
  }

  protected dismissConflict(): void {
    this.phase.set("idle");
    this.conflicts.set([]);
  }

  protected async revealPassword(): Promise<void> {
    if (this.passwordVisible()) {
      return;
    }
    const userId = await this.userId();
    this.password.set(await this.backupService.ensurePassword(userId));
    this.passwordVisible.set(true);
  }

  protected hidePassword(): void {
    this.passwordVisible.set(false);
  }

  protected goBack(): void {
    void this.router.navigateByUrl("/tabs/settings");
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
    this.password.set(null);
    this.passwordVisible.set(false);
    this.configured.set(false);
    this.phase.set("idle");
    this.conflicts.set([]);
    this.errorMessage.set(null);
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
