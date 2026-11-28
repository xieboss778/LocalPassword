import { Injectable, inject } from "@angular/core";
import { Observable, map, shareReplay } from "rxjs";

import {
  GlobalStateProvider,
  KeyDefinition,
  LOCAL_UI_DISK,
} from "@localpass/common/platform/state";

/** AGY 设置页列出的 6 个应用内快捷键；删除只影响本窗口，不注册全局热键。 */
export const DesktopShortcut = Object.freeze({
  Search: "search",
  Nav: "nav",
  Copy: "copy",
  Edit: "edit",
  Delete: "delete",
  Lock: "lock",
} as const);
export type DesktopShortcut = (typeof DesktopShortcut)[keyof typeof DesktopShortcut];

const ALL_SHORTCUTS = Object.freeze(Object.values(DesktopShortcut));
const SHORTCUT_SET: ReadonlySet<string> = new Set(ALL_SHORTCUTS);

/** 持久化被删除的快捷键 id；未列出的项保持默认启用。 */
export const DISABLED_DESKTOP_SHORTCUTS = new KeyDefinition<DesktopShortcut[]>(
  LOCAL_UI_DISK,
  "disabledDesktopShortcuts",
  {
    deserializer: (value) =>
      Array.isArray(value)
        ? value.filter((id): id is DesktopShortcut => SHORTCUT_SET.has(String(id)))
        : [],
  },
);

@Injectable({ providedIn: "root" })
export class DesktopShortcutsService {
  private readonly state = inject(GlobalStateProvider).get(DISABLED_DESKTOP_SHORTCUTS);
  private disabled: ReadonlySet<DesktopShortcut> = new Set();

  readonly disabled$: Observable<ReadonlySet<DesktopShortcut>> = this.state.state$.pipe(
    map((ids) => new Set(ids ?? [])),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    // 键盘事件同步读取当前映射；保留一份比 Observable 更早可用的快照。
    this.state.state$.subscribe((ids) => {
      this.disabled = new Set(ids ?? []);
    });
  }

  isEnabled(id: DesktopShortcut): boolean {
    return !this.disabled.has(id);
  }

  async setEnabled(id: DesktopShortcut, enabled: boolean): Promise<void> {
    const desiredDisabled = !enabled;
    await this.state.update(
      (current) => {
        const next = new Set(current ?? []);
        if (enabled) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return [...next];
      },
      {
        shouldUpdate: (current) => (current ?? []).includes(id) !== desiredDisabled,
      },
    );
  }

  async reset(): Promise<void> {
    await this.state.update(() => [], { shouldUpdate: (current) => (current ?? []).length > 0 });
  }
}
