import { ThemeTypes } from "@localpass/common/platform/enums";

import { EventSecurity } from "../../../../utils/event-security";
import { InlineMenuPasskeyVerifying } from "../passkey-verifying";

type FakeTemplate = { strings: string[]; values: unknown[] };

jest.mock("lit", () => ({
  html: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  })),
}));
jest.mock("@emotion/css", () => ({ css: jest.fn(() => "") }));
jest.mock("../menu-header", () => ({ InlineMenuHeader: jest.fn(() => "header") }));
jest.mock("../menu-shell", () => ({ InlineMenuShell: jest.fn((props) => props) }));

describe("InlineMenuPasskeyVerifying", () => {
  const i18n = {
    headerCount: "Verifying",
    title: "Verifying passkey for {username}",
    body: "Confirm in the system passkey prompt. This menu stays until verification completes.",
    timeout: "Closes when verification completes or the prompt times out",
    cancel: "Cancel",
    ariaLabel: "Passkey verification in progress",
    closeAria: "Close LocalPass menu",
    showAll: "Show all",
  };

  function renderComponent(onCancel = jest.fn()) {
    document.body.innerHTML = "";
    const shell = InlineMenuPasskeyVerifying({
      theme: ThemeTypes.Light,
      domain: "northwind.io",
      username: "alex@northwind.io",
      i18n,
      onCancel,
    }) as unknown as { children: FakeTemplate };

    // The lit mock returns the interpolated values only, so rebuild the markup from the
    // template strings to get a real DOM for structural assertions. Event handlers cannot be
    // serialized; they are exercised through the template values in the cancel test.
    document.body.innerHTML = shell.children.strings.reduce((markup, literal, index) => {
      const value = shell.children.values[index];
      const interpolated =
        typeof value === "function" || value == null ? "" : value === "" ? '""' : String(value);
      return markup + literal + interpolated;
    }, "");

    return { onCancel, shell };
  }

  function queryCancel(): HTMLElement {
    const cancel = document.querySelector<HTMLElement>("[data-inline-passkey-cancel]");
    expect(cancel).not.toBeNull();
    return cancel as HTMLElement;
  }

  it("renders the spinner, title, and body in the status row without a cancel action", () => {
    renderComponent();

    const row = document.querySelector('[role="status"]');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("Verifying passkey for alex@northwind.io");
    expect(row?.textContent).toContain(i18n.body);
    expect(row?.querySelector("[data-inline-passkey-cancel]")).toBeNull();
  });

  it("renders the cancel action and timeout in the footer outside the status row", () => {
    renderComponent();

    const cancel = queryCancel();
    expect(cancel.textContent.trim()).toBe(i18n.cancel);
    expect(cancel.hasAttribute("data-inline-menu-focusable")).toBe(true);

    const row = document.querySelector('[role="status"]');
    const footer = cancel.parentElement as HTMLElement;
    expect(row?.nextElementSibling).toBe(footer);
    expect(cancel.closest('[role="status"]')).toBeNull();
    expect(footer.querySelector('[role="status"]')).toBeNull();
    expect(footer.textContent).toContain(i18n.timeout);
  });

  it("does not render the old domain meta bar", () => {
    renderComponent();

    expect(document.body.textContent).not.toContain("WebAuthn");
    expect(document.body.textContent).not.toContain("northwind.io ·");
  });

  it("calls onCancel when the cancel action is invoked", () => {
    jest.spyOn(EventSecurity, "isEventTrusted").mockReturnValue(true);
    const { onCancel, shell } = renderComponent();
    const cancelHandler = shell.children.values.find(
      (value): value is (event: Event) => void => typeof value === "function",
    );

    cancelHandler?.(new Event("click"));

    expect(onCancel).toHaveBeenCalled();
  });
});
