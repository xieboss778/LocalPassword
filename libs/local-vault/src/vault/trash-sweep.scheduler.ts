import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";

import { TrashMaintenanceService } from "./trash-maintenance.service";

/**
 * 回收站巡检间隔。
 *
 * 条目按 30 天到期，解锁时已经清理过一次，因此每小时巡检一次足够；再频繁只会无谓地读取
 * 加密状态，不会让清理更早发生。
 */
export const TRASH_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * 在长时间运行的客户端里定期清理到期的回收站条目。
 *
 * {@link TrashMaintenanceService.purgeExpiredTrash} 原本只在解锁时运行一次，保险库持续解锁
 * 数周时不会再次清理。这里用一个计时器补上巡检：解锁回调调用 {@link start} 记录用户并启动
 * 计时器，应用销毁时调用 {@link stop}。
 *
 * 约束：
 * - 只对本地账号启动；对非本地账号调用 `start` 会停掉已有计时器。
 * - 重复调用 `start` 不会叠加计时器，只会把巡检目标换成最近解锁的用户。
 * - 巡检失败只写一条通用日志，绝不向调用方抛出——解锁、同步和界面都不受影响。
 */
export class TrashSweepScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private userId: UserId | null = null;
  /** 每次 start/stop 递增，避免一次过期的异步本地账号检查在 stop 之后又启动计时器。 */
  private generation = 0;

  constructor(
    private readonly trashMaintenance: TrashMaintenanceService,
    private readonly logService: LogService,
    private readonly intervalMs: number = TRASH_SWEEP_INTERVAL_MS,
  ) {}

  /**
   * 记录最近解锁的用户，并确保该用户有一个巡检计时器。
   *
   * @returns 启动完成后兑现；任何失败都只会记日志，不会拒绝。
   */
  async start(userId: UserId): Promise<void> {
    const generation = ++this.generation;
    this.userId = userId;

    let local = false;
    try {
      local = await this.trashMaintenance.isLocalAccount(userId);
    } catch (error) {
      // `isLocalAccount` 自身会吞掉错误；这里再兜一层，保证解锁回调不会因巡检失败而中断。
      this.logService.error("Failed to check local account for trash sweep", error);
    }

    if (generation !== this.generation) {
      return;
    }

    if (!local) {
      this.stop();
      return;
    }

    if (this.timer !== null) {
      return;
    }

    try {
      this.timer = setInterval(() => void this.sweepNow(), this.intervalMs);
    } catch (error) {
      this.logService.error("Failed to start trash sweep scheduler", error);
    }
  }

  /** 停止巡检并清除计时器；可以重复调用。 */
  stop(): void {
    this.generation++;
    this.userId = null;

    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 对 {@link start} 记录的当前用户立即巡检一次。
   *
   * 在 `start` 之前或 `stop` 之后调用时什么也不做。计时器回调与测试都走这里；失败只记日志。
   */
  async sweepNow(): Promise<void> {
    const userId = this.userId;
    if (userId === null) {
      return;
    }

    try {
      await this.trashMaintenance.purgeExpiredTrash(userId);
    } catch (error) {
      this.logService.error("Failed to sweep expired trash items", error);
    }
  }
}
