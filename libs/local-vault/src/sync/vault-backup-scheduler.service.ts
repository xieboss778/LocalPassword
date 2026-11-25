import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { LocalAccountService } from "../account/local-account.service";

import { VaultBackupService } from "./vault-backup.service";
import { SyncResult, VaultBackupSyncService } from "./vault-backup-sync.service";

/**
 * The timers a scheduler needs. The extension supplies `chrome.alarms`, the desktop its main
 * process; nothing here knows which device it runs on.
 */
export interface VaultSchedulerAdapter {
  now(): number;
  every(intervalMs: number, task: () => void): unknown;
  cancel(handle: unknown): void;
  after(delayMs: number, task: () => void): unknown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decides when a local vault talks to storage: shortly after a write, every half hour while it is
 * open, and once per backup period for the timestamped export.
 */
export class VaultBackupScheduler {
  /** A burst of writes produces one upload. */
  static readonly CHANGE_DEBOUNCE_MS = 15_000;
  /** Periodic check while the vault is unlocked. */
  static readonly CHECK_INTERVAL_MS = 30 * 60 * 1000;

  private intervalHandle: unknown = null;
  private debounceHandle: unknown = null;
  private debounceUserId: UserId | null = null;
  /** The user the periodic check acts for; set once the vault is unlocked. */
  private lastKnownUserId: UserId | null = null;

  constructor(
    private readonly syncService: VaultBackupSyncService,
    private readonly backupService: VaultBackupService,
    private readonly localAccountService: LocalAccountService,
    private readonly adapter: VaultSchedulerAdapter,
    private readonly logService: LogService,
  ) {}

  /** Starts the periodic check. Safe to call more than once. */
  start(): void {
    if (this.intervalHandle != null) {
      return;
    }
    this.intervalHandle = this.adapter.every(VaultBackupScheduler.CHECK_INTERVAL_MS, () => {
      void this.runScheduledCheck();
    });
  }

  stop(): void {
    if (this.intervalHandle != null) {
      this.adapter.cancel(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this.debounceHandle != null) {
      this.adapter.cancel(this.debounceHandle);
      this.debounceHandle = null;
      this.debounceUserId = null;
    }
  }

  /** Called after every local write; coalesces bursts into one upload. */
  notifyLocalChange(userId: UserId): void {
    void this.syncService.markPending(userId);

    if (this.debounceHandle != null) {
      this.adapter.cancel(this.debounceHandle);
    }
    this.debounceUserId = userId;
    this.debounceHandle = this.adapter.after(VaultBackupScheduler.CHANGE_DEBOUNCE_MS, () => {
      this.debounceHandle = null;
      const pendingUserId = this.debounceUserId;
      this.debounceUserId = null;
      if (pendingUserId != null) {
        void this.syncNow(pendingUserId);
      }
    });
  }

  /** Runs a sync immediately, e.g. the "sync now" button. */
  async syncNow(userId: UserId): Promise<SyncResult | null> {
    if (!(await this.isDistributable(userId))) {
      return null;
    }

    try {
      return await this.syncService.sync(userId);
    } catch (error) {
      this.logService.error("Vault cloud sync failed", error);
      return null;
    }
  }

  /** Syncs, then uploads a timestamped backup when the configured period has passed. */
  async runScheduledCheck(): Promise<void> {
    const userId = this.activeUserId();
    if (userId == null || !(await this.isDistributable(userId))) {
      return;
    }

    await this.syncNow(userId);
    await this.runBackupIfDue(userId);
  }

  async runBackupIfDue(userId: UserId): Promise<boolean> {
    const settings = await this.backupService.getSettings(userId);
    if (settings.backupFrequency === "off") {
      return false;
    }

    const period = settings.backupFrequency === "weekly" ? 7 * DAY_MS : DAY_MS;
    const last = settings.lastBackupAt == null ? null : Date.parse(settings.lastBackupAt);
    if (last != null && this.adapter.now() - last < period) {
      return false;
    }

    try {
      const result = await this.backupService.backupNow(userId);
      if (result.uploaded) {
        await this.backupService.pruneBackups(userId);
      }
      return result.uploaded;
    } catch (error) {
      this.logService.error("Vault backup upload failed", error);
      return false;
    }
  }

  /** Remembers the user so the periodic check has someone to act for. */
  trackUser(userId: UserId): void {
    this.lastKnownUserId = userId;
  }

  private activeUserId(): UserId | null {
    return this.debounceUserId ?? this.lastKnownUserId;
  }

  private async isDistributable(userId: UserId): Promise<boolean> {
    if (!(await this.localAccountService.isLocalAccount(userId))) {
      return false;
    }
    return (await this.syncService.getConfig(userId)) != null;
  }
}
