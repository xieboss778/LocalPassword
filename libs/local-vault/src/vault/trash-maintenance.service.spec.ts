import { mock } from "jest-mock-extended";
import { defer, of } from "rxjs";

import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";
import { LocalVaultWriter } from "@localpass/common/vault/abstractions/local-vault-writer.abstraction";
import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { StateProvider } from "@localpass/state";

import { TRASH_RETENTION_DAYS, TrashMaintenanceService } from "./trash-maintenance.service";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("TrashMaintenanceService", () => {
  const userId = "user-id" as UserId;
  const now = new Date("2026-06-01T12:00:00.000Z");

  const localVaultWriter = mock<LocalVaultWriter>();
  const stateProvider = mock<StateProvider>();
  const logService = mock<LogService>();

  let state: Record<string, CipherData>;

  const createService = () =>
    new TrashMaintenanceService(localVaultWriter, stateProvider, logService);

  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();

  const item = (id: string, deletedDate?: string) =>
    ({
      id,
      creationDate: now.toISOString(),
      revisionDate: now.toISOString(),
      deletedDate,
    }) as CipherData;

  const givenState = () => {
    // `defer` reads the latest `state`, so a test can replace the record after `beforeEach`.
    stateProvider.getUser.mockImplementation(() => ({ state$: defer(() => of(state)) }) as any);
  };

  beforeEach(() => {
    jest.resetAllMocks();
    state = {};
    localVaultWriter.isLocalAccount.mockResolvedValue(true);
    localVaultWriter.deleteManyCiphers.mockResolvedValue(true);
    givenState();
  });

  it("permanently deletes items deleted 30 or more days ago", async () => {
    state = {
      "old-id": item("old-id", daysAgo(31)),
      "boundary-id": item("boundary-id", daysAgo(TRASH_RETENTION_DAYS)),
    };

    const count = await createService().purgeExpiredTrash(userId, now);

    expect(count).toBe(2);
    expect(localVaultWriter.deleteManyCiphers).toHaveBeenCalledWith(
      ["old-id", "boundary-id"],
      userId,
    );
  });

  it("keeps an item that is one millisecond short of the retention window", async () => {
    state = {
      "recent-id": item(
        "recent-id",
        new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS + 1).toISOString(),
      ),
    };

    const count = await createService().purgeExpiredTrash(userId, now);

    // 界面在删除满 30 整天时显示「剩 0 天」，所以恰好 30 天前删除的条目要清理，差 1ms 则留下。
    expect(count).toBe(0);
    expect(localVaultWriter.deleteManyCiphers).not.toHaveBeenCalled();
  });

  it("ignores deleted dates that are missing, invalid or in the future", async () => {
    state = {
      "live-id": item("live-id"),
      "broken-id": item("broken-id", "not-a-date"),
      "future-id": item("future-id", new Date(now.getTime() + DAY_MS).toISOString()),
    };

    const count = await createService().purgeExpiredTrash(userId, now);

    expect(count).toBe(0);
    expect(localVaultWriter.deleteManyCiphers).not.toHaveBeenCalled();
  });

  it("ignores non-deleted items even when they are older than the retention window", async () => {
    state = {
      "live-id": item("live-id"),
    };

    await createService().purgeExpiredTrash(userId, now);

    expect(localVaultWriter.deleteManyCiphers).not.toHaveBeenCalled();
  });

  it("does nothing for an account that is not a local vault", async () => {
    state = { "old-id": item("old-id", daysAgo(31)) };
    localVaultWriter.isLocalAccount.mockResolvedValue(false);

    const count = await createService().purgeExpiredTrash(userId, now);

    expect(count).toBe(0);
    expect(stateProvider.getUser).not.toHaveBeenCalled();
    expect(localVaultWriter.deleteManyCiphers).not.toHaveBeenCalled();
  });

  it("does not throw and logs no item data when the delete fails", async () => {
    state = { "old-id": item("old-id", daysAgo(31)) };
    localVaultWriter.deleteManyCiphers.mockRejectedValue(new Error("storage failure"));

    await expect(createService().purgeExpiredTrash(userId, now)).resolves.toBe(0);

    // 维护失败不能中断解锁；日志里只有通用信息，没有条目字段。
    expect(logService.error).toHaveBeenCalledWith(
      "Failed to purge expired trash items",
      expect.any(Error),
    );
  });

  it("reports nothing deleted when the writer refused because the vault is not local", async () => {
    state = { "old-id": item("old-id", daysAgo(31)) };
    localVaultWriter.deleteManyCiphers.mockResolvedValue(false);

    const count = await createService().purgeExpiredTrash(userId, now);

    expect(count).toBe(0);
  });
});
