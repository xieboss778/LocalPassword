import { firstValueFrom } from "rxjs";

import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { CipherId, UserId } from "@localpass/common/types/guid";
import { LocalVaultWriter } from "@localpass/common/vault/abstractions/local-vault-writer.abstraction";
import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { ENCRYPTED_CIPHERS } from "@localpass/common/vault/services/key-state/ciphers.state";
import { StateProvider } from "@localpass/state";

/** 回收站保留 30 天，两个客户端的回收站界面都按这个数字展示剩余天数。 */
export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 清掉本地回收站里已经超过保留期的条目。
 *
 * 回收站界面承诺条目只保留 30 天（`trashSummary` 与剩余天数都按 30 天计算），但手动清空之前
 * 条目原本会一直留在本地。这里在解锁后做一次维护，把到期条目的 id 交给
 * {@link LocalVaultWriter.deleteManyCiphers} —— 也就是 `CipherService.deleteManyWithServer`
 * 在本地账号下走的同一条永久删除路径，版本历史会随之清掉，备份同步照常收到变更通知。
 *
 * 只读本地加密状态里的 `deletedDate`，不解密、不发网络请求、不打日志记录条目字段。
 *
 * 边界：界面用 `remaining = 30 - floor(已删天数)` 展示，删除满 30 整天时正好显示「剩 0 天」，
 * 所以这里用 `>= 30 天`：到点即清理，与倒计时归零一致；用 `>` 会让「剩 0 天」的条目再留一天。
 * `deletedDate` 缺失、非法或在未来（时钟回拨）的条目一律跳过。
 */
export class TrashMaintenanceService {
  constructor(
    private readonly localVaultWriter: LocalVaultWriter,
    private readonly stateProvider: StateProvider,
    private readonly logService: LogService,
  ) {}

  /**
   * @returns 永久删除的条目数；非本地账号或失败时返回 0。
   */
  async purgeExpiredTrash(userId: UserId, now: Date = new Date()): Promise<number> {
    try {
      if (!(await this.localVaultWriter.isLocalAccount(userId))) {
        return 0;
      }

      const state = await firstValueFrom(
        this.stateProvider.getUser(userId, ENCRYPTED_CIPHERS).state$,
      );
      const expiredIds = this.expiredIds(state, now);
      if (expiredIds.length === 0) {
        return 0;
      }

      const deleted = await this.localVaultWriter.deleteManyCiphers(expiredIds, userId);
      return deleted ? expiredIds.length : 0;
    } catch (error) {
      // 维护属于尽力而为：失败不能影响解锁流程，也不能把条目内容写进日志。
      this.logService.error("Failed to purge expired trash items", error);
      return 0;
    }
  }

  private expiredIds(state: Record<CipherId, CipherData> | null, now: Date): string[] {
    const ids: string[] = [];
    for (const [id, data] of Object.entries(state ?? {})) {
      if (this.isExpired(data.deletedDate, now)) {
        ids.push(id);
      }
    }
    return ids;
  }

  private isExpired(deletedDate: string | undefined, now: Date): boolean {
    if (!deletedDate) {
      return false;
    }

    const deletedAt = new Date(deletedDate).getTime();
    if (Number.isNaN(deletedAt) || deletedAt > now.getTime()) {
      return false;
    }

    return now.getTime() - deletedAt >= TRASH_RETENTION_DAYS * DAY_MS;
  }
}
