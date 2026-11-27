import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { ButtonModule, CalloutModule, DialogService, IconModule } from "@localpass/components";
import {
  MergeConflict,
  RemoteVaultMismatchError,
  S3Client,
  SNAPSHOT_PREFIX,
  VaultBackupConfig,
  VaultBackupService,
  VaultBackupSyncService,
} from "@localpass/local-vault";

import { LpPageHeaderComponent, LpPopupHeaderComponent } from "../../local-ui";

import { formatBackupTimestamp, formatSnapshotId } from "./backup-time";

interface BackupStatus {
  readonly lastSyncedAt: string | null;
  readonly lastBackupAt: string | null;
}

interface SnapshotRow {
  readonly id: string;
  readonly size: number;
  readonly latest: boolean;
}

type ConfigKey = "endpoint" | "bucket" | "accessKeyId" | "secretAccessKey";

interface ConfigField {
  readonly key: ConfigKey;
  readonly labelKey: string;
  readonly mono: boolean;
  readonly password: boolean;
}

/**
 * 备份与恢复（方向 C）。
 *
 * 硬约束：**这里没有定时器**。上传只由「同步 / 导出备份」两个按钮触发，
 * 任何本地写入都不会自动上传。快照列表只读对象元数据，不解密、不写日志。
 */
