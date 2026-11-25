import { MenuItemConstructorOptions, app } from "electron";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { UrlType } from "@localpass/common/platform/misc/safe-urls";

import { SafeShell } from "../../platform/main/safe-shell.main";
import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import { isMacAppStore, isWindowsStore } from "../platform-utils.main";

import { AboutMenu } from "./menu.about";
import { IMenubarMenu } from "./menubar";

export class HelpMenu implements IMenubarMenu {
  readonly id: string = "help";

  get label(): string {
    return this.localize("help");
  }

  get items(): MenuItemConstructorOptions[] {
    // Offline product: no help portal, web vault, app-store pages or social links to open.
    const items = [this.fileBugReport, this.separator, this.troubleshooting];

    if (this.aboutMenu != null) {
      items.push(...this.aboutMenu.items);
    }
    return items;
  }

  constructor(
    private i18nService: I18nService,
    private messagingService: MessagingService,
    private desktopSettingsService: DesktopSettingsService,
    private webVaultUrl: string,
    private hardwareAccelerationEnabled: boolean,
    private aboutMenu: AboutMenu,
    private shell: SafeShell,
  ) {}

  private get helpAndFeedback(): MenuItemConstructorOptions {
    return {
      id: "helpAndFeedback",
      label: this.localize("helpAndFeedback"),
      click: () => this.shell.openExternal("https://local.invalid/help", UrlType.WebUrl),
    };
  }

  private get fileBugReport(): MenuItemConstructorOptions {
    return {
      id: "fileBugReport",
      label: this.localize("fileBugReport"),
      click: () =>
        this.shell.openExternal("https://github.com/xieboss778/LocalPassword/issues", UrlType.WebUrl),
    };
  }

  private get legal(): MenuItemConstructorOptions {
    return {
      id: "legal",
      label: this.localize("legal"),
      visible: isMacAppStore(),
      submenu: this.legalSubmenu,
    };
  }

  private get legalSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        id: "termsOfService",
        label: this.localize("termsOfService"),
        click: () => this.shell.openExternal("https://local.invalid/terms/", UrlType.WebUrl),
      },
      {
        id: "privacyPolicy",
        label: this.localize("privacyPolicy"),
        click: () => this.shell.openExternal("https://local.invalid/privacy/", UrlType.WebUrl),
      },
    ];
  }

  private get separator(): MenuItemConstructorOptions {
    return { type: "separator" };
  }

  private get followUs(): MenuItemConstructorOptions {
    return {
      id: "followUs",
      label: this.localize("followUs"),
      submenu: this.followUsSubmenu,
    };
  }

  private get followUsSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        id: "blog",
        label: this.localize("blog"),
        click: () => this.shell.openExternal("https://blog.local.invalid", UrlType.WebUrl),
      },
      {
        id: "twitter",
        label: "Twitter",
        click: () => this.shell.openExternal("https://github.com/xieboss778/LocalPass", UrlType.WebUrl),
      },
      {
        id: "facebook",
        label: "Facebook",
        click: () => this.shell.openExternal("https://github.com/xieboss778/LocalPass", UrlType.WebUrl),
      },
      {
        id: "github",
        label: "GitHub",
        click: () => this.shell.openExternal("https://github.com/xieboss778/LocalPassword", UrlType.WebUrl),
      },
      {
        id: "mastodon",
        label: "Mastodon",
        click: () => this.shell.openExternal("https://github.com/xieboss778/LocalPass", UrlType.WebUrl),
      },
    ];
  }

  private get goToWebVault(): MenuItemConstructorOptions {
    return {
      id: "goToWebVault",
      label: this.localize("goToWebVault"),
      click: () => this.shell.openExternal(this.webVaultUrl, UrlType.WebUrl),
    };
  }

  private get getMobileApp(): MenuItemConstructorOptions {
    return {
      id: "getMobileApp",
      label: this.localize("getMobileApp"),
      visible: !isWindowsStore(),
      submenu: this.getMobileAppSubmenu,
    };
  }

  private get getMobileAppSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        id: "iOS",
        label: "iOS",
        click: () =>
          this.shell.openExternal(
            "https://itunes.apple.com/app/" + "localpass-free-password-manager/id1137397744?mt=8",
            UrlType.WebUrl,
          ),
      },
      {
        id: "android",
        label: "Android",
        visible: !isMacAppStore(), // Apple Guideline 2.3.10 - Accurate Metadata
        click: () =>
          this.shell.openExternal(
            "https://play.google.com/store/apps/" + "details?id=com.x8bit.localpass",
            UrlType.WebUrl,
          ),
      },
    ];
  }

  private get getBrowserExtension(): MenuItemConstructorOptions {
    return {
      id: "getBrowserExtension",
      label: this.localize("getBrowserExtension"),
      visible: !isWindowsStore(),
      submenu: this.getBrowserExtensionSubmenu,
    };
  }

  private get getBrowserExtensionSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        id: "chrome",
        label: "Chrome",
        click: () =>
          this.shell.openExternal(
            "https://chromewebstore.google.com/detail/" +
              "localpass-free-password-m/nngceckbapebfimnlniiiahkandclblb",
            UrlType.WebUrl,
          ),
      },
      {
        id: "firefox",
        label: "Firefox",
        click: () =>
          this.shell.openExternal(
            "https://addons.mozilla.org/firefox/addon/" + "localpass-password-manager/",
            UrlType.WebUrl,
          ),
      },
      {
        id: "firefox",
        label: "Opera",
        click: () =>
          this.shell.openExternal(
            "https://addons.opera.com/extensions/details/" + "localpass-free-password-manager/",
            UrlType.WebUrl,
          ),
      },
      {
        id: "firefox",
        label: "Edge",
        click: () =>
          this.shell.openExternal(
            "https://microsoftedge.microsoft.com/addons/" +
              "detail/jbkfoedolllekgbhcbcoahefnbanhhlh",
            UrlType.WebUrl,
          ),
      },
      {
        id: "safari",
        label: "Safari",
        click: () => this.shell.openExternal("https://local.invalid/download/", UrlType.WebUrl),
      },
    ];
  }

  private get troubleshooting(): MenuItemConstructorOptions {
    return {
      id: "troubleshooting",
      label: this.localize("troubleshooting"),
      submenu: this.troubleshootingSubmenu,
    };
  }

  private get troubleshootingSubmenu(): MenuItemConstructorOptions[] {
    return [
      {
        id: "hardwareAcceleration",
        label: this.localize(
          this.hardwareAccelerationEnabled
            ? "disableHardwareAccelerationRestart"
            : "enableHardwareAccelerationRestart",
        ),
        click: async () => {
          await this.desktopSettingsService.setHardwareAcceleration(
            !this.hardwareAccelerationEnabled,
          );
          // `app.relaunch` crashes the app on Mac Store builds. Disabling it for now.
          // https://github.com/electron/electron/issues/41690
          if (!isMacAppStore()) {
            app.relaunch();
          }
          app.exit();
        },
      },
      {
        id: "downloadDiagnosticReport",
        label: this.localize("downloadDiagnosticReport"),
        click: () => this.messagingService.send("openTroubleshootingDialog"),
      },
    ];
  }

  private localize(s: string) {
    return this.i18nService.t(s);
  }
}
