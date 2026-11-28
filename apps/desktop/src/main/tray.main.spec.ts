import { EventEmitter } from "node:events";

import { BrowserWindow } from "electron";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@localpass/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";

jest.mock("electron", () => ({
  app: { dock: { hide: jest.fn(), show: jest.fn() } },
  BrowserWindow: jest.fn(),
  Menu: { buildFromTemplate: jest.fn() },
  nativeImage: {
    createFromPath: jest.fn(() => ({ setTemplateImage: jest.fn() })),
  },
  screen: {
    getDisplayNearestPoint: jest.fn(() => ({
      workArea: { x: 0, y: 0, width: 1440, height: 900 },
    })),
  },
  Tray: jest.fn(() => ({
    on: jest.fn(),
    setToolTip: jest.fn(),
    setPressedImage: jest.fn(),
    setContextMenu: jest.fn(),
    getBounds: jest.fn(() => ({ x: 1200, y: 0, width: 24, height: 24 })),
    destroy: jest.fn(),
  })),
}));

jest.mock("./window.main", () => ({ WindowMain: jest.fn() }));

import { TrayMain } from "./tray.main";
import { WindowMain } from "./window.main";

describe("TrayMain", () => {
  describe("window close", () => {
    let runInBackground$: BehaviorSubject<boolean>;
    let windowMain: WindowMain;
    let win: EventEmitter & { hide: jest.Mock };

    const emitClose = () => {
      const event = { preventDefault: jest.fn() };
      win.emit("close", event);
      return event;
    };

    beforeEach(async () => {
      globalThis.BIT_ENVIRONMENT = "production";
      runInBackground$ = new BehaviorSubject(false);
      win = Object.assign(new EventEmitter(), { hide: jest.fn() });
      windowMain = { isQuitting: false, win } as unknown as WindowMain;

      const desktopSettingsService = mock<DesktopSettingsService>();
      desktopSettingsService.runInBackground$ = runInBackground$;

      const sut = new TrayMain(
        windowMain,
        mock<I18nService>(),
        desktopSettingsService,
        mock<MessagingService>(),
        mock<BiometricsService>(),
      );
      await sut.init("LocalPass");
      sut.setupWindowListeners(win as unknown as BrowserWindow);
    });

    it("prevents the close synchronously and hides the window when running in the background", () => {
      runInBackground$.next(true);

      const event = emitClose();

      expect(event.preventDefault).toHaveBeenCalled();
      expect(win.hide).toHaveBeenCalled();
      expect(windowMain.isQuitting).toBe(false);
    });

    it("hides the window being closed when another window is the main window", () => {
      runInBackground$.next(true);
      const other = { hide: jest.fn() };
      windowMain.win = other as unknown as BrowserWindow;

      emitClose();

      expect(win.hide).toHaveBeenCalled();
      expect(other.hide).not.toHaveBeenCalled();
    });

    it("lets the close proceed and marks the app as quitting when not running in the background", () => {
      const event = emitClose();

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(windowMain.isQuitting).toBe(true);
    });

    it("lets the close proceed while the app is quitting", () => {
      runInBackground$.next(true);
      windowMain.isQuitting = true;

      const event = emitClose();

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(win.hide).not.toHaveBeenCalled();
    });
  });

  describe("tray panel", () => {
    let runInBackground$: BehaviorSubject<boolean>;
    let windowMain: WindowMain;
    let popup: EventEmitter & {
      show: jest.Mock;
      focus: jest.Mock;
      hide: jest.Mock;
      isVisible: jest.Mock;
      isDestroyed: jest.Mock;
      setPosition: jest.Mock;
    };

    const clickTray = (sut: TrayMain) =>
      (sut as unknown as { onTrayClick(): Promise<void> }).onTrayClick();

    beforeEach(async () => {
      globalThis.BIT_ENVIRONMENT = "production";
      runInBackground$ = new BehaviorSubject(true);
      popup = Object.assign(new EventEmitter(), {
        show: jest.fn(),
        focus: jest.fn(),
        hide: jest.fn(),
        isVisible: jest.fn(() => false),
        isDestroyed: jest.fn(() => false),
        setPosition: jest.fn(),
      });
      windowMain = {
        isQuitting: false,
        win: { hide: jest.fn() },
        createTrayWindow: jest.fn().mockResolvedValue(popup),
        restoreFromTray: jest.fn().mockResolvedValue(undefined),
      } as unknown as WindowMain;
    });

    it("opens the panel while unlocked, sized against the tray icon", async () => {
      const desktopSettingsService = mock<DesktopSettingsService>();
      desktopSettingsService.runInBackground$ = runInBackground$;
      const sut = new TrayMain(
        windowMain,
        mock<I18nService>(),
        desktopSettingsService,
        mock<MessagingService>(),
        mock<BiometricsService>(),
      );
      await sut.init("LocalPass");
      sut.setVaultLocked(false);

      await clickTray(sut);

      expect(windowMain.createTrayWindow).toHaveBeenCalled();
      expect(popup.setPosition).toHaveBeenCalledWith(1060, 30);
      expect(popup.show).toHaveBeenCalled();
      expect(popup.focus).toHaveBeenCalled();
    });

    it("hides the panel as soon as the vault locks", async () => {
      const desktopSettingsService = mock<DesktopSettingsService>();
      desktopSettingsService.runInBackground$ = runInBackground$;
      const sut = new TrayMain(
        windowMain,
        mock<I18nService>(),
        desktopSettingsService,
        mock<MessagingService>(),
        mock<BiometricsService>(),
      );
      await sut.init("LocalPass");
      sut.setVaultLocked(false);
      await clickTray(sut);

      sut.setVaultLocked(true);

      expect(popup.hide).toHaveBeenCalled();
    });

    it("returns to the main window instead of opening the panel while locked", async () => {
      const desktopSettingsService = mock<DesktopSettingsService>();
      desktopSettingsService.runInBackground$ = runInBackground$;
      const sut = new TrayMain(
        windowMain,
        mock<I18nService>(),
        desktopSettingsService,
        mock<MessagingService>(),
        mock<BiometricsService>(),
      );
      await sut.init("LocalPass");
      const restore = jest.spyOn(sut, "restoreFromTray").mockResolvedValue(undefined);

      await clickTray(sut);

      expect(windowMain.createTrayWindow).not.toHaveBeenCalled();
      expect(restore).toHaveBeenCalled();
    });
  });
});
