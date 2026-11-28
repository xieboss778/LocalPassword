import { of } from "rxjs";

import { UserId } from "@localpass/common/types/guid";

type MainBackgroundModule = typeof import("./main.background");

const loadMainBackground = (): MainBackgroundModule => jest.requireActual("./main.background");

// This test skips all the initialization of the background script and just
// focuses on making sure we don't accidentally delete the initialization of
// background vault syncing. This has happened before!
describe("MainBackground sync task scheduling", () => {
  it("includes code to schedule the sync interval task", () => {
    // Get the bootstrap method source code as string
    const { default: MainBackground } = loadMainBackground();
    const bootstrapSource = MainBackground.prototype.bootstrap.toString();

    // Check that the source includes the critical sync interval scheduling code
    expect(bootstrapSource).toContain("this.backgroundSyncService.init();");
  });
});

describe("MainBackground scheduled trash sweep", () => {
  const { default: MainBackground, TRASH_SWEEP_ALARM_NAME } = loadMainBackground();

  const purge = jest.fn();
  const logError = jest.fn();

  const fakeThis = (overrides: Record<string, unknown> = {}) => ({
    trashMaintenance: { purgeExpiredTrash: purge },
    accountService: { activeAccount$: of(null) },
    logService: { error: logError },
    ...overrides,
  });

  const withChromeAlarmsCreate = (create: jest.Mock) => {
    const alarms = (chrome as any).alarms;
    const originalCreate = alarms.create;
    alarms.create = create;
    return () => {
      alarms.create = originalCreate;
    };
  };

  beforeEach(() => {
    purge.mockReset().mockResolvedValue(0);
    logError.mockReset();
  });

  it("registers the alarm listener outside bootstrap so a new service worker can be woken", () => {
    // MV3 workers are suspended between events; a listener registered only in bootstrap would
    // miss the wake-up that delivers the alarm.
    expect(MainBackground.toString()).toContain("BrowserApi.addListener(chrome.alarms.onAlarm");
    expect(MainBackground.prototype.bootstrap.toString()).not.toContain(
      "addListener(chrome.alarms.onAlarm",
    );
  });

  it("registers the alarm on unlock for local accounts only", () => {
    const bootstrapSource = MainBackground.prototype.bootstrap.toString();

    expect(bootstrapSource).toContain("this.scheduleTrashSweepAlarm()");
    expect(bootstrapSource).toContain("this.trashMaintenance.isLocalAccount(userId)");
  });

  it("schedules one periodic alarm with the shared sweep interval", () => {
    const create = jest.fn();
    const restore = withChromeAlarmsCreate(create);

    try {
      const prototype = MainBackground.prototype as any;
      prototype.scheduleTrashSweepAlarm.call(fakeThis());

      // 同名闹钟会被 create 替换而不是新增，所以重复解锁不会叠加巡检。
      expect(create).toHaveBeenCalledWith(TRASH_SWEEP_ALARM_NAME, {
        delayInMinutes: 60,
        periodInMinutes: 60,
      });
    } finally {
      restore();
    }
  });

  it("swallows a failed alarm registration", () => {
    const create = jest.fn(() => {
      throw new Error("alarms unavailable");
    });
    const restore = withChromeAlarmsCreate(create);

    try {
      const prototype = MainBackground.prototype as any;

      expect(() => prototype.scheduleTrashSweepAlarm.call(fakeThis())).not.toThrow();
      expect(logError).toHaveBeenCalledWith(
        "Failed to schedule trash sweep alarm",
        expect.any(Error),
      );
    } finally {
      restore();
    }
  });

  it("ignores alarms that belong to other scheduled tasks", async () => {
    const sweep = jest.fn().mockResolvedValue(undefined);
    const prototype = MainBackground.prototype as any;

    await prototype.handleTrashSweepAlarm.call(fakeThis({ sweepExpiredTrash: sweep }), {
      name: "other-alarm",
    });

    expect(sweep).not.toHaveBeenCalled();
  });

  it("sweeps expired trash on the configured alarm", async () => {
    const sweep = jest.fn().mockResolvedValue(undefined);
    const prototype = MainBackground.prototype as any;

    await prototype.handleTrashSweepAlarm.call(fakeThis({ sweepExpiredTrash: sweep }), {
      name: TRASH_SWEEP_ALARM_NAME,
    });

    expect(sweep).toHaveBeenCalledTimes(1);
  });

  it("purges the active account's expired trash", async () => {
    const prototype = MainBackground.prototype as any;
    const account = { id: "user-id" as UserId };

    await prototype.sweepExpiredTrash.call(
      fakeThis({ accountService: { activeAccount$: of(account) } }),
    );

    expect(purge).toHaveBeenCalledWith(account.id);
  });

  it("does nothing when no account is active", async () => {
    const prototype = MainBackground.prototype as any;

    await prototype.sweepExpiredTrash.call(fakeThis());

    expect(purge).not.toHaveBeenCalled();
  });

  it("swallows sweep failures", async () => {
    const error = new Error("storage failure");
    purge.mockRejectedValue(error);
    const prototype = MainBackground.prototype as any;

    await expect(
      prototype.sweepExpiredTrash.call(
        fakeThis({ accountService: { activeAccount$: of({ id: "user-id" as UserId }) } }),
      ),
    ).resolves.toBeUndefined();

    // 巡检失败不能影响后台的其他工作；日志里没有条目字段。
    expect(logError).toHaveBeenCalledWith("Failed to run scheduled trash sweep", error);
  });
});
