// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as path from "path";

import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  nativeImage,
  screen,
  Tray,
} from "electron";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { BiometricsService } from "@localpass/key-management";

import { DesktopSettingsService } from "../platform/services/desktop-settings.service";
import { isDev } from "../utils";

import { WindowMain } from "./window.main";

export class TrayMain {
  contextMenu: Menu;

  private appName: string;
  private tray: Tray;
  private icon: string | Electron.NativeImage;
  private pressedIcon: Electron.NativeImage;
  /** 304×380 菜单栏面板；只在保险库解锁时显示，锁定后立即隐藏。 */
  private popup: BrowserWindow | null = null;
  private vaultLocked = true;
  // Cached so the close handler can decide synchronously whether to call preventDefault().
  private runInBackground = false;

  constructor(
    private windowMain: WindowMain,
    private i18nService: I18nService,
    private desktopSettingsService: DesktopSettingsService,
    private messagingService: MessagingService,
    private biometricService: BiometricsService,
  ) {
    if (process.platform === "win32") {
      this.icon = path.join(__dirname, "/images/icon.ico");
    } else if (process.platform === "darwin") {
      const nImage = nativeImage.createFromPath(path.join(__dirname, "/images/icon-template.png"));
      nImage.setTemplateImage(true);
      this.icon = nImage;
      this.pressedIcon = nativeImage.createFromPath(
        path.join(__dirname, "/images/icon-highlight.png"),
      );
    } else {
      this.icon = path.join(__dirname, "/images/icon.png");
    }
  }

  async init(appName: string, additionalMenuItems: MenuItemConstructorOptions[] = null) {
    this.appName = appName;

    const menuItemOptions: MenuItemConstructorOptions[] = [
      {
        label: this.i18nService.t("show"),
        click: () => this.restoreFromTray(),
      },
      {
        visible: isDev(),
        label: "Fake Popup Select",
        click: () => this.fakePopup(),
      },
      {
        visible: isDev(),
        label: "Fake Popup Create",
        click: () => this.fakePopupCreate(),
      },
      { type: "separator" },
      {
        label: this.i18nService.t("exit"),
        click: () => this.closeWindow(),
      },
    ];

    if (additionalMenuItems != null) {
      menuItemOptions.splice(1, 0, ...additionalMenuItems);
    }

    this.contextMenu = Menu.buildFromTemplate(menuItemOptions);

    // The tray icon is shown only while "keep running in the background" is enabled.
    // React to the setting so toggling it shows/removes the tray without a restart.
    this.desktopSettingsService.runInBackground$.subscribe((runInBackground) => {
      this.runInBackground = runInBackground;
      if (runInBackground) {
        this.showTray();
      } else {
        this.removeTray(false);
      }
    });
  }

  setupWindowListeners(win: BrowserWindow) {
    win.on("restore", async () => {
      await this.biometricService.setShouldAutopromptNow(true);
    });

    win.on("close", (e: Event) => {
      if (this.windowMain.isQuitting) {
        return;
      }

      if (this.runInBackground) {
        // Keep running in the background: closing the window hides it to the tray.
        e.preventDefault();
        this.hideToTray(win);
      } else {
        // Not running in the background: closing the window quits the application.
        // Setting isQuitting ensures macOS also quits via the window-all-closed handler.
        this.windowMain.isQuitting = true;
      }
    });
  }

  removeTray(showWindow = true) {
    this.hideTrayPopup();
    // Due to https://github.com/electron/electron/issues/17622
    // we cannot destroy the tray icon on linux.
    if (this.tray != null && process.platform !== "linux") {
      this.tray.destroy();
      this.tray = null;
    }

    if (showWindow && this.windowMain.win != null && !this.windowMain.win.isVisible()) {
      this.windowMain.win.show();
    }
  }

  /** 锁库或切换账号后，菜单栏面板不能再暴露旧条目的复制入口。 */
  setVaultLocked(locked: boolean): void {
    this.vaultLocked = locked;
    if (locked) {
      this.hideTrayPopup();
    }
  }

  hideTrayPopup(): void {
    if (this.popup != null && !this.popup.isDestroyed()) {
      this.popup.hide();
    }
  }

  /** 托盘里的「打开主窗口」：收起面板并回到主窗口。 */
  async openMainWindow(): Promise<void> {
    this.hideTrayPopup();
    await this.restoreFromTray();
  }

