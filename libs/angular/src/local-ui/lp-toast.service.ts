import { Injectable, inject, signal } from "@angular/core";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

/** 浮层上的一个即时动作，例如「撤销」或「立即清除」；点击后浮层立即收起再执行。 */
export interface LpToastAction {
  readonly label: string;
  readonly run: () => void | Promise<void>;
}

/** 一次只显示一条的底部浮层，支持复制剪贴板倒计时与撤销倒计时。 */
@Injectable({ providedIn: "root" })
export class LpToastService {
  private readonly i18n = inject(I18nService, { optional: true });

  private timer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private clipboardTimer: ReturnType<typeof setInterval> | null = null;
  private clipboardClearHandler: (() => void | Promise<void>) | null = null;
  private showingClipboardToast = false;

  readonly message = signal<string | null>(null);
  readonly action = signal<LpToastAction | null>(null);
  /** 当前浮层上显示的剩余秒数（剪贴板倒计时或撤销倒计时）。 */
  readonly countdown = signal<number | null>(null);
  /** 当前剪贴板自动清除剩余秒数；浮层收起后继续倒计时，供桌面端底栏展示。 */
  readonly clipboardRemaining = signal<number | null>(null);

  show(message: string, durationMs = 1700, action: LpToastAction | null = null): void {
    this.clearToastTimers();
    this.showingClipboardToast = false;
    this.message.set(message);
    this.action.set(action);
    this.countdown.set(null);
    this.timer = setTimeout(() => this.hide(), durationMs);
  }

  /** 复制后的浮层回执：带 1s 倒计时与「立即清除」，并持续在后台触发自动清理。 */
  showClipboard(message: string, onClearNow: () => void | Promise<void>, seconds = 30): void {
    const totalSeconds = Math.max(1, Math.round(seconds));
    this.clearToastTimers();
    this.clearClipboardTimer();

    this.clipboardClearHandler = onClearNow;
    this.clipboardRemaining.set(totalSeconds);
    this.showingClipboardToast = true;

    const clearLabel = this.i18n?.t("clearNow") || "Clear now";
    this.message.set(message);
    this.countdown.set(totalSeconds);
    this.action.set({
      label: clearLabel,
      run: () => this.clearClipboardNow(),
    });

    this.clipboardTimer = setInterval(() => {
      const next = (this.clipboardRemaining() ?? 1) - 1;
      if (next <= 0) {
        void this.clearClipboardNow();
        return;
      }
      this.clipboardRemaining.set(next);
      if (this.showingClipboardToast) {
        this.countdown.set(next);
      }
    }, 1000);

    // 浮层在 4.5s 后淡出以免长时间遮挡内容；剪贴板倒计时在桌面底栏继续走完。
    this.timer = setTimeout(() => this.hide(), Math.min(totalSeconds * 1000, 4500));
  }

  /** 带秒数倒计时的撤销回执（如 5s 移入回收站撤销）。 */
  showUndo(message: string, onUndo: () => void | Promise<void>, seconds = 5): void {
    const totalSeconds = Math.max(1, Math.round(seconds));
    this.clearToastTimers();
    this.showingClipboardToast = false;

    const undoLabel = this.i18n?.t("undo") || "Undo";
    this.message.set(message);
    this.countdown.set(totalSeconds);
    this.action.set({
      label: undoLabel,
      run: onUndo,
    });

    this.countdownTimer = setInterval(() => {
      const next = (this.countdown() ?? 1) - 1;
      if (next <= 0) {
        this.hide();
        return;
      }
      this.countdown.set(next);
    }, 1000);

    this.timer = setTimeout(() => this.hide(), totalSeconds * 1000);
  }

  /** 立即清空剪贴板并结束倒计时。 */
  async clearClipboardNow(): Promise<void> {
    const handler = this.clipboardClearHandler;
    this.clipboardClearHandler = null;
    this.clearClipboardTimer();
    this.clipboardRemaining.set(null);
    if (this.showingClipboardToast) {
      this.hide();
    }
    try {
      await handler?.();
    } catch {
      // 剪贴板不可写时仍需完成本地倒计时收尾。
    }
  }

  /** 点击动作按钮时调用；先收起浮层，避免动作尚未完成时入口已被计时器关掉。 */
  async invokeAction(): Promise<void> {
    const action = this.action();
    this.hide();
    await action?.run();
  }

  hide(): void {
    this.clearToastTimers();
    this.showingClipboardToast = false;
    this.message.set(null);
    this.action.set(null);
    this.countdown.set(null);
  }

  private clearToastTimers(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private clearClipboardTimer(): void {
    if (this.clipboardTimer) {
      clearInterval(this.clipboardTimer);
      this.clipboardTimer = null;
    }
  }
}
