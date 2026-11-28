import { ThemeTypes } from "@localpass/common/platform/enums";
import { CipherRepromptType, CipherType } from "@localpass/common/vault/enums";

import { NotificationCipherData } from "../../cipher/types";
import { I18n } from "../../common-types";

import {
  ChangeNotificationNewEntryTarget,
  changeNotificationShowsPicker,
  getChangeNotificationHeaderMessage,
  getChangeNotificationPrimaryLabel,
  NotificationChangeContainer,
} from "./container";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("@emotion/css", () => ({ css: jest.fn(() => "") }));
jest.mock("../../icons", () => ({
  Check: jest.fn(() => "check-icon"),
  Close: jest.fn(() => "close-icon"),
}));
jest.mock("../../../../utils/event-security", () => ({
  EventSecurity: { isEventTrusted: jest.fn(() => true) },
}));

const i18n: I18n = {
  close: "Close menu",
  notificationChangeIgnore: "Ignore",
  notificationChangeToggle: "Switch / save as new",
  notificationUpdate: "Update",
};

function cipher(overrides: Partial<NotificationCipherData> = {}): NotificationCipherData {
  return {
    id: "cipher-1",
    name: "Northwind",
    type: CipherType.Login,
    reprompt: CipherRepromptType.None,
    favorite: false,
    icon: { imageEnabled: false, image: "", fallbackImage: "", icon: "globe" },
    ...overrides,
  };
}

const alexCipher = cipher({
  id: "cipher-alex",
  login: { username: "alex@northwind.io" },
  versionCount: 3,
});
const opsCipher = cipher({
  id: "cipher-ops",
  name: "Northwind Ops",
  login: { username: "ops@northwind.io" },
  versionCount: 2,
});

function flatten(value: unknown): unknown[] {
  return Array.isArray(value) ? value.flatMap(flatten) : [value];
}

function render(props: Partial<Parameters<typeof NotificationChangeContainer>[0]> = {}) {
  return NotificationChangeContainer({
    ciphers: [alexCipher],
    domain: "northwind.io",
    expanded: false,
    i18n,
    notificationTestId: "update-notification-bar",
    selectedTarget: alexCipher.id,
    theme: ThemeTypes.Light,
    handleCloseNotification: jest.fn(),
    handleCommit: jest.fn(),
    handleSelectTarget: jest.fn(),
    handleToggleExpanded: jest.fn(),
    ...props,
  }) as unknown as unknown[];
}

describe("changeNotificationShowsPicker", () => {
  it("opens the picker for several matched entries even before the user expands it", () => {
    expect(changeNotificationShowsPicker([alexCipher, opsCipher], false)).toBe(true);
  });

  it("opens the picker with only the new-entry row when no entry matched the password", () => {
    expect(changeNotificationShowsPicker([], false)).toBe(true);
  });

  it("keeps a single matched entry in summary mode until the user expands it", () => {
    expect(changeNotificationShowsPicker([alexCipher], false)).toBe(false);
    expect(changeNotificationShowsPicker([alexCipher], true)).toBe(true);
  });
});

describe("getChangeNotificationHeaderMessage", () => {
  it("names the single matched item", () => {
    getChangeNotificationHeaderMessage([alexCipher], "northwind.io", false);

    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("notificationChangeHeader", [
      alexCipher.name,
    ]);
  });

  it("names the site when several entries match", () => {
    getChangeNotificationHeaderMessage([alexCipher, opsCipher], "northwind.io", false);

    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("notificationMultiSaveHeader", [
      "northwind.io",
    ]);
  });

  it("asks to save a new password when no entry matched", () => {
    getChangeNotificationHeaderMessage([], "northwind.io", false);

    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("notificationChangeNoMatchHeader", [
      "northwind.io",
    ]);
  });
});

describe("getChangeNotificationPrimaryLabel", () => {
  it("labels the single entry update with its next version", () => {
    expect(getChangeNotificationPrimaryLabel([alexCipher], alexCipher.id, i18n, false)).toBe(
      chrome.i18n.getMessage("notificationUpdateVersion", ["4"]),
    );
  });

  it("falls back to the plain update label when no version is known", () => {
    const unversioned = cipher({ id: "cipher-unversioned", login: { username: "alex@" } });

    expect(getChangeNotificationPrimaryLabel([unversioned], unversioned.id, i18n, false)).toBe(
      "Update",
    );
  });

  it("names the selected account when several entries are listed", () => {
    expect(
      getChangeNotificationPrimaryLabel([alexCipher, opsCipher], opsCipher.id, i18n, true),
    ).toBe(chrome.i18n.getMessage("notificationMultiSaveUpdate", ["ops@northwind.io"]));
  });

  it("falls back to a generic label when the selected entry has no username", () => {
    const unnamed = cipher({ id: "cipher-unnamed" });

    expect(getChangeNotificationPrimaryLabel([unnamed, opsCipher], unnamed.id, i18n, true)).toBe(
      chrome.i18n.getMessage("notificationMultiSaveUpdateGeneric"),
    );
  });

  it("offers to create the next entry when save-as-new is selected", () => {
    expect(
      getChangeNotificationPrimaryLabel(
        [alexCipher, opsCipher],
        ChangeNotificationNewEntryTarget,
        i18n,
        true,
      ),
    ).toBe(chrome.i18n.getMessage("notificationMultiSaveCreate", ["3"]));
  });

  it("numbers the new entry from zero when no candidate matched the password", () => {
    expect(
      getChangeNotificationPrimaryLabel([], ChangeNotificationNewEntryTarget, i18n, false, 2),
    ).toBe(chrome.i18n.getMessage("notificationMultiSaveCreate", ["3"]));
  });

  it("numbers the new entry after every entry saved for the page", () => {
    expect(
      getChangeNotificationPrimaryLabel(
        [alexCipher, opsCipher],
        ChangeNotificationNewEntryTarget,
        i18n,
        true,
        3,
      ),
    ).toBe(chrome.i18n.getMessage("notificationMultiSaveCreate", ["4"]));
  });
});

