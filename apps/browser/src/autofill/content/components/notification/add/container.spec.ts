import { ThemeTypes } from "@localpass/common/platform/enums";
import { CipherRepromptType, CipherType } from "@localpass/common/vault/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { NotificationCipherData } from "../../cipher/types";
import { FolderView, I18n } from "../../common-types";
import { selectedFolder as selectedFolderSignal } from "../../signals/selected-folder";

import { handleFolderSelection, NotificationAddContainer } from "./container";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("@emotion/css", () => ({ css: jest.fn(() => "") }));
jest.mock("../../icons", () => ({ Close: jest.fn(() => "close-icon") }));
jest.mock("@lit-labs/signals", () => ({
  signal: jest.fn((initial: unknown) => {
    let value = initial;
    return {
      get: () => value,
      set: (next: unknown) => {
        value = next;
      },
    };
  }),
}));

const i18n: I18n = {
  close: "Close",
  folder: "Folder",
  never: "Never",
  noFolder: "No folder",
  notificationAddDesc: "Remember this password?",
  notificationAddSave: "Save",
  notificationNeverForSite: "Never for this site",
  saveLogin: "Save login",
};

const messages: Record<string, string> = {
  notificationAddHeading: "Save the login for $1?",
  notificationAddSubtitleChoice: "First login to $1 · choose a folder, then save on this device",
  notificationAddSubtitleNoFolder: "First login to $1 · saves encrypted on this device",
  notificationAddSaveToFolder: "Save to “$1”",
};

const noneFolder: FolderView = { id: "", name: "No folder" };
const workFolder: FolderView = { id: "folder-work", name: "Work" };

const draftCipher: NotificationCipherData = {
  id: "cipher-draft",
  name: "northwind.io",
  type: CipherType.Login,
  reprompt: CipherRepromptType.None,
  favorite: false,
  icon: { imageEnabled: false, image: "", fallbackImage: "", icon: "globe" },
  login: { username: "alex@northwind.io" },
};

function flatten(value: unknown): unknown[] {
  return Array.isArray(value) ? value.flatMap(flatten) : [value];
}

function render(props: Partial<Parameters<typeof NotificationAddContainer>[0]> = {}): unknown[] {
  return flatten(
    NotificationAddContainer({
      ciphers: [draftCipher],
      domain: "northwind.io",
      folders: [noneFolder, workFolder],
      handleCloseNotification: jest.fn(),
      handleNeverSave: jest.fn(),
      handleSaveAction: jest.fn(),
      i18n,
      notificationTestId: "save-notification-bar",
      theme: ThemeTypes.Light,
      ...props,
    }),
  );
}

describe("NotificationAddContainer", () => {
  beforeEach(() => {
    selectedFolderSignal.set("0");
    (chrome.i18n.getMessage as jest.Mock).mockImplementation(
      (key: string, substitutions?: string[]) =>
        (messages[key] ?? "").replace(/\$1/g, substitutions?.[0] ?? ""),
    );
  });

  it("shows the drafted account, the site, and the folder choices", () => {
    const flat = render();

    expect(flat).toContain("Save the login for northwind.io?");
    expect(flat).toContain("alex@northwind.io");
    expect(flat).toContain(
      "First login to northwind.io · choose a folder, then save on this device",
    );
    expect(flat).toContain("No folder");
    expect(flat).toContain("Work");
    expect(flat).toContain("Save");
    expect(flat).toContain("Never for this site");
  });

  it("omits the folder select when the vault has no folders", () => {
    const flat = render({ folders: [] });

    expect(flat).not.toContain("No folder");
    expect(flat).toContain("First login to northwind.io · saves encrypted on this device");
    expect(flat).toContain("Save");
  });

  it("labels the save action with the selected folder", () => {
    selectedFolderSignal.set("folder-work");

    const flat = render();

    expect(flat).toContain("Save to “Work”");
  });

  it("records the chosen folder for the save handler", () => {
    handleFolderSelection({ target: { value: "folder-work" } } as unknown as Event);

    expect(selectedFolderSignal.get()).toBe("folder-work");
  });

  it("routes close, save, and never actions to their handlers only for trusted events", () => {
    const handleCloseNotification = jest.fn();
    const handleNeverSave = jest.fn();
    const handleSaveAction = jest.fn();
    const handlers = flatten(
      render({ handleCloseNotification, handleNeverSave, handleSaveAction }),
    ).filter((value): value is (event: Event) => void => typeof value === "function");

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleCloseNotification).not.toHaveBeenCalled();
    expect(handleNeverSave).not.toHaveBeenCalled();
    expect(handleSaveAction).not.toHaveBeenCalled();

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleCloseNotification).toHaveBeenCalledTimes(1);
    expect(handleNeverSave).toHaveBeenCalledTimes(1);
    expect(handleSaveAction).toHaveBeenCalledTimes(1);
  });
});