  hideToTray(win: BrowserWindow | null = this.windowMain.win) {
    this.showTray();
    if (win != null) {
      win.hide();
    }
    if (this.isDarwin()) {
      this.hideDock();
    }
  }

  /**
   * Brings the application to the foreground. Recreates the window if it was destroyed
   * (macOS), unminimizes it if minimized, then shows and focuses it. This never hides
   * the window - foregrounding is not a toggle.
   */
  async restoreFromTray() {
    if (this.windowMain.win == null) {
      // On macOS, closing the window via the red button destroys the BrowserWindow instance.
      await this.windowMain.createWindow();
      this.windowMain.win.show();
    } else {
      if (this.windowMain.win.isMinimized()) {
        this.windowMain.win.restore();
      }
      this.windowMain.show();
      this.windowMain.win.focus();
    }

    if (this.isDarwin()) {
      this.showDock();
    }
  }

  showTray() {
    if (this.tray != null) {
      return;
    }

    this.tray = new Tray(this.icon);
    this.tray.setToolTip(this.appName);
    this.tray.on("click", () => void this.onTrayClick());
    this.tray.on("right-click", () => this.tray.popUpContextMenu(this.contextMenu));

    if (this.pressedIcon != null) {
      this.tray.setPressedImage(this.pressedIcon);
    }
    if (this.contextMenu != null && !this.isDarwin()) {
      this.tray.setContextMenu(this.contextMenu);
    }
  }

  updateContextMenu() {
    if (this.tray != null && this.contextMenu != null && this.isLinux()) {
      this.tray.setContextMenu(this.contextMenu);
    }
  }

  private async onTrayClick(): Promise<void> {
    if (this.vaultLocked) {
      await this.restoreFromTray();
      return;
    }

    if (this.popup != null && !this.popup.isDestroyed() && this.popup.isVisible()) {
      this.popup.hide();
      return;
    }

    await this.showTrayPopup();
  }

  private async showTrayPopup(): Promise<void> {
    try {
      if (this.popup == null || this.popup.isDestroyed()) {
        const popup = await this.windowMain.createTrayWindow();
        popup.on("blur", () => {
          if (this.popup === popup && !popup.isDestroyed()) {
            popup.hide();
          }
        });
        popup.on("closed", () => {
          if (this.popup === popup) {
            this.popup = null;
          }
        });
        this.popup = popup;
      }

      this.positionTrayPopup(this.popup);
      this.popup.show();
      this.popup.focus();
    } catch {
      // 面板本身不可用时仍让用户进入主窗口，而不是把托盘点击变成无响应。
      await this.restoreFromTray();
    }
  }

  /** 贴着托盘图标弹出；任务栏在底部时翻到图标上方，并夹在屏幕工作区内。 */
  private positionTrayPopup(popup: BrowserWindow): void {
    const trayBounds = this.tray.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: Math.round(trayBounds.x),
      y: Math.round(trayBounds.y),
    });
    const workArea = display.workArea;
    const width = 304;
    const height = 380;
    const margin = 6;

    const x = clamp(
      trayBounds.x + trayBounds.width / 2 - width / 2,
      workArea.x + margin,
      workArea.x + workArea.width - width - margin,
    );
    const below = trayBounds.y + trayBounds.height + margin;
    const above = trayBounds.y - height - margin;
    const preferAbove = trayBounds.y > workArea.y + workArea.height / 2;
    const y = clamp(
      preferAbove ? above : below,
      workArea.y + margin,
      workArea.y + workArea.height - height - margin,
    );

    popup.setPosition(Math.round(x), Math.round(y));
  }

  private hideDock() {
    app.dock.hide();
  }

  private showDock() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    app.dock.show();
  }

  private isDarwin() {
    return process.platform === "darwin";
  }

  private isLinux() {
    return process.platform === "linux";
  }

  private closeWindow() {
    this.windowMain.isQuitting = true;
    if (this.windowMain.win != null) {
      this.windowMain.win.close();
    }
  }

  /**
   * This method is used to test modal behavior during development and could be removed in the future.
   * @returns
   */
  private async fakePopup() {
    await this.messagingService.send("loadurl", { url: "/passkeys", modal: true });
  }

  private async fakePopupCreate() {
    await this.messagingService.send("loadurl", { url: "/create-passkey", modal: true });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