describe("NotificationChangeContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chrome.i18n.getMessage as jest.Mock).mockImplementation(
      (key: string, substitutions?: string | string[]) =>
        substitutions ? `${key}:${substitutions}` : key,
    );
  });

  it("shows the single entry summary with update, switch, and ignore actions", () => {
    const flat = flatten(render());

    expect(flat).toContain("notificationChangeHeader:Northwind");
    expect(flat).toContain("notificationChangeBodyVersion:3");
    expect(flat).toContain("notificationUpdateVersion:4");
    expect(flat).toContain("Switch / save as new");
    expect(flat).toContain("Ignore");
    expect(chrome.i18n.getMessage).not.toHaveBeenCalledWith("notificationMultiSaveDesc");
  });

  it("lists every matched entry and the save-as-new row in picker mode", () => {
    const flat = flatten(
      render({
        ciphers: [alexCipher, opsCipher],
        selectedTarget: alexCipher.id,
      }),
    );

    expect(flat).toContain("notificationMultiSaveHeader:northwind.io");
    expect(flat).toContain("notificationMultiSaveDesc");
    expect(flat).toContain("Northwind · v3");
    expect(flat).toContain("Northwind Ops · v2");
    expect(flat).toContain("notificationMultiSaveNewEntry:3");
    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("notificationMultiSaveUpdate", [
      "alex@northwind.io",
    ]);
    expect(flat).not.toContain("Switch / save as new");
  });

  it("renders only the save-as-new row when no entry matched the password", () => {
    const flat = flatten(
      render({
        ciphers: [],
        existingEntryCount: 3,
        selectedTarget: ChangeNotificationNewEntryTarget,
      }),
    );

    expect(flat).toContain("notificationChangeNoMatchHeader:northwind.io");
    expect(flat).toContain("notificationChangeNoMatchDesc");
    expect(flat).not.toContain("notificationMultiSaveHeader:northwind.io");
    expect(flat).not.toContain("notificationMultiSaveDesc");
    expect(flat).toContain("notificationMultiSaveNewEntry:4");
    expect(flat).toContain("notificationMultiSaveNewEntryDesc");
    expect(flat).toContain("notificationMultiSaveCreate:4");
    // Zero candidates must still render exactly one radio row: the new-entry option.
    expect(
      flat.filter(
        (value) => typeof value === "string" && value.startsWith("notificationMultiSaveNewEntry:"),
      ),
    ).toHaveLength(1);
    expect(flat).not.toContain("Switch / save as new");
  });

  it("shows the real revision and last-used time for each candidate", () => {
    const recent = cipher({
      id: "cipher-recent",
      name: "Northwind",
      login: { username: "alex@northwind.io" },
      versionCount: 3,
      lastUsedAt: Date.now() - 2 * 60_000,
    });
    const flat = flatten(render({ ciphers: [recent, opsCipher], selectedTarget: recent.id }));

    expect(flat).toContain("Northwind · notificationLastUsedMinutes:2 · v3");
  });

  it("marks entries without a username so the picker never shows a blank row", () => {
    render({
      ciphers: [cipher({ id: "cipher-unnamed" }), opsCipher],
      selectedTarget: opsCipher.id,
    });

    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("notificationMultiSaveNoUsername");
  });

  it("numbers the new-entry row after all entries saved for the page", () => {
    const flat = flatten(
      render({
        ciphers: [alexCipher, opsCipher],
        existingEntryCount: 3,
        selectedTarget: ChangeNotificationNewEntryTarget,
      }),
    );

    expect(flat).toContain("notificationMultiSaveNewEntry:4");
    expect(flat).toContain("notificationMultiSaveCreate:4");
  });

  it("labels the commit action for a new entry when the user picks save-as-new", () => {
    render({
      ciphers: [alexCipher, opsCipher],
      selectedTarget: ChangeNotificationNewEntryTarget,
    });

    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("notificationMultiSaveCreate", ["3"]);
  });

  it("wires the close control to the supplied close handler", () => {
    const handleCloseNotification = jest.fn();
    const event = new Event("click");
    flatten(render({ handleCloseNotification }))
      .filter((value): value is (event: Event) => void => typeof value === "function")
      .forEach((handler) => handler(event));

    expect(handleCloseNotification).toHaveBeenCalledWith(event);
  });
});
