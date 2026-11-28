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
  PendingVaultConflict,
  RemoteSnapshotUnavailableError,
  RemoteVaultMismatchError,
  S3Client,
  SNAPSHOT_PREFIX,
  VaultBackupConfig,
  VaultBackupService,
  VaultBackupSyncService,
} from "@localpass/local-vault";

import { LpPageHeaderComponent, LpPopupHeaderComponent, LpToastService } from "../../local-ui";

import { BackupConflictResolutionV2Component } from "./backup-conflict-resolution.component";
import { formatBackupTimestamp, formatSnapshotId } from "./backup-time";

interface BackupStatus {
  readonly lastSyncedAt: string | null;
  readonly lastBackupAt: string | null;
  /** Manifest generation of the last snapshot this device adopted or wrote; null before any sync. */
  readonly generation: number | null;
}

interface SnapshotRow {
  readonly id: string;
  readonly size: number;
  readonly latest: boolean;
}

type ConfigKey = "endpoint" | "region" | "bucket" | "accessKeyId" | "secretAccessKey";

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
    BackupConflictResolutionV2Component,
  ],
  template: `
    <div class="agy tw-flex tw-h-full tw-flex-col tw-bg-background">
      @if (compact()) {
        <lp-popup-header
          [title]="configView() ? i18n.t('backupStorage') : i18n.t('backupTitle')"
          [sub]="configView() ? i18n.t('backupConfigSubtitle') : i18n.t('backupSubtitle')"
          [back]="showBack()"
          (backTriggered)="back()"
        >
          @if (!configView()) {
            <div slot="actions">
              <button
                type="button"
                class="agy-iconbtn"
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
          <div class="agy-grp">
            @for (field of configFields; track field.key) {
              <div class="agy-formrow">
                <label
                  class="agy-ext-field tw-cursor-default"
                  [attr.for]="'backup-form_input_' + field.key"
                >
                  <span class="agy-k tw-truncate" [attr.title]="i18n.t(field.labelKey)">{{
                    i18n.t(field.labelKey)
                  }}</span>
                  <input
                    [id]="'backup-form_input_' + field.key"
                    class="agy-input"
                    [class.agy-mono]="field.mono"
                    [type]="field.password && !secretVisible() ? 'password' : 'text'"
                    autocomplete="off"
                    [value]="valueOf(field.key)"
                    (input)="onConfigInput(field.key, $event)"
                  />
                  @if (field.password) {
                    <button
                      type="button"
                      class="agy-iconbtn agy-sm"
                      [attr.aria-label]="
                        secretVisible() ? i18n.t('hideValue') : i18n.t('showValue')
                      "
                      (click)="secretVisible.set(!secretVisible())"
                    >
                      <bit-icon
                        [name]="secretVisible() ? 'bwi-visibility-off' : 'bwi-visibility'"
                        class="tw-text-xs"
                      ></bit-icon>
                    </button>
                  } @else {
                    <span></span>
                  }
                </label>
              </div>
            }
          </div>
        </ng-template>

        <ng-template #corsGuide>
          <div
            class="tw-mt-3 tw-rounded-lg tw-border tw-border-border-light tw-bg-background-alt tw-p-3"
          >
            <div class="tw-flex tw-items-center tw-gap-2">
              <span class="tw-text-xs tw-font-semibold tw-text-main">{{
                i18n.t("r2CorsPolicy")
              }}</span>
              <button
                type="button"
                class="agy-btn agy-sm tw-ms-auto"
                data-testid="backup_copy_cors"
                (click)="copyCorsPolicy()"
              >
                {{ i18n.t("copy") }}
              </button>
            </div>
            <p class="tw-mb-0 tw-mt-1 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("r2CorsHint") }}
            </p>
            <pre class="agy-diag tw-m-0 tw-mt-2 tw-max-h-48">{{ corsPolicy }}</pre>
          </div>
        </ng-template>

        @if (compact()) {
          <div class="agy-ext-scroll">
            <ng-container [ngTemplateOutlet]="configForm"></ng-container>
            <div class="agy-callout tw-mt-2">
              <bit-icon name="bwi-info-circle" class="tw-text-xs tw-text-fg-brand"></bit-icon>
              <div>{{ i18n.t("backupCredentialNote") }}</div>
            </div>
            <ng-container [ngTemplateOutlet]="corsGuide"></ng-container>
            @if (configured() && !dirty()) {
              <button
                type="button"
                class="agy-btn agy-danger agy-block tw-mt-2"
                (click)="disconnect()"
              >
                {{ i18n.t("disconnectBackup") }}
              </button>
            } @else if (dirty()) {
              <p class="agy-hint tw-pt-2">
                {{ i18n.t("backupUnsavedChanges") }}
              </p>
            }
            @if (errorMessage()) {
              <p class="agy-hint agy-hint-error">{{ errorMessage() }}</p>
            }
          </div>
          <div class="agy-ext-foot">
            <button
              type="button"
              class="agy-btn agy-primary agy-lg tw-flex-1"
              [disabled]="busy()"
              data-testid="backup_save_config"
              (click)="save()"
            >
              {{ i18n.t("backupSaveConfig") }}
            </button>
            <button
              type="button"
              class="agy-btn agy-lg tw-flex-1"
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
              <ng-container [ngTemplateOutlet]="corsGuide"></ng-container>
            </aside>
          </div>
        }
      } @else {
        <div class="agy-ext-scroll">
          <div class="agy-callout">
            <span
              class="tw-mt-1 tw-size-2 tw-flex-none tw-rounded-full"
              [class.tw-bg-bg-success]="statusSettled()"
              [class.tw-bg-bg-warning]="!statusSettled()"
              aria-hidden="true"
            ></span>
            <div>
              <div class="agy-k">{{ statusTitle() }}</div>
              <div class="agy-d">{{ statusSubtitle() }}</div>
            </div>
          </div>

          <div class="tw-grid tw-grid-cols-3 tw-gap-1.5 tw-pt-2">
            <div class="agy-stat">
              <div class="agy-n">{{ snapshots().length }}</div>
              <div class="agy-l">{{ i18n.t("backupSnapshots") }}</div>
            </div>
            <div class="agy-stat">
              <div class="agy-n">{{ latestSize() }}</div>
              <div class="agy-l">{{ i18n.t("backupLatestSize") }}</div>
            </div>
            <div class="agy-stat">
              <div class="agy-n">{{ i18n.t("backupManual") }}</div>
              <div class="agy-l">{{ i18n.t("backupMode") }}</div>
            </div>
          </div>

          <button
            type="button"
            class="agy-btn agy-primary agy-lg agy-block tw-mt-2"
            [disabled]="busy() || !configured() || pendingConflicts().length > 0"
            data-testid="backup_sync_now"
            (click)="syncNow()"
          >
            {{ i18n.t("syncNow") }}
          </button>
          <button
            type="button"
            class="agy-btn agy-lg agy-block tw-mt-1"
            [disabled]="busy() || !configured()"
            data-testid="backup_backup_now"
            (click)="backupNow()"
          >
            {{ i18n.t("backupNow") }}
          </button>
          @if (compact()) {
            <button
              type="button"
              class="agy-btn agy-lg agy-block tw-mt-1"
              [disabled]="busy()"
              data-testid="backup_go_restore"
              (click)="goRestore()"
            >
              {{ i18n.t("restoreFromBackup") }}
            </button>
          }
          <p class="agy-hint tw-pl-0">
            {{ i18n.t("backupActionHint") }}
          </p>

          @if (pendingConflicts().length > 0) {
            <backup-conflict-resolution-v2
              [conflicts]="pendingConflicts()"
              [compact]="compact()"
              (resolved)="onConflictResolved()"
            ></backup-conflict-resolution-v2>
          }

          @if (errorMessage()) {
            <div class="tw-flex tw-flex-col tw-items-start tw-gap-2">
              <p class="agy-hint agy-hint-error">{{ errorMessage() }}</p>
              @if (canRepair()) {
                <button
                  type="button"
                  bitButton
                  buttonType="danger"
                  [disabled]="busy()"
                  data-testid="backup_repair_remote"
                  (click)="repair()"
                >
                  {{ i18n.t("syncConflictKeepLocal") }}
                </button>
              }
            </div>
          }

          <h2 class="agy-seclbl tw-pt-2">{{ i18n.t("backupRecentSnapshots") }}</h2>
          <div class="agy-grp">
            @if (snapshots().length === 0) {
              <div class="agy-setrow">
                <span class="agy-d">{{ i18n.t("backupNoSnapshots") }}</span>
              </div>
            } @else {
              @for (snapshot of snapshots(); track snapshot.id) {
                <div class="agy-setrow">
                  <span class="agy-iconbtn agy-sm tw-bg-background-alt">
                    <bit-icon name="bwi-download" class="tw-text-xs"></bit-icon>
                  </span>
                  <span class="tw-min-w-0 tw-flex-1">
                    <span class="tw-flex tw-items-center tw-gap-1.5">
                      <span class="agy-k tw-truncate">{{ snapshotLabel(snapshot.id) }}</span>
                      @if (snapshot.latest) {
                        <span class="agy-chip agy-ok">{{ i18n.t("backupLatest") }}</span>
                      }
                    </span>
                    <span class="agy-d tw-block">{{ formatSize(snapshot.size) }}</span>
                  </span>
                </div>
              }
            }
          </div>

          <p class="agy-hint tw-text-center">
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
  private readonly toast = inject(LpToastService);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });

  protected readonly compact = signal(this.route.snapshot.data["compact"] === true);
  /** 桌面端把同一个组件拆成「状态」与「存储配置」两页；弹窗用独立路由打开配置页。 */
  protected readonly configView = computed(
    () => this.route.snapshot.data["backupView"] === "config",
  );
  /** 扩展底部标签页 `/tabs/sync` 是顶级视图，不显示返回键；二级页才显示返回键。 */
  protected readonly showBack = computed(
    () => this.configView() || !this.router.url.startsWith("/tabs/"),
  );
  protected readonly configured = signal(false);
  protected readonly secretVisible = signal(false);

  protected readonly configFields: readonly ConfigField[] = [
    { key: "endpoint", labelKey: "backupEndpoint", mono: true, password: false },
    { key: "region", labelKey: "backupRegion", mono: true, password: false },
    { key: "bucket", labelKey: "backupBucket", mono: true, password: false },
    { key: "accessKeyId", labelKey: "backupAccessKey", mono: true, password: false },
    { key: "secretAccessKey", labelKey: "backupSecretKey", mono: true, password: true },
  ];

  /** 桌面渲染进程直连 R2 会走浏览器 CORS 检查；扩展有主机权限，但加了不影响。 */
  protected readonly corsPolicy = [
    "[",
    "  {",
    '    "AllowedOrigins": ["*"],',
    '    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],',
    '    "AllowedHeaders": ["*"],',
    '    "ExposeHeaders": ["ETag"],',
    '    "MaxAgeSeconds": 3600',
    "  }",
    "]",
  ].join("\n");

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

  protected readonly status = signal<BackupStatus>({
    lastSyncedAt: null,
    lastBackupAt: null,
    generation: null,
  });
  protected readonly snapshots = signal<readonly SnapshotRow[]>([]);
  /**
   * Local records that differ from the last snapshot this device synced. The count is read from
   * local state alone, so it stays accurate whether or not the bucket is reachable right now.
   * 「立即备份」写的是导出文件，不推进同步基线，所以备份完成后这个数不会归零。
   */
  protected readonly pendingChanges = signal(0);
  protected readonly statusSettled = computed(
    () =>
      this.configured() &&
      this.status().lastSyncedAt != null &&
      this.pendingChanges() === 0 &&
      this.pendingConflicts().length === 0 &&
      this.phase() === "idle",
  );
  protected readonly statusTitle = computed(() => {
    if (!this.configured()) {
      return this.i18n.t("backupNotConfigured");
    }
    const pending = this.pendingChanges();
    if (pending > 0) {
      return pending === 1
        ? this.i18n.t("backupPendingChangeOne")
        : this.i18n.t("backupPendingChanges", pending.toString());
    }
    return this.status().lastSyncedAt == null
      ? this.i18n.t("backupConnectedR2")
      : this.i18n.t("backupSynced");
  });
  protected readonly statusSubtitle = computed(() => {
    if (!this.configured()) {
      return this.i18n.t("backupConfigPrompt");
    }
    const bucket = this.savedConfig()?.bucket;
    const lastSync = this.lastSyncLabel();
    const parts = [lastSync];
    if (bucket) {
      parts.push(this.i18n.t("backupBucketName", bucket));
    }
    const generation = this.generationLabel();
    if (generation) {
      parts.push(generation);
    }
    return parts.join(" · ");
  });
  /** 同步的两态：idle / loading / error；待解决冲突由独立信号驱动。 */
  protected readonly phase = signal<"idle" | "loading" | "error">("idle");
  protected readonly pendingConflicts = signal<readonly PendingVaultConflict[]>([]);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** True when the cloud copy is unreadable and the user can replace it with this device's vault. */
  protected readonly canRepair = signal(false);

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

  /** Prototype wording: `gen #42`, meaning the manifest revision this device last saw. */
  protected generationLabel(): string | null {
    const generation = this.status().generation;
    return generation == null ? null : this.i18n.t("backupGeneration", generation.toString());
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

  protected copyCorsPolicy(): void {
    this.platformUtilsService.copyToClipboard(this.corsPolicy);
    this.toast.show(this.i18n.t("r2CorsCopied"));
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
    this.toast.show(this.i18n.t("backupSaved"));
    await this.reload();
  }

  protected async testConnection(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set(this.i18n.t("backupFieldsRequired"));
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const value = this.form.getRawValue();
      const client = new S3Client({
        endpoint: (value.endpoint ?? "").trim(),
        region: (value.region ?? "auto").trim() || "auto",
        bucket: (value.bucket ?? "").trim(),
        forcePathStyle: false,
        credentials: {
          accessKeyId: (value.accessKeyId ?? "").trim(),
          secretAccessKey: value.secretAccessKey ?? "",
        },
      });
      await client.listObjects("");
      this.toast.show(this.i18n.t("backupTestOk"));
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
      this.toast.show(this.i18n.t(result.uploaded ? "backupUploaded" : "backupFailed"));
      await this.reload();
    } catch (error) {
      // 端点不可达、凭证无效、桶属于另一座库都走同一条回执；不要抛到 Angular 事件循环里。
      const message =
        error instanceof RemoteVaultMismatchError
          ? this.i18n.t("backupBucketInUse")
          : this.i18n.t("backupFailed");
      this.errorMessage.set(message);
      this.toast.show(message);
    } finally {
      this.busy.set(false);
    }
  }

  protected async syncNow(): Promise<void> {
    this.busy.set(true);
    this.phase.set("loading");
    this.errorMessage.set(null);
    this.canRepair.set(false);
    try {
      const userId = await this.userId();
      const result = await this.syncService.sync(userId);
      await this.reload();

      // 冲突条目先保存在本地状态里：刷新后仍能并排展示，等待用户三选一。
      if (this.pendingConflicts().length > 0) {
        this.phase.set("idle");
      } else if (!result.pushed.uploaded) {
        // 拉取成功但上传在多次清单竞争后放弃：本地仍领先远端，不能报「已同步」。
        this.errorMessage.set(this.i18n.t("backupSyncFailed"));
        this.phase.set("error");
      } else {
        this.phase.set("idle");
        this.toast.show(this.i18n.t("backupSynced"));
      }
    } catch (error) {
      if (error instanceof RemoteSnapshotUnavailableError) {
        // 云端清单或快照读不出来。提供显式的「用本机覆盖云端」修复；用户确认前不写任何对象。
        this.errorMessage.set(this.i18n.t("backupSyncFailed"));
        this.canRepair.set(true);
        this.phase.set("error");
        return;
      }
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

  /**
   * 用本机保险库替换读不出来的云端清单与快照。
   *
   * 只在同步因云端副本损坏而失败后提供，并且必须二次确认：被替换的云端版本既不能合并也不能读回。
   */
  protected async repair(): Promise<void> {
    if (this.busy()) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "backupTitle" },
      content: { key: "syncConflictKeepLocalHint" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const result = await this.syncService.repairRemote(await this.userId());
      await this.reload();
      if (!result.uploaded) {
        this.errorMessage.set(this.i18n.t("backupSyncFailed"));
        this.phase.set("error");
        return;
      }
      this.canRepair.set(false);
      this.phase.set("idle");
      this.toast.show(this.i18n.t("backupSynced"));
    } catch (error) {
      if (error instanceof RemoteVaultMismatchError) {
        this.canRepair.set(false);
        this.errorMessage.set(this.i18n.t("backupBucketInUse"));
      } else {
        this.errorMessage.set(this.i18n.t("backupSyncFailed"));
      }
      this.phase.set("error");
    } finally {
      this.busy.set(false);
    }
  }

  protected async onConflictResolved(): Promise<void> {
    await this.reload();
    this.toast.show(this.i18n.t("syncConflictResolved"));
    this.phase.set("idle");
  }

  protected back(): void {
    if (this.configView()) {
      void this.router.navigateByUrl(this.compact() ? "/tabs/sync" : "/backup-settings");
      return;
    }
    void this.router.navigateByUrl("/tabs/settings");
  }

  protected goConfig(): void {
    void this.router.navigateByUrl("/backup-config");
  }

  protected goRestore(): void {
    void this.router.navigateByUrl("/restore-vault");
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
    this.status.set({ lastSyncedAt: null, lastBackupAt: null, generation: null });
    this.snapshots.set([]);
    this.pendingChanges.set(0);
    this.configured.set(false);
    this.phase.set("idle");
    this.pendingConflicts.set([]);
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
      generation: state.generation,
    });
    this.pendingConflicts.set(await this.syncService.getPendingConflicts(userId));
    this.pendingChanges.set(
      this.configured() ? await this.syncService.countPendingChanges(userId) : 0,
    );
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
