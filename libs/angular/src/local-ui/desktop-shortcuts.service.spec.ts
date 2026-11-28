import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { GlobalStateProvider } from "@localpass/common/platform/state";
import { FakeGlobalStateProvider } from "@localpass/common/spec";

import { DesktopShortcut, DesktopShortcutsService } from "./desktop-shortcuts.service";

describe("DesktopShortcutsService", () => {
  let sut: DesktopShortcutsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DesktopShortcutsService,
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    });
    sut = TestBed.inject(DesktopShortcutsService);
  });

  it("enables every shortcut until one is removed", async () => {
    expect(sut.isEnabled(DesktopShortcut.Search)).toBe(true);
    expect(await firstValueFrom(sut.disabled$)).toEqual(new Set());
  });

  it("persists a removed shortcut and restores all defaults", async () => {
    await sut.setEnabled(DesktopShortcut.Search, false);

    expect(sut.isEnabled(DesktopShortcut.Search)).toBe(false);
    expect(sut.isEnabled(DesktopShortcut.Lock)).toBe(true);
    expect(await firstValueFrom(sut.disabled$)).toEqual(new Set([DesktopShortcut.Search]));

    await sut.reset();

    expect(sut.isEnabled(DesktopShortcut.Search)).toBe(true);
    expect(await firstValueFrom(sut.disabled$)).toEqual(new Set());
  });
});
