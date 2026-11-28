import { ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { litValues } from "../../lit-stories/lit-values";
import { mockI18n } from "../../lit-stories/mock-data";
import { InlineMenuUnlock } from "../unlock";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../container", () => ({ InlineMenuContainer: jest.fn(({ children }) => children) }));
jest.mock("../menu-header", () => ({ InlineMenuHeader: jest.fn(() => "header") }));

describe("InlineMenuUnlock", () => {
  const baseProps = {
    theme: ThemeTypes.Light,
    domain: "northwind.test",
    i18n: {
      closeAria: mockI18n.close,
      showAll: mockI18n.inlineMenuShowAll,
      locked: mockI18n.inlineMenuLocked,
      message: "Unlock to fill northwind.test",
      password: mockI18n.masterPassword,
      unlock: mockI18n.unlockAccount,
      unlockAria: mockI18n.inlineMenuUnlockAria,
      biometrics: mockI18n.unlockWithBiometrics,
      biometricsAria: mockI18n.unlockWithBiometrics,
      footnote: mockI18n.inlineMenuUnlockFootnote,
    },
    showBiometrics: true,
    busy: false,
    error: null as string | null,
    onSubmit: jest.fn(),
    onBiometrics: jest.fn(),
    onClose: jest.fn(),
  };

  function collectHandlers(value: unknown, found: Array<(event: Event) => void> = []) {
    if (typeof value === "function") {
      found.push(value as (event: Event) => void);
    } else if (Array.isArray(value)) {
      value.forEach((item) => collectHandlers(item, found));
    }
    return found;
  }

  function renderHandlers(props = baseProps) {
    const handlers = collectHandlers(InlineMenuUnlock(props));
    return {
      keydown: handlers[0] as (event: KeyboardEvent) => void,
      submitClick: handlers[1] as (event: Event) => void,
      biometrics: handlers[2] as (event: Event) => void,
    };
  }

  function renderInput(password: string) {
    document.body.innerHTML = "";
    const input = document.createElement("input");
    input.setAttribute("data-inline-menu-unlock-password", "");
    input.value = password;
    document.body.append(input);
    return input;
  }

  function enterEvent(input: HTMLInputElement, key = "Enter") {
    return {
      key,
      currentTarget: input,
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("renders the site-specific message and the footnote", () => {
    const values = litValues(InlineMenuUnlock(baseProps));

    expect(JSON.stringify(values)).toContain("Unlock to fill northwind.test");
    expect(JSON.stringify(values)).toContain(mockI18n.inlineMenuUnlockFootnote);
  });

  it("submits the typed password on Enter and clears the field", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const input = renderInput("master-password");

    renderHandlers().keydown(enterEvent(input));

    expect(baseProps.onSubmit).toHaveBeenCalledWith("master-password");
    expect(input.value).toBe("");
  });

  it("submits the typed password from the unlock button", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const input = renderInput("master-password");

    renderHandlers().submitClick(new MouseEvent("click"));

    expect(baseProps.onSubmit).toHaveBeenCalledWith("master-password");
    expect(input.value).toBe("");
  });

  it("finds and clears the password input inside a closed shadow root", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "closed" });
    const form = document.createElement("div");
    form.setAttribute("data-inline-menu-unlock-form", "");
    const input = document.createElement("input");
    input.setAttribute("data-inline-menu-unlock-password", "");
    input.value = "shadow-secret";
    const button = document.createElement("button");
    form.append(input, button);
    shadow.append(form);

    renderHandlers().submitClick({ currentTarget: button } as unknown as Event);

    expect(baseProps.onSubmit).toHaveBeenCalledWith("shadow-secret");
    expect(input.value).toBe("");
  });

  it("does not submit an empty password", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const input = renderInput("");
    const handlers = renderHandlers();

    handlers.keydown(enterEvent(input));
    handlers.submitClick(new MouseEvent("click"));

    expect(baseProps.onSubmit).not.toHaveBeenCalled();
  });

  it("ignores submissions that are not trusted or while busy", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
    const input = renderInput("master-password");
    const handlers = renderHandlers();
    handlers.keydown(enterEvent(input));
    handlers.submitClick(new MouseEvent("click"));
    expect(baseProps.onSubmit).not.toHaveBeenCalled();

    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const busy = { ...baseProps, busy: true };
    const busyHandlers = renderHandlers(busy);
    busyHandlers.keydown(enterEvent(input));
    busyHandlers.submitClick(new MouseEvent("click"));
    expect(baseProps.onSubmit).not.toHaveBeenCalled();
  });

  it("submits only on Enter, not on other keys", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const input = renderInput("master-password");

    renderHandlers().keydown(enterEvent(input, "a"));

    expect(baseProps.onSubmit).not.toHaveBeenCalled();
  });

  it("calls the biometrics and close actions only for trusted events", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const { biometrics } = renderHandlers();

    biometrics(new MouseEvent("click"));

    expect(baseProps.onBiometrics).toHaveBeenCalled();
  });

  it("hides the biometrics action when the bridge is unavailable", () => {
    const values = litValues(
      InlineMenuUnlock({ ...baseProps, showBiometrics: false, onBiometrics: jest.fn() }),
    );

    expect(JSON.stringify(values)).not.toContain(mockI18n.unlockWithBiometrics);
    expect(collectHandlers(InlineMenuUnlock({ ...baseProps, showBiometrics: false }))).toHaveLength(
      2,
    );
  });

  it("renders the failure message", () => {
    const values = litValues(
      InlineMenuUnlock({ ...baseProps, error: mockI18n.inlineMenuUnlockFailed }),
    );

    expect(JSON.stringify(values)).toContain(mockI18n.inlineMenuUnlockFailed);
  });
});
