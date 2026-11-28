import { mock } from "jest-mock-extended";

import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";

import { TrashMaintenanceService } from "./trash-maintenance.service";
import { TRASH_SWEEP_INTERVAL_MS, TrashSweepScheduler } from "./trash-sweep.scheduler";

describe("TrashSweepScheduler", () => {
  const userId = "user-id" as UserId;
  const otherUserId = "other-user-id" as UserId;

  const trashMaintenance = mock<TrashMaintenanceService>();
  const logService = mock<LogService>();

  const createScheduler = () => new TrashSweepScheduler(trashMaintenance, logService);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    trashMaintenance.isLocalAccount.mockResolvedValue(true);
    trashMaintenance.purgeExpiredTrash.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("purges the tracked user on every interval", async () => {
    const scheduler = createScheduler();
    await scheduler.start(userId);

    // 解锁流程已经清理过一次，计时器的第一次巡检要等满一个间隔。
    expect(trashMaintenance.purgeExpiredTrash).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);
    expect(trashMaintenance.purgeExpiredTrash).toHaveBeenCalledTimes(1);
    expect(trashMaintenance.purgeExpiredTrash).toHaveBeenCalledWith(userId);

    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);
    expect(trashMaintenance.purgeExpiredTrash).toHaveBeenCalledTimes(2);
  });

  it("does not stack timers when start is called repeatedly", async () => {
    const scheduler = createScheduler();
    await scheduler.start(userId);
    await scheduler.start(userId);
    await scheduler.start(userId);

    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);

    expect(trashMaintenance.purgeExpiredTrash).toHaveBeenCalledTimes(1);
  });

  it("retargets the sweep to the most recently unlocked user", async () => {
    const scheduler = createScheduler();
    await scheduler.start(userId);
    await scheduler.start(otherUserId);

    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);

    expect(trashMaintenance.purgeExpiredTrash).toHaveBeenCalledTimes(1);
    expect(trashMaintenance.purgeExpiredTrash).toHaveBeenCalledWith(otherUserId);
  });

  it("does not start a timer for a non-local account", async () => {
    trashMaintenance.isLocalAccount.mockResolvedValue(false);
    const scheduler = createScheduler();

    await scheduler.start(userId);
    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);

    expect(trashMaintenance.purgeExpiredTrash).not.toHaveBeenCalled();
  });

  it("stops the sweep when a non-local account becomes the tracked user", async () => {
    const scheduler = createScheduler();
    await scheduler.start(userId);

    trashMaintenance.isLocalAccount.mockResolvedValue(false);
    await scheduler.start(otherUserId);

    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);

    expect(trashMaintenance.purgeExpiredTrash).not.toHaveBeenCalled();
  });

  it("does nothing when there is no tracked user", async () => {
    const scheduler = createScheduler();

    await scheduler.sweepNow();

    expect(trashMaintenance.purgeExpiredTrash).not.toHaveBeenCalled();
  });

  it("stops sweeping after stop", async () => {
    const scheduler = createScheduler();
    await scheduler.start(userId);

    scheduler.stop();
    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);

    expect(trashMaintenance.purgeExpiredTrash).not.toHaveBeenCalled();
  });

  it("does not reject when a sweep fails and logs no item data", async () => {
    const error = new Error("storage failure");
    trashMaintenance.purgeExpiredTrash.mockRejectedValue(error);
    const scheduler = createScheduler();
    await scheduler.start(userId);

    await expect(scheduler.sweepNow()).resolves.toBeUndefined();

    // 巡检失败不能影响解锁、同步或界面；日志里只有通用信息，没有条目字段。
    expect(logService.error).toHaveBeenCalledWith("Failed to sweep expired trash items", error);
  });

  it("swallows a failed local-account lookup and does not start a timer", async () => {
    trashMaintenance.isLocalAccount.mockRejectedValue(new Error("storage failure"));
    const scheduler = createScheduler();

    await expect(scheduler.start(userId)).resolves.toBeUndefined();
    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);

    expect(trashMaintenance.purgeExpiredTrash).not.toHaveBeenCalled();
  });

  it("lets stop cancel a start that is still checking the account", async () => {
    let resolveLocal: (value: boolean) => void = () => {
      /* replaced below */
    };
    trashMaintenance.isLocalAccount.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveLocal = resolve;
      }),
    );
    const scheduler = createScheduler();

    const startPromise = scheduler.start(userId);
    scheduler.stop();
    resolveLocal(true);
    await startPromise;

    await jest.advanceTimersByTimeAsync(TRASH_SWEEP_INTERVAL_MS);

    expect(trashMaintenance.purgeExpiredTrash).not.toHaveBeenCalled();
  });
});
