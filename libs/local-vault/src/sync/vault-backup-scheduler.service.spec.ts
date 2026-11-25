import { UserId } from "@bitwarden/common/types/guid";

import { LocalAccountService } from "../account/local-account.service";

import { VaultBackupScheduler, VaultSchedulerAdapter } from "./vault-backup-scheduler.service";
import { VaultBackupSyncService } from "./vault-backup-sync.service";
import { VaultBackupService } from "./vault-backup.service";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;

class FakeAdapter implements VaultSchedulerAdapter {
  time = 0;
  readonly tasks: Array<{ fn: () => void; at: number; cancelled: boolean }> = [];

  now(): number {
    return this.time;
  }

  every(_intervalMs: number, task: () => void): unknown {
    this.tasks.push({ fn: task, at: this.time, cancelled: false });
    return this.tasks.length - 1;
  }

  after(delayMs: number, task: () => void): unknown {
    this.tasks.push({ fn: task, at: this.time + delayMs, cancelled: false });
    return this.tasks.length - 1;
  }

  cancel(handle: unknown): void {
    this.tasks[handle as number].cancelled = true;
  }

  /** Runs every due task once, then advances the clock. */
  advance(ms: number): void {
    this.time += ms;
    for (const task of this.tasks) {
      if (!task.cancelled && task.at <= this.time) {
        task.cancelled = true;
        task.fn();
      }
    }
  }
}

type Settings = { backupFrequency: "off" | "daily" | "weekly"; lastBackupAt: string | null };

function setup(settings: Settings) {
  const adapter = new FakeAdapter();
  const syncResult = {
    pulled: { applied: 0, upToDate: true },
    pushed: { uploaded: true, snapshotId: "s" },
  };
  const sync = jest.fn().mockResolvedValue(syncResult);

  const syncService = {
    markPending: jest.fn().mockResolvedValue(undefined),
    sync,
    getConfig: async () => ({ bucket: "vault" }),
  } as unknown as VaultBackupSyncService;

  const backupNow = jest.fn().mockResolvedValue({ uploaded: true, key: "backups/2026-11/x.json" });
  const backupService = {
    getSettings: async () => settings,
    backupNow,
    pruneBackups: jest.fn().mockResolvedValue(0),
  } as unknown as VaultBackupService;

  const scheduler = new VaultBackupScheduler(
    syncService,
    backupService,
    { isLocalAccount: async () => true } as unknown as LocalAccountService,
    adapter,
    { info: jest.fn(), error: jest.fn() } as any,
  );

  return { scheduler, adapter, sync, backupNow };
}

describe("VaultBackupScheduler", () => {
  it("coalesces a burst of writes into one upload", async () => {
    const { scheduler, adapter, sync } = setup({ backupFrequency: "off", lastBackupAt: null });
    scheduler.trackUser(userId);

    scheduler.notifyLocalChange(userId);
    scheduler.notifyLocalChange(userId);
    scheduler.notifyLocalChange(userId);
    adapter.advance(VaultBackupScheduler.CHANGE_DEBOUNCE_MS);

    // Let the fire-and-forget promise settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("skips syncing when cloud storage is not configured", async () => {
    const { sync } = setup({ backupFrequency: "off", lastBackupAt: null });
    const unconfigured = new VaultBackupScheduler(
      { markPending: jest.fn(), sync: jest.fn(), getConfig: async () => null } as any,
      { getSettings: async () => ({ backupFrequency: "off", lastBackupAt: null }) } as any,
      { isLocalAccount: async () => true } as any,
      new FakeAdapter(),
      { info: jest.fn(), error: jest.fn() } as any,
    );

    await expect(unconfigured.syncNow(userId)).resolves.toBeNull();
    expect(sync).not.toHaveBeenCalled();
  });

  it("uploads a backup when the period has passed", async () => {
    const { scheduler, backupNow } = setup({
      backupFrequency: "daily",
      lastBackupAt: "2026-11-20T00:00:00.000Z",
    });
    (scheduler as any).adapter.time = Date.parse("2026-11-24T00:00:00.000Z");

    await expect(scheduler.runBackupIfDue(userId)).resolves.toBe(true);
    expect(backupNow).toHaveBeenCalledWith(userId);
  });

  it("does not upload a backup twice in one period", async () => {
    const { scheduler, backupNow } = setup({
      backupFrequency: "daily",
      lastBackupAt: "2026-11-24T00:00:00.000Z",
    });
    (scheduler as any).adapter.time = Date.parse("2026-11-24T06:00:00.000Z");

    await expect(scheduler.runBackupIfDue(userId)).resolves.toBe(false);
    expect(backupNow).not.toHaveBeenCalled();
  });
});
