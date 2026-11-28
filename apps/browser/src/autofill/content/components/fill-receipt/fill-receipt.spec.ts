import { ThemeTypes } from "@localpass/common/platform/enums";

import { InlineMenuFillReceipt } from "../../../types/inline-menu-fill-receipt";
import { EventSecurity } from "../../../utils/event-security";
import { litHandler, litValues } from "../lit-stories/lit-values";

import { AutofillFillReceipt } from "./fill-receipt";

jest.mock("lit", () => jest.requireActual("../lit-stories/lit-jest-mocks").litMock);
jest.mock("@emotion/css", () => ({
  css: jest.fn(() => ""),
  keyframes: jest.fn(() => ""),
}));
jest.mock("../icons", () => ({ Check: jest.fn(() => "check") }));

const TITLE_SLOT = 5;
const DETAIL_SLOT = 6;
const ACTION_HANDLER_SLOT = 8;
const ACTION_LABEL_SLOT = 9;

describe("AutofillFillReceipt", () => {
  const cardReceipt: InlineMenuFillReceipt = {
    kind: "card",
    last4: "4242",
    theme: ThemeTypes.Light,
  };
  const identityReceipt: InlineMenuFillReceipt = {
    kind: "identity",
    theme: ThemeTypes.Light,
  };
  const loginReceipt: InlineMenuFillReceipt = {
    kind: "login",
    title: "GitHub",
    theme: ThemeTypes.Light,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    (chrome.i18n.getMessage as jest.Mock).mockImplementation(
      (key: string, substitutions?: string | string[]) =>
        substitutions ? `${key}:${substitutions}` : key,
    );
  });

  it("names the card by its last four digits", () => {
    const values = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: cardReceipt,
        undone: false,
        onUndo: jest.fn(),
        onRefill: jest.fn(),
      }),
    );

    expect(values[TITLE_SLOT]).toBe("autofillFillReceiptCardTitle:4242");
    expect(values[DETAIL_SLOT]).toBe("autofillFillReceiptCardDetail");
    expect(values[ACTION_LABEL_SLOT]).toBe("autofillFillReceiptUndo");
  });

  it("falls back to a generic card title when no number is stored", () => {
    const values = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: { kind: "card", theme: ThemeTypes.Light },
        undone: false,
        onUndo: jest.fn(),
        onRefill: jest.fn(),
      }),
    );

    expect(values[TITLE_SLOT]).toBe("autofillFillReceiptCardTitleNoLast4");
  });

  it("uses identity and login wording for their fill kinds", () => {
    const identity = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: identityReceipt,
        undone: false,
        onUndo: jest.fn(),
        onRefill: jest.fn(),
      }),
    );
    const login = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: loginReceipt,
        undone: false,
        onUndo: jest.fn(),
        onRefill: jest.fn(),
      }),
    );

    expect(identity[TITLE_SLOT]).toBe("autofillFillReceiptIdentityTitle");
    expect(login[TITLE_SLOT]).toBe("autofillFillReceiptLoginTitle:GitHub");
  });

  it("switches to the undone wording and refill action", () => {
    const values = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: cardReceipt,
        undone: true,
        onUndo: jest.fn(),
        onRefill: jest.fn(),
      }),
    );

    expect(values[TITLE_SLOT]).toBe("autofillFillReceiptUndoneTitle");
    expect(values[DETAIL_SLOT]).toBe("autofillFillReceiptUndoneDetail");
    expect(values[ACTION_LABEL_SLOT]).toBe("autofillFillReceiptRefill");
  });

  it("runs undo while filled and refill after an undo", () => {
    const onUndo = jest.fn();
    const onRefill = jest.fn();
    const filled = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: cardReceipt,
        undone: false,
        onUndo,
        onRefill,
      }),
    );
    const undone = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: cardReceipt,
        undone: true,
        onUndo,
        onRefill,
      }),
    );

    litHandler(filled, ACTION_HANDLER_SLOT)(new Event("click"));
    litHandler(undone, ACTION_HANDLER_SLOT)(new Event("click"));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRefill).toHaveBeenCalledTimes(1);
  });

  it("ignores untrusted clicks", () => {
    jest.mocked(EventSecurity.isEventTrusted).mockReturnValue(false);
    const onUndo = jest.fn();
    const values = litValues(
      AutofillFillReceipt({
        theme: ThemeTypes.Light,
        receipt: cardReceipt,
        undone: false,
        onUndo,
        onRefill: jest.fn(),
      }),
    );

    litHandler(values, ACTION_HANDLER_SLOT)(new Event("click"));

    expect(onUndo).not.toHaveBeenCalled();
  });
});
