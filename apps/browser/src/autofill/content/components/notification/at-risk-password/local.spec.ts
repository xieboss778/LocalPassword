import { ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { I18n } from "../../common-types";

import { LocalAtRiskNotification } from "./local";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("@emotion/css", () => ({ css: jest.fn(() => "") }));
jest.mock("../../icons", () => ({
  Close: jest.fn(() => "close-icon"),
  Wand: jest.fn(() => "wand-icon"),
}));

const i18n: I18n = {
  atRiskPassword: "存在风险的密码",
  notificationAtRiskHeading: "此账号使用了重复或偏弱密码",
  changePassword: "更改密码",
  close: "关闭",
  later: "稍后",
  weakPasswordsTitle: "弱密码",
};

function flatten(value: unknown): unknown[] {
  return Array.isArray(value) ? value.flatMap(flatten) : [value];
}

function render(props: Partial<Parameters<typeof LocalAtRiskNotification>[0]> = {}): unknown[] {
  return flatten(
    LocalAtRiskNotification({
      kind: "reused",
      sharedCount: 2,
      entryName: "Example",
      username: "test-user",
      i18n,
      notificationTestId: "at-risk-notification-bar",
      theme: ThemeTypes.Light,
      handleCloseNotification: jest.fn(),
      handleFixPassword: jest.fn(),
      ...props,
    }),
  );
}

describe("LocalAtRiskNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chrome.i18n.getMessage as jest.Mock).mockImplementation(
      (key: string, substitutions?: string | string[]) => {
        if (key === "reusedPasswordsPlaces") {
          return `重复 ${substitutions?.[0] ?? "?"} 处`;
        }
        if (key === "passwordReusedForSeveralLogins") {
          return "多个登录处重复使用同一密码。";
        }
        if (key === "passwordTooShortOrSimple") {
          return "密码过短或过于简单。";
        }
        return "";
      },
    );
  });

  it("names the shared-password rule, the matched entry, and the share count", () => {
    const flat = render();

    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("reusedPasswordsPlaces", ["2"]);
    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("passwordReusedForSeveralLogins");
    expect(flat).toContain("此账号使用了重复或偏弱密码");
    expect(flat).toContain("重复 2 处");
    expect(flat).toContain("Example · test-user");
    expect(flat).toContain("多个登录处重复使用同一密码。");
    expect(flat).toContain("更改密码");
    expect(flat).toContain("稍后");
  });

  it("shows the weak-password rule instead when that is the finding", () => {
    const flat = render({ kind: "weak", sharedCount: 1 });

    expect(chrome.i18n.getMessage).not.toHaveBeenCalledWith(
      "reusedPasswordsPlaces",
      expect.anything(),
    );
    expect(chrome.i18n.getMessage).toHaveBeenCalledWith("passwordTooShortOrSimple");
    expect(flat).toContain("弱密码");
    expect(flat).toContain("密码过短或过于简单。");
  });

  it("shows the entry name alone when the saved login has no username", () => {
    const flat = render({ username: "" });

    expect(flat).toContain("Example");
    expect(flat).not.toContain("Example · ");
  });

  it("routes the close and later actions to the close handler only for trusted events", () => {
    const handleCloseNotification = jest.fn();
    const handleFixPassword = jest.fn();
    const handlers = render({ handleCloseNotification, handleFixPassword }).filter(
      (value): value is (event: Event) => void => typeof value === "function",
    );

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleCloseNotification).not.toHaveBeenCalled();

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleCloseNotification).toHaveBeenCalledTimes(2);
  });

  it("routes the change-password action to the fix handler only for trusted events", () => {
    const handleFixPassword = jest.fn();
    const handlers = render({ handleFixPassword }).filter(
      (value): value is (event: Event) => void => typeof value === "function",
    );

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleFixPassword).not.toHaveBeenCalled();

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    handlers.forEach((handler) => handler(new MouseEvent("click")));
    expect(handleFixPassword).toHaveBeenCalledTimes(1);
  });
});
