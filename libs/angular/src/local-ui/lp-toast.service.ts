import { Injectable, signal } from "@angular/core";

/** 一次只显示一条的底部浮层，用来回执「已复制」这类动作。 */
@Injectable({ providedIn: "root" })
export class LpToastService {
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly message = signal<string | null>(null);

  show(message: string, durationMs = 1700): void {
    this.message.set(message);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }
}