@Component({
  selector: "backup-settings-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CalloutModule,
    IconModule,
    LpPageHeaderComponent,
    LpPopupHeaderComponent,
  ],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background">
      @if (compact()) {
        <lp-popup-header
          [title]="configView() ? i18n.t('backupStorage') : i18n.t('backupTitle')"
          [sub]="configView() ? i18n.t('backupConfigSubtitle') : i18n.t('backupSubtitle')"
          [back]="true"
          (backTriggered)="back()"
        >
          @if (!configView()) {
            <div slot="actions">
              <button
                type="button"
                class="tw-grid tw-size-8 tw-place-items-center tw-rounded-lg tw-text-muted hover:tw-bg-background-alt hover:tw-text-main"
                [attr.aria-label]="i18n.t('backupStorage')"
                [attr.title]="i18n.t('backupStorage')"
                data-testid="backup_go_config"
                (click)="goConfig()"
              >
                <bit-icon name="bwi-settings" class="tw-text-base"></bit-icon>
              </button>
            </div>
          }
        </lp-popup-header>
      } @else if (configView()) {
        <lp-page-header [title]="i18n.t('backupStorage')" [sub]="i18n.t('backupConfigSubtitle')">
          <button
            type="button"
            bitButton
            buttonType="secondary"
            [disabled]="busy()"
            data-testid="backup_test_connection"
            (click)="testConnection()"
          >
            {{ i18n.t("backupTest") }}
          </button>
          <button
            type="button"
            bitButton
            buttonType="primary"
            [disabled]="busy()"
            data-testid="backup_save_config"
            (click)="save()"
          >
            {{ i18n.t("backupSaveConfig") }}
          </button>
        </lp-page-header>
      } @else {
        <lp-page-header [title]="i18n.t('backupTitle')" [sub]="i18n.t('backupSubtitle')">
        </lp-page-header>
      }

      @if (configView()) {
        <ng-template #configForm>
          <div class="tw-flex tw-flex-col tw-gap-3">
            @for (field of configFields; track field.key) {
              <label class="tw-block" [attr.for]="'backup-form_input_' + field.key">
                <span class="tw-mb-1.5 tw-block tw-text-xs tw-font-medium tw-text-muted">{{
                  i18n.t(field.labelKey)
                }}</span>
                <input
                  [id]="'backup-form_input_' + field.key"
                  class="tw-w-full tw-rounded-lg tw-border tw-border-border-base tw-bg-background tw-px-3 tw-py-2 tw-text-sm tw-text-main tw-outline-none focus:tw-border-border-focus"
                  [class.tw-font-mono]="field.mono"
                  [type]="field.password ? 'password' : 'text'"
                  autocomplete="off"
                  [value]="valueOf(field.key)"
                  (input)="onConfigInput(field.key, $event)"
                />
              </label>
            }
          </div>
        </ng-template>

        @if (compact()) {
          <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-3.5 tw-pb-4 tw-pt-1">
            <div class="tw-flex tw-flex-col tw-gap-3 tw-px-0.5 tw-pt-0.5">
              <ng-container [ngTemplateOutlet]="configForm"></ng-container>
              <bit-callout type="info" [title]="null">{{
                i18n.t("backupCredentialNote")
              }}</bit-callout>
              @if (configured() && !dirty()) {
                <button type="button" bitButton buttonType="dangerGhost" (click)="disconnect()">
                  {{ i18n.t("disconnectBackup") }}
                </button>
              } @else if (dirty()) {
                <p class="tw-m-0 tw-text-xs tw-text-muted">
                  {{ i18n.t("backupUnsavedChanges") }}
                </p>
              }
              @if (errorMessage()) {
                <p class="tw-m-0 tw-text-xs tw-text-fg-danger">{{ errorMessage() }}</p>
              }
            </div>
          </div>
          <div
            class="tw-flex tw-flex-none tw-gap-2 tw-border-t tw-border-border-light tw-bg-background tw-px-3.5 tw-py-2.5"
          >
            <button
              type="button"
              bitButton
              buttonType="primary"
              class="tw-h-10 tw-flex-1"
              [disabled]="busy()"
              data-testid="backup_save_config"
              (click)="save()"
            >
              {{ i18n.t("backupSaveConfig") }}
            </button>
            <button
              type="button"
              bitButton
              buttonType="secondary"
              class="tw-h-10 tw-flex-1"
              [disabled]="busy()"
              data-testid="backup_test_connection"
              (click)="testConnection()"
            >
              {{ i18n.t("backupTest") }}
            </button>
          </div>
        } @else {
          <div class="tw-flex tw-items-start tw-gap-4 tw-px-7 tw-pt-1">
            <div
              class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 tw-shadow-sm"
            >
              <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
                {{ i18n.t("backupConnect") }}
              </h2>
              <div class="tw-pt-3">
                <ng-container [ngTemplateOutlet]="configForm"></ng-container>
              </div>
              @if (configured() && !dirty()) {
                <button
                  type="button"
                  bitButton
                  buttonType="dangerGhost"
                  class="tw-mt-4"
                  (click)="disconnect()"
                >
                  {{ i18n.t("disconnectBackup") }}
                </button>
              } @else if (dirty()) {
                <p class="tw-mb-0 tw-mt-4 tw-text-xs tw-text-muted">
                  {{ i18n.t("backupUnsavedChanges") }}
                </p>
              }
              @if (errorMessage()) {
                <p class="tw-mb-0 tw-mt-3 tw-text-xs tw-text-fg-danger">{{ errorMessage() }}</p>
              }
            </div>

            <aside
              class="tw-w-96 tw-flex-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-5 tw-shadow-sm"
            >
              <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
                {{ i18n.t("backupExplanation") }}
              </h2>
              <div class="tw-mt-3">
                <bit-callout type="info" [title]="null">{{
                  i18n.t("backupCredentialNote")
                }}</bit-callout>
              </div>
              <p class="tw-mb-0 tw-mt-4 tw-text-xs tw-leading-relaxed tw-text-muted">
                {{ i18n.t("backupKeyNote") }}
              </p>
            </aside>
          </div>
        }
      } @else {
        <div
          class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-pt-1 tw-pb-5"
          [class.tw-px-3.5]="compact()"
          [class.tw-px-7]="!compact()"
        >
          <div
            class="tw-flex tw-items-center tw-gap-2.5 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-3"
          >
            <span
              class="tw-grid tw-size-4 tw-flex-none tw-place-items-center tw-rounded-full"
              [class.tw-bg-bg-success-soft]="configured()"
              [class.tw-bg-bg-warning-soft]="!configured()"
              aria-hidden="true"
            >
              <span
                class="tw-size-2 tw-rounded-full"
                [class.tw-bg-bg-success]="configured()"
                [class.tw-bg-bg-warning]="!configured()"
              ></span>
            </span>
            <span class="tw-min-w-0">
              <span class="tw-block tw-text-sm tw-font-semibold tw-text-main">{{
                configured() ? i18n.t("backupConnectedR2") : i18n.t("backupNotConfigured")
              }}</span>
              <span class="tw-block tw-text-xs tw-text-muted">{{
                configured() ? lastSyncLabel() : i18n.t("backupConfigPrompt")
              }}</span>
            </span>
          </div>

          <div class="tw-flex tw-gap-2 tw-pt-3 tw-pb-1">
            <div
              class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-px-3 tw-py-2.5"
            >
              <span class="tw-block tw-text-lg tw-font-semibold tw-text-main">{{
                snapshots().length
              }}</span>
              <span class="tw-mt-px tw-block tw-text-xs tw-text-muted">{{
                i18n.t("backupSnapshots")
              }}</span>
            </div>
            <div
              class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-px-3 tw-py-2.5"
            >
              <span class="tw-block tw-text-lg tw-font-semibold tw-text-main">{{
                latestSize()
              }}</span>
              <span class="tw-mt-px tw-block tw-text-xs tw-text-muted">{{
                i18n.t("backupLatestSize")
              }}</span>
            </div>
            <div
              class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-px-3 tw-py-2.5"
            >
              <span class="tw-block tw-text-lg tw-font-semibold tw-text-main">{{
                i18n.t("backupManual")
              }}</span>
              <span class="tw-mt-px tw-block tw-text-xs tw-text-muted">{{
                i18n.t("backupMode")
              }}</span>
            </div>
          </div>

          <div class="tw-flex tw-gap-2 tw-pt-1">
            <button
              type="button"
              bitButton
              buttonType="primary"
              class="tw-flex-1"
              [disabled]="busy() || !configured()"
              data-testid="backup_sync_now"
              (click)="syncNow()"
            >
              {{ i18n.t("syncNow") }}
            </button>
            <button
              type="button"
              bitButton
              buttonType="secondary"
              class="tw-flex-1"
              [disabled]="busy() || !configured()"
              data-testid="backup_backup_now"
              (click)="backupNow()"
            >
              {{ i18n.t("backupNow") }}
            </button>
          </div>
          <p class="tw-m-0 tw-pt-1 tw-text-xs tw-text-muted">
            {{ i18n.t("backupActionHint") }}
          </p>

          @if (phase() === "conflict") {
            <div
              class="tw-mt-2 tw-rounded-xl tw-border tw-border-border-warning-soft tw-bg-bg-warning-soft tw-px-3 tw-py-2.5 tw-text-xs tw-leading-relaxed tw-text-fg-warning-strong"
            >
              {{ i18n.t("syncConflictTitle") }} · {{ conflicts().length }}
            </div>
            <button
              type="button"
              bitButton
              buttonType="secondary"
              class="tw-mt-2"
              (click)="dismissConflict()"
            >
              {{ i18n.t("syncConflictAccept") }}
            </button>
          }

          @if (errorMessage()) {
            <p class="tw-mx-0.5 tw-mb-0 tw-mt-2 tw-text-xs tw-text-fg-danger">
              {{ errorMessage() }}
            </p>
          }

          <div class="tw-px-0.5 tw-pb-1.5 tw-pt-3 tw-text-xs tw-font-semibold tw-text-muted">
            {{ i18n.t("backupRecentSnapshots") }}
          </div>
          <div
            class="tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
          >
            @if (snapshots().length === 0) {
              <div class="tw-px-3 tw-py-4 tw-text-sm tw-text-muted">
                {{ i18n.t("backupNoSnapshots") }}
              </div>
            } @else {
              @for (snapshot of snapshots(); track snapshot.id) {
                <div
                  class="tw-flex tw-min-h-12 tw-items-center tw-gap-2.5 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 last:tw-border-b-0"
                >
                  <span
                    class="tw-grid tw-size-7 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-background-alt tw-text-muted"
                  >
                    <bit-icon name="bwi-download" class="tw-text-sm"></bit-icon>
                  </span>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-flex tw-items-center tw-gap-1.5">
                      <span class="tw-truncate tw-text-sm tw-font-medium tw-text-main">{{
                        snapshotLabel(snapshot.id)
                      }}</span>
                      @if (snapshot.latest) {
                        <span
                          class="tw-rounded-full tw-bg-bg-success-soft tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium tw-text-fg-success"
                          >{{ i18n.t("backupLatest") }}</span
                        >
                      }
                    </span>
                    <span class="tw-block tw-text-xs tw-text-muted">{{
                      formatSize(snapshot.size)
                    }}</span>
                  </span>
                </div>
              }
            }
          </div>

          <p class="tw-m-0 tw-pt-2.5 tw-text-center tw-text-xs tw-leading-relaxed tw-text-muted">
            {{ i18n.t("backupFootnote") }}
          </p>
        </div>
      }
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
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  /** 桌面端把同一个组件拆成「状态」与「存储配置」两页；弹窗用独立路由打开配置页。 */
  protected readonly configView = computed(
    () => this.route.snapshot.data["backupView"] === "config",
  );
  protected readonly configured = signal(false);

  protected readonly configFields: readonly ConfigField[] = [
    { key: "endpoint", labelKey: "backupEndpoint", mono: true, password: false },
    { key: "bucket", labelKey: "backupBucket", mono: true, password: false },
    { key: "accessKeyId", labelKey: "backupAccessKey", mono: true, password: false },
    { key: "secretAccessKey", labelKey: "backupSecretKey", mono: false, password: true },
  ];

  protected readonly form = this.formBuilder.group({
    endpoint: ["", [Validators.required]],
    region: ["auto"],
    bucket: ["", [Validators.required]],
    accessKeyId: ["", [Validators.required]],
    secretAccessKey: ["", [Validators.required]],
  });

  /** The config as it is stored; the form in front of the user can differ until it is saved. */
  private readonly savedConfig = signal<VaultBackupConfig | null>(null);
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  /**
   * 测试连接只证明表单里的草稿可用，不会保存；未保存前生效的仍是已存储的配置。
   * 此时不显示「断开连接」，而是提示保存，避免「连接成功」和「断开连接」同时出现。
   */
  protected readonly dirty = computed(() => {
    const saved = this.savedConfig();
    if (saved == null) {
      return false;
    }
    const value = this.formValue();
    return (
      (value.endpoint ?? "") !== saved.endpoint ||
      (value.region ?? "auto") !== saved.region ||
      (value.bucket ?? "") !== saved.bucket ||
      (value.accessKeyId ?? "") !== saved.accessKeyId ||
      (value.secretAccessKey ?? "") !== saved.secretAccessKey
    );
  });

  protected readonly status = signal<BackupStatus>({ lastSyncedAt: null, lastBackupAt: null });
  protected readonly snapshots = signal<readonly SnapshotRow[]>([]);
  /** 同步的三态：idle / loading / conflict / error——由真实调用驱动，不是摆出来的。 */
  protected readonly phase = signal<"idle" | "loading" | "conflict" | "error">("idle");
  protected readonly conflicts = signal<readonly MergeConflict[]>([]);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const userId = await this.userId();
    const config = await this.syncService.getConfig(userId);
    if (config) {
      this.form.patchValue(config);
      this.savedConfig.set(config);
      this.configured.set(true);
    }
    await this.reload();
  }

  protected valueOf(key: ConfigKey): string {
    return this.form.get(key)?.value ?? "";
  }

  protected set(key: ConfigKey, value: string): void {
    this.form.get(key)?.setValue(value);
  }

  protected onConfigInput(key: ConfigKey, event: Event): void {
    this.set(key, (event.target as HTMLInputElement).value);
  }

  protected lastSyncLabel(): string {
    const time = formatBackupTimestamp(this.status().lastSyncedAt, this.locale(), this.i18n);
    return this.i18n.t("backupLastSyncedAt", time);
  }

  protected latestSize(): string {
    const latest = this.snapshots()[0];
    return latest ? this.formatSize(latest.size) : "—";
  }

  protected snapshotLabel(id: string): string {
    return formatSnapshotId(id, this.locale());
  }

  protected formatSize(bytes: number): string {
    if (bytes <= 0) {
      return "—";
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set(this.i18n.t("backupFieldsRequired"));
      return;
    }

    const userId = await this.userId();
    const value = this.form.getRawValue();
    const config: VaultBackupConfig = {
      endpoint: value.endpoint ?? "",
      region: value.region ?? "auto",
      bucket: value.bucket ?? "",
      accessKeyId: value.accessKeyId ?? "",
      secretAccessKey: value.secretAccessKey ?? "",
      forcePathStyle: false,
    };
    await this.syncService.configure(userId, config);

    this.errorMessage.set(null);
    this.savedConfig.set(config);
    this.configured.set(true);
    this.platformUtilsService.showToast("success", "", this.i18n.t("backupSaved"));
    await this.reload();
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
      await this.reload();
    } catch (error) {
      // 端点不可达、凭证无效、桶属于另一座库都走同一条回执；不要抛到 Angular 事件循环里。
      const message =
        error instanceof RemoteVaultMismatchError
          ? this.i18n.t("backupBucketInUse")
          : this.i18n.t("backupFailed");
      this.errorMessage.set(message);
      this.platformUtilsService.showToast("error", "", message);
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
      await this.reload();

      // 冲突条目由拉取时的合并给出：冷启动不再用「不知道发生了什么」的提示。
      if (result.pulled.conflicts.length > 0) {
        this.conflicts.set(result.pulled.conflicts);
        this.phase.set("conflict");
      } else {
        this.phase.set("idle");
      }
    } catch (error) {
      this.errorMessage.set(
        error instanceof RemoteVaultMismatchError
          ? this.i18n.t("backupBucketInUse")
          : this.i18n.t("backupSyncFailed"),
      );
      this.phase.set("error");
    } finally {
      this.busy.set(false);
    }
  }

  protected dismissConflict(): void {
    this.phase.set("idle");
    this.conflicts.set([]);
  }

  protected back(): void {
    void this.router.navigateByUrl(this.configView() ? "/backup-settings" : "/tabs/settings");
  }

  protected goConfig(): void {
    void this.router.navigateByUrl("/backup-config");
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
    this.form.reset({ region: "auto" });
    this.savedConfig.set(null);
    this.status.set({ lastSyncedAt: null, lastBackupAt: null });
    this.snapshots.set([]);
    this.configured.set(false);
    this.phase.set("idle");
    this.conflicts.set([]);
    this.errorMessage.set(null);
  }

  private async reload(): Promise<void> {
    await this.refreshStatus();
    await this.refreshSnapshots();
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

  private async refreshSnapshots(): Promise<void> {
    const userId = await this.userId();
    const client = await this.syncService.clientFor(userId);
    if (!client) {
      this.snapshots.set([]);
      return;
    }

    try {
      const objects = await client.listObjects(SNAPSHOT_PREFIX);
      const rows = objects
        .filter((object) => object.key.endsWith(".json"))
        .map((object) => ({
          id:
            object.key
              .split("/")
              .pop()
              ?.replace(/\.json$/, "") ?? object.key,
          size: object.size ?? 0,
        }))
        .sort((a, b) => b.id.localeCompare(a.id))
        .map((row, index) => ({ ...row, latest: index === 0 }));
      this.snapshots.set(rows);
    } catch {
      // 列不出来通常只是配置/权限问题，页面仍可用，错误不带到全局。
      this.snapshots.set([]);
    }
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}
