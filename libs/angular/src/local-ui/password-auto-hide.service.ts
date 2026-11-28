import { Injectable, inject } from "@angular/core";
import { Observable, map } from "rxjs";

import {
  GlobalStateProvider,
  KeyDefinition,
  LOCAL_UI_DISK,
} from "@localpass/common/platform/state";

/** How long a revealed secret stays visible before the display returns to dots. */
export const PASSWORD_AUTO_HIDE_MS = 30_000;

/**
 * 密码显示自动收回只影响界面，不涉及保险库数据，所以落在本机 UI 设置里。
 *
 * 默认开启：复制与显示都是敏感动作，用户手动点眼睛后 30 秒自动回到掩码，
 * 避免离开座位时密码一直留在屏幕上。
 */
export const PASSWORD_AUTO_HIDE = new KeyDefinition<boolean>(LOCAL_UI_DISK, "passwordAutoHide", {
  deserializer: (value: boolean) => value ?? true,
});

@Injectable({ providedIn: "root" })
export class PasswordAutoHideService {
  private readonly autoHideState = inject(GlobalStateProvider).get(PASSWORD_AUTO_HIDE);

  readonly autoHide$: Observable<boolean> = this.autoHideState.state$.pipe(
    map((enabled) => enabled ?? true),
  );

  async setAutoHide(enabled: boolean): Promise<void> {
    await this.autoHideState.update(() => enabled, {
      shouldUpdate: (current) => current !== enabled,
    });
  }
}
