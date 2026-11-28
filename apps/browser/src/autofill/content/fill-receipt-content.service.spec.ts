import { render } from "lit";

import { ThemeTypes } from "@localpass/common/platform/enums";

import { AutofillFillReceipt } from "./components/fill-receipt/fill-receipt";
import { AutofillFillReceiptContentService } from "./fill-receipt-content.service";

jest.mock("lit", () => ({ render: jest.fn() }));
jest.mock("./components/fill-receipt/fill-receipt", () => ({
  AutofillFillReceipt: jest.fn(() => "receipt"),
}));

describe("AutofillFillReceiptContentService", () => {
  const receipt = { kind: "card" as const, last4: "4242", theme: ThemeTypes.Light };
  let service: AutofillFillReceiptContentService;
  let onUndo: jest.Mock;
  let onRefill: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new AutofillFillReceiptContentService();
    onUndo = jest.fn();
    onRefill = jest.fn();
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  function shownProps() {
    return jest.mocked(AutofillFillReceipt).mock.calls[0][0];
  }

  it("appends an isolated host and renders the receipt", () => {
    service.show(receipt, { onUndo, onRefill });

    const host = service["host"];
    expect(host?.parentElement).toBe(document.body);
    expect(host?.style.position).toBe("fixed");
    expect(host?.style.right).toBe("12px");
    expect(host?.style.bottom).toBe("12px");
    expect(host?.style.width).toBe("320px");
    expect(AutofillFillReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ receipt, undone: false }),
    );
    expect(render).toHaveBeenCalled();
  });

  it("forwards the undo and refill actions", () => {
    service.show(receipt, { onUndo, onRefill });

    shownProps().onUndo();
    shownProps().onRefill();

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRefill).toHaveBeenCalledTimes(1);
  });

  it("re-renders in the undone state and keeps dismissing from the latest state", () => {
    service.show(receipt, { onUndo, onRefill });
    jest.mocked(AutofillFillReceipt).mockClear();

    jest.advanceTimersByTime(7000);
    service.setUndone(true);

    expect(AutofillFillReceipt).toHaveBeenLastCalledWith(expect.objectContaining({ undone: true }));

    jest.advanceTimersByTime(7000);
    expect(service["host"]).toBeDefined();

    jest.advanceTimersByTime(1000);
    expect(service["host"]).toBeUndefined();
  });

  it("dismisses after eight seconds and clears the fill reference", () => {
    service.show(receipt, { onUndo, onRefill });
    const host = service["host"];

    jest.advanceTimersByTime(8000);

    expect(host?.isConnected).toBe(false);
    expect(service["host"]).toBeUndefined();
    expect(service["receipt"]).toBeUndefined();
    expect(service["handlers"]).toBeUndefined();
  });

  it("notifies the owner once when a shown receipt dismisses", () => {
    const onDismiss = jest.fn();
    service.show(receipt, { onUndo, onRefill, onDismiss });

    jest.advanceTimersByTime(8000);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not notify dismissal for a receipt that was never shown", () => {
    const onDismiss = jest.fn();

    service.destroy();
    service.destroy();

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("is idempotent when destroyed", () => {
    const onDismiss = jest.fn();
    service.show(receipt, { onUndo, onRefill, onDismiss });

    service.destroy();
    service.destroy();

    expect(service["host"]).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
