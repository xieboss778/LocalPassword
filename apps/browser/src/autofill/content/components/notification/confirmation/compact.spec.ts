import { ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { I18n } from "../../common-types";

import { NotificationSaveConfirmation } from "./compact";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("@emotion/css", () => ({ css: jest.fn(() => "") }));
jest.mock("../../icons", () => ({
  Check: jest.fn(() => "check-icon"),
  Close: jest.fn(() => "close-icon"),
}));

const i18n: I18n = {
  close: "Close",
  done: "Done",
  notificationAddTotp: "Add 2FA / Edit entry",
};

function flatten(value: unknown): unknown[] {
  return Array.isArray(value) ? value.flatMap(flatten) : [value];
}

function render(
  props: Partial<Parameters<typeof NotificationSaveConfirmation>[0]> = {},
): unknown[] {
  return flatten(
    NotificationSaveConfirmation({
      confirmationMessage: "Encrypted into “Work” · auto-closes in 2 minutes",
      handleCloseNotification: jest.fn(),
      handleEditEntry: jest.fn(),
      headerMessage: "Login saved",
      i18n,
      itemName: "Northwind",
      username: "alex@northwind.io",
      notificationTestId: "confirmation-notification-bar",
      theme: ThemeTypes.Light,
      ...props,
    }),
  );
}

describe("NotificationSaveConfirmation", () => {
  it("shows the success header, the saved entry, and the result message", () => {
    const flat = render();

    expect(flat).toContain("Login saved");
    expect(flat).toContain("Northwind · alex@northwind.io");
    expect(flat).toContain("Encrypted into “Work” · auto-closes in 2 minutes");
    expect(flat).toContain("Add 2FA / Edit entry");
    expect(flat).toContain("Done");
  });

  it("offers the edit action only when the entry id is known", () => {
    const flat = render({ handleEditEntry: undefined });

    expect(flat).not.toContain("Add 2FA / Edit entry");
    expect(flat).toContain("Done");
  });

  it("routes the close and edit actions to their handlers only for trusted events", () => {
    const handleCloseNotification = jest.fn();
    const handleEditEntry = jest.fn();
    const handlers = render({ handleCloseNotification, handleEditEntry }).filter(
      (value): value is (event: Event) => void => typeof value === "function",
    );

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleCloseNotification).not.toHaveBeenCalled();
    expect(handleEditEntry).not.toHaveBeenCalled();

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleCloseNotification).toHaveBeenCalledTimes(2);
    expect(handleEditEntry).toHaveBeenCalledTimes(1);
  });
});
