import { VaultSchedulerAdapter } from "./vault-backup-scheduler.service";

/**
 * A scheduler built on the platform timers (`setTimeout` / `setInterval`).
 *
 * The extension's service worker and the desktop main process both expose these. A suspended MV3
 * worker simply stops firing them; the next vault write or popup open schedules another upload, so
 * nothing is lost, only delayed.
 */
export class TimerVaultSchedulerAdapter implements VaultSchedulerAdapter {
  private readonly handles = new Map<number, ReturnType<typeof setTimeout>>();
  private nextHandle = 1;

  now(): number {
    return Date.now();
  }

  every(intervalMs: number, task: () => void): unknown {
    const handle = this.nextHandle++;
    this.handles.set(
      handle,
      setInterval(() => task(), intervalMs),
    );
    return handle;
  }

  after(delayMs: number, task: () => void): unknown {
    const handle = this.nextHandle++;
    this.handles.set(
      handle,
      setTimeout(() => {
        this.handles.delete(handle);
        task();
      }, delayMs),
    );
    return handle;
  }

  cancel(handle: unknown): void {
    const id = handle as number;
    const timer = this.handles.get(id);
    if (timer == null) {
      return;
    }
    clearTimeout(timer);
    clearInterval(timer);
    this.handles.delete(id);
  }
}
