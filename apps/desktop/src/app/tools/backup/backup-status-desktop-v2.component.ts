import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LpPageHeaderComponent, LpToastService } from "@localpass/angular/local-ui";
import { formatBackupTimestamp, formatSnapshotId } from "@localpass/angular/tools/backup";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { getUserId } from "@localpass/common/auth/services/account.service";
import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { ButtonModule, CalloutModule, IconModule } from "@localpass/components";
import {
  SNAPSHOT_PREFIX,
  VaultBackupService,
  VaultBackupSyncService,
} from "@localpass/local-vault";

interface SnapshotRow {
  readonly id: string;
  readonly size: number;
  readonly latest: boolean;
}

/**
 * 桌面端云备份状态页。
 *
 * 只在进入页面、同步或备份时访问存储；没有定时器。快照列表来自配置的 S3 桶，
 * 读取的是对象元数据，不解密、不写日志。
 */
@Component({
  selector: "backup-status-desktop-v2",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-h-full" },
  imports: [ButtonModule, CalloutModule, IconModule, LpPageHeaderComponent],
  template: `
    <div class="tw-flex tw-h-full tw-flex-col tw-bg-background-alt">
      <lp-page-header [title]="i18n.t('backupTitle')" [sub]="i18n.t('backupSubtitle')">
        <button
          type="button"
          bitButton
          buttonType="secondary"
          startIcon="bwi-settings"
          data-testid="backup_config_link"
          (click)="go('/backup-config')"
        >
          {{ i18n.t("backupStorage") }}
        </button>
        <button
          type="button"
          bitButton
          buttonType="primary"
          startIcon="bwi-download"
          [disabled]="busy() || !configured()"
          [loading]="busy()"
          data-testid="backup_sync_now"
          (click)="syncNow()"
        >
          {{ i18n.t("syncNow") }}
        </button>
      </lp-page-header>

      <div class="tw-min-h-0 tw-flex-1 tw-overflow-y-auto tw-px-7 tw-pb-7">
        @if (!loading() && !configured()) {
          <div class="tw-mb-4">
            <bit-callout type="warning" [title]="null">{{
              i18n.t("backupNotConfigured")
            }}</bit-callout>
          </div>
        }

        <div class="tw-flex tw-items-start tw-gap-4">
          <div
            class="tw-min-w-0 tw-flex-1 tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
              {{ i18n.t("backupStatus") }}
            </h2>
            <p class="tw-mb-0 tw-mt-1 tw-text-xs tw-text-muted">{{ lastSyncSummary() }}</p>

            <div class="tw-mt-4 tw-flex tw-gap-3">
              <div
                class="tw-flex tw-flex-1 tw-flex-col tw-gap-0.5 tw-rounded-lg tw-border tw-border-border-light tw-px-4 tw-py-3"
              >
                <span class="tw-text-xl tw-font-semibold tw-text-main">{{
                  snapshots().length
                }}</span>
                <span class="tw-text-xs tw-text-muted">{{ i18n.t("backupSnapshots") }}</span>
              </div>
              <div
                class="tw-flex tw-flex-1 tw-flex-col tw-gap-0.5 tw-rounded-lg tw-border tw-border-border-light tw-px-4 tw-py-3"
              >
                <span class="tw-text-xl tw-font-semibold tw-text-main">{{ latestSize() }}</span>
                <span class="tw-text-xs tw-text-muted">{{ i18n.t("backupLatestSize") }}</span>
              </div>
              <div
                class="tw-flex tw-flex-1 tw-flex-col tw-gap-0.5 tw-rounded-lg tw-border tw-border-border-light tw-px-4 tw-py-3"
              >
                <span class="tw-text-xl tw-font-semibold tw-text-main">{{
                  i18n.t("backupManualShort")
                }}</span>
                <span class="tw-text-xs tw-text-muted">{{ i18n.t("backupSyncMode") }}</span>
              </div>
            </div>

            <div class="tw-mt-4 tw-flex tw-gap-2">
              <button
                type="button"
                bitButton
                buttonType="secondary"
                [disabled]="busy() || !configured()"
                data-testid="backup_backup_now"
                (click)="backupNow()"
              >
                {{ i18n.t("backupNow") }}
              </button>
              <button type="button" bitButton buttonType="secondary" (click)="go('/restore')">
                {{ i18n.t("restoreFromBackup") }}
              </button>
            </div>

            <p class="tw-mb-0 tw-mt-4 tw-text-xs tw-leading-relaxed tw-text-muted">
              {{ i18n.t("backupFootnoteButton") }}
            </p>

            @if (errorMessage()) {
              <p class="tw-mb-0 tw-mt-3 tw-text-xs tw-text-fg-danger">{{ errorMessage() }}</p>
            }
          </div>

          <div
            class="tw-w-5/12 tw-flex-none tw-rounded-xl tw-border tw-border-border-light tw-bg-background tw-p-4 tw-shadow-sm"
          >
            <h2 class="tw-m-0 tw-text-sm tw-font-semibold tw-text-main">
              {{ i18n.t("backupRecentSnapshots") }}
            </h2>
            @if (snapshots().length === 0) {
              <p class="tw-mb-0 tw-mt-3 tw-text-sm tw-text-muted">
                {{ i18n.t("backupNoSnapshots") }}
              </p>
            } @else {
              <div
                class="tw-mt-3 tw-overflow-hidden tw-rounded-xl tw-border tw-border-border-light tw-bg-background"
              >
                @for (snapshot of snapshots(); track snapshot.id) {
                  <div
                    class="tw-flex tw-min-h-12 tw-items-center tw-gap-3 tw-border-b tw-border-border-light tw-px-3 tw-py-2.5 last:tw-border-b-0"
                  >
                    <span
                      class="tw-grid tw-size-8 tw-flex-none tw-place-items-center tw-rounded-lg tw-bg-bg-brand-softer tw-text-fg-brand"
                    >
                      <bit-icon name="bwi-download" class="tw-text-base"></bit-icon>
                    </span>
                    <span class="tw-min-w-0 tw-flex-1">
                      <span class="tw-flex tw-items-center tw-gap-2">
                        <span class="tw-truncate tw-text-sm tw-text-main">{{
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
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class BackupStatusDesktopV2Component implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly syncService = inject(VaultBackupSyncService);
  private readonly backupService = inject(VaultBackupService);
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(LpToastService);
  private readonly router = inject(Router);
  private readonly locale = toSignal(this.i18n.locale$, { initialValue: "en" });

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly configured = signal(false);
  protected readonly snapshots = signal<SnapshotRow[]>([]);
  protected readonly lastSyncedAt = signal<string | null>(null);
  protected readonly storageHost = signal("");
  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.loading.set(false);
  }

  protected lastSyncSummary(): string {
    const time = formatBackupTimestamp(this.lastSyncedAt(), this.locale(), this.i18n);
    const host = this.storageHost();
    return host ? this.i18n.t("backupLastSyncSummary", time, host) : time;
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

  protected async syncNow(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      await this.syncService.sync(await this.userId());
      await this.reload();
      this.toast.show(this.i18n.t("backupUploaded"));
    } catch {
      this.errorMessage.set(this.i18n.t("backupSyncFailed"));
    } finally {
      this.busy.set(false);
    }
  }

  protected async backupNow(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const result = await this.backupService.backupNow(await this.userId());
      await this.reload();
      this.toast.show(this.i18n.t(result.uploaded ? "backupUploaded" : "backupFailed"));
    } catch {
      this.errorMessage.set(this.i18n.t("backupFailed"));
    } finally {
      this.busy.set(false);
    }
  }

  protected go(route: string): void {
    void this.router.navigateByUrl(route);
  }

  private async reload(): Promise<void> {
    const userId = await this.userId();
    const [config, state] = await Promise.all([
      this.syncService.getConfig(userId),
      this.syncService.getSyncState(userId),
    ]);
    this.configured.set(config != null);
    this.lastSyncedAt.set(state.lastSyncedAt);
    this.storageHost.set(config ? hostOf(config.endpoint) : "");

    if (!config) {
      this.snapshots.set([]);
      return;
    }

    try {
      const client = await this.syncService.clientFor(userId);
      if (!client) {
        this.snapshots.set([]);
        return;
      }
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
      // 列不出来通常只是配置/权限问题，状态页仍可用，错误不带到全局。
      this.snapshots.set([]);
      this.errorMessage.set(this.i18n.t("backupTestFailed"));
    }
  }

  private async userId() {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host.toLowerCase();
  } catch {
    return endpoint;
  }
}
