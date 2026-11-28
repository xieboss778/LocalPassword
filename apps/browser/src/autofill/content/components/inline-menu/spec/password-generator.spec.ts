import { ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { keyupEvent } from "../../lit-stories/lit-values";
import { mockI18n, mockPasswordGeneratorI18n } from "../../lit-stories/mock-data";
import { InlineMenuPasswordGenerator } from "../password-generator";

jest.mock("lit", () => jest.requireActual("../../lit-stories/lit-jest-mocks").litMock);
jest.mock("../container", () => ({ InlineMenuContainer: jest.fn(({ children }) => children) }));

describe("InlineMenuPasswordGenerator", () => {
  const baseProps = {
    password: "f9#Wx",
    headingText: mockI18n.fillGeneratedPassword,
    theme: ThemeTypes.Light,
    i18n: mockPasswordGeneratorI18n,
    handleFillPassword: jest.fn(),
    handleRefreshPassword: jest.fn(),
  };

  /**
   * Handlers in template order: fill click, fill keyup, footer action click, footer action keyup.
   * The Lit mock returns each template's interpolated values as nested arrays, so the handlers are
   * collected depth-first to keep the test stable when surrounding markup changes.
   */
  function renderHandlers() {
    const handlers = collectHandlers(InlineMenuPasswordGenerator(baseProps));
    return {
      fillClick: handlers[0],
      fillKeyUp: handlers[1],
      refreshClick: handlers[2],
      refreshKeyUp: handlers[3],
    };
  }

  function collectHandlers(value: unknown, found: Array<(event: Event) => void> = []) {
    if (typeof value === "function") {
      found.push(value as (event: Event) => void);
    } else if (Array.isArray(value)) {
      value.forEach((item) => collectHandlers(item, found));
    }
    return found;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  function renderKeyboardDom() {
    const fill = document.createElement("button");
    fill.setAttribute("data-fill-generated-password", "");
    const refresh = document.createElement("button");
    refresh.setAttribute("data-testid", "refresh-generated-password");
    document.body.append(fill, refresh);
    fill.focus = jest.fn();
    refresh.focus = jest.fn();
    return { fill, refresh };
  }

  describe("click handlers", () => {
    it("calls handleFillPassword when the event is trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      renderHandlers().fillClick(new MouseEvent("click"));

      expect(baseProps.handleFillPassword).toHaveBeenCalled();
    });

    it("does not call handleFillPassword when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      renderHandlers().fillClick(new MouseEvent("click"));

      expect(baseProps.handleFillPassword).not.toHaveBeenCalled();
    });

    it("calls handleRefreshPassword when the event is trusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);

      renderHandlers().refreshClick(new MouseEvent("click"));

      expect(baseProps.handleRefreshPassword).toHaveBeenCalled();
    });

    it("does not call handleRefreshPassword when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);

      renderHandlers().refreshClick(new MouseEvent("click"));

      expect(baseProps.handleRefreshPassword).not.toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("moves focus to the footer refresh action on ArrowRight", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderKeyboardDom();

      renderHandlers().fillKeyUp(keyupEvent("ArrowRight", fill));

      expect(refresh.focus).toHaveBeenCalled();
    });

    it("does not move focus on ArrowRight when the event is untrusted", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(false);
      const { fill, refresh } = renderKeyboardDom();

      renderHandlers().fillKeyUp(keyupEvent("ArrowRight", fill));

      expect(refresh.focus).not.toHaveBeenCalled();
    });

    it("ignores ArrowLeft on the fill button's keyup handler", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderKeyboardDom();

      renderHandlers().fillKeyUp(keyupEvent("ArrowLeft", fill));

      expect(refresh.focus).not.toHaveBeenCalled();
    });

    it("ignores keyup events with modifier keys held", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderKeyboardDom();

      renderHandlers().fillKeyUp(keyupEvent("ArrowRight", fill, { ctrlKey: true }));

      expect(refresh.focus).not.toHaveBeenCalled();
    });

    it("moves focus back to the fill row on ArrowLeft", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderKeyboardDom();

      renderHandlers().refreshKeyUp(keyupEvent("ArrowLeft", refresh));

      expect(fill.focus).toHaveBeenCalled();
    });

    it("ignores ArrowRight on the refresh action's keyup handler", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const { fill, refresh } = renderKeyboardDom();

      renderHandlers().refreshKeyUp(keyupEvent("ArrowRight", refresh));

      expect(fill.focus).not.toHaveBeenCalled();
    });

    it("moves focus between fill and refresh inside a closed shadow root", () => {
      jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
      const host = document.createElement("div");
      document.body.append(host);
      const shadow = host.attachShadow({ mode: "closed" });
      const container = document.createElement("div");
      container.setAttribute("data-testid", "inline-menu-password-generator");
      const fill = document.createElement("button");
      fill.setAttribute("data-fill-generated-password", "");
      fill.focus = jest.fn();
      const refresh = document.createElement("button");
      refresh.setAttribute("data-testid", "refresh-generated-password");
      refresh.focus = jest.fn();
      container.append(fill, refresh);
      shadow.append(container);

      const handlers = renderHandlers();
      handlers.fillKeyUp(keyupEvent("ArrowRight", fill));
      expect(refresh.focus).toHaveBeenCalledTimes(1);

      handlers.refreshKeyUp(keyupEvent("ArrowLeft", refresh));
      expect(fill.focus).toHaveBeenCalledTimes(1);
    });
  });
});
