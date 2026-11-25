import { BrowserWindow, MenuItemConstructorOptions } from "electron";

import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";

import { isMac } from "../platform-utils.main";
import { UpdaterMain } from "../updater.main";

import { FirstMenu } from "./menu.first";
import { MenuAccount } from "./menu.updater";
import { IMenubarMenu } from "./menubar";

// AKA: "FirstMenu" or "MacMenu" - the first menu that shows on all macOs apps
export class LocalPassMenu extends FirstMenu implements IMenubarMenu {
  readonly id: string = "localpass";
  readonly label: string = "LocalPass";

  get items(): MenuItemConstructorOptions[] {
    const items = [this.aboutLocalPass, this.checkForUpdates];
    if (this.aboutLocalPass.visible === true || this.checkForUpdates.visible === true) {
      items.push(this.separator);
    }
    items.push(this.settings);
    items.push(this.lock);
    items.push(this.lockAll);
    items.push(this.logOut);
    items.push(this.separator);
    items.push(this.services);

    if (
      this.hideLocalPass.visible === true ||
      this.hideOthers.visible === true ||
      this.showAll.visible === true
    ) {
      items.push(this.separator);
    }

    items.push(this.hideLocalPass);
    items.push(this.hideOthers);
    items.push(this.showAll);

    if (this.quitLocalPass.visible === true) {
      items.push(this.separator);
    }
    items.push(this.quitLocalPass);
    return items;
  }

  constructor(
    i18nService: I18nService,
    messagingService: MessagingService,
    updater: UpdaterMain,
    window: BrowserWindow,
    accounts: { [userId: string]: MenuAccount },
    isLocked: boolean,
    isLockable: boolean,
  ) {
    super(i18nService, messagingService, updater, window, accounts, isLocked, isLockable);
  }

  private get aboutLocalPass(): MenuItemConstructorOptions {
    return {
      id: "aboutLocalPass",
      label: this.localize("aboutLocalPass"),
      role: "about",
      visible: isMac(),
    };
  }

  private get services(): MenuItemConstructorOptions {
    return {
      id: "services",
      label: this.localize("services"),
      role: "services",
      submenu: [],
      visible: isMac(),
    };
  }

  private get hideLocalPass(): MenuItemConstructorOptions {
    return {
      id: "hideLocalPass",
      label: this.localize("hideLocalPass"),
      role: "hide",
      visible: isMac(),
    };
  }

  private get hideOthers(): MenuItemConstructorOptions {
    return {
      id: "hideOthers",
      label: this.localize("hideOthers"),
      role: "hideOthers",
      visible: isMac(),
    };
  }

  private get showAll(): MenuItemConstructorOptions {
    return {
      id: "showAll",
      label: this.localize("showAll"),
      role: "unhide",
      visible: isMac(),
    };
  }

  private get quitLocalPass(): MenuItemConstructorOptions {
    return {
      id: "quitLocalPass",
      label: this.localize("quitLocalPass"),
      role: "quit",
      visible: isMac(),
    };
  }
}
