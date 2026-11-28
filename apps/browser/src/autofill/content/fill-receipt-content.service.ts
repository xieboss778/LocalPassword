import { render } from "lit";

import { InlineMenuFillReceipt } from "../types/inline-menu-fill-receipt";
import { generateRandomCustomElementName } from "../utils";
import { resolveTheme } from "../utils/resolve-theme";

import { AutofillFillReceipt } from "./components/fill-receipt/fill-receipt";

/** How long the receipt stays on the page before it dismisses itself. */
const RECEIPT_VISIBLE_MS = 8000;

export type AutofillFillReceiptHandlers = {
  onUndo: () => void;
  onRefill: () => void;
};

/**
 * Owns the bottom-right fill receipt host. The host is a randomly named custom element with a
 * closed shadow root, mirroring the inline menu's isolation from page styles, and is removed when
 * the receipt dismisses so no reference to the filled values outlives it.
 */
export class AutofillFillReceiptContentService {
  private customElementName?: string;
  private host?: HTMLElement;
  private shadowRoot?: ShadowRoot;
  private receipt?: InlineMenuFillReceipt;
  private handlers?: AutofillFillReceiptHandlers;
  private undone = false;
  private dismissTimeout?: number | NodeJS.Timeout;

  show(receipt: InlineMenuFillReceipt, handlers: AutofillFillReceiptHandlers): void {
    this.receipt = receipt;
    this.handlers = handlers;
    this.undone = false;
    this.ensureHost();
    this.renderReceipt();
    this.scheduleDismiss();
  }

  setUndone(undone: boolean): void {
    if (!this.receipt || this.undone === undone) {
      return;
    }
    this.undone = undone;
    this.renderReceipt();
    this.scheduleDismiss();
  }

  destroy(): void {
    this.clearDismissTimeout();
    if (this.shadowRoot) {
      render(null, this.shadowRoot);
    }
    this.host?.remove();
    this.host = undefined;
    this.shadowRoot = undefined;
    this.receipt = undefined;
    this.handlers = undefined;
    this.undone = false;
  }

  private ensureHost() {
    if (this.host?.isConnected) {
      return;
    }

    if (!this.customElementName) {
      this.customElementName = generateRandomCustomElementName();
      globalThis.customElements?.define(this.customElementName, class extends HTMLElement {});
    }
    this.host = globalThis.document.createElement(this.customElementName);
    this.shadowRoot = this.host.attachShadow({ mode: "closed" });

    const hostStyles: Partial<CSSStyleDeclaration> = {
      all: "initial",
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483647",
      width: "320px",
      display: "block",
    };
    Object.assign(this.host.style, hostStyles);

    (globalThis.document.body ?? globalThis.document.documentElement).appendChild(this.host);
  }

  private renderReceipt() {
    if (!this.shadowRoot || !this.receipt) {
      return;
    }

    render(
      AutofillFillReceipt({
        theme: resolveTheme(this.receipt.theme),
        receipt: this.receipt,
        undone: this.undone,
        onUndo: () => this.handlers?.onUndo(),
        onRefill: () => this.handlers?.onRefill(),
      }),
      this.shadowRoot,
    );
    this.syncEmotionStylesIntoShadowDom();
  }

  /**
   * Emotion injects the component's rules into the page head, outside the closed shadow root.
   * Copy them in so the receipt keeps its layout even when the page's own styles conflict.
   */
  private syncEmotionStylesIntoShadowDom() {
    if (!this.shadowRoot) {
      return;
    }

    this.shadowRoot
      .querySelectorAll("style[data-autofill-fill-receipt-emotion]")
      .forEach((styleElement) => styleElement.remove());

    globalThis.document.head.querySelectorAll("style[data-emotion]").forEach((styleElement) => {
      const source = styleElement as HTMLStyleElement;
      const clone = source.cloneNode(true) as HTMLStyleElement;
      if (!clone.textContent) {
        clone.textContent = Array.from(source.sheet?.cssRules ?? [])
          .map((rule) => rule.cssText)
          .join("");
      }
      clone.setAttribute("data-autofill-fill-receipt-emotion", "true");
      this.shadowRoot!.append(clone);
    });
  }

  private scheduleDismiss() {
    this.clearDismissTimeout();
    this.dismissTimeout = globalThis.setTimeout(() => this.destroy(), RECEIPT_VISIBLE_MS);
  }

  private clearDismissTimeout() {
    if (this.dismissTimeout) {
      globalThis.clearTimeout(this.dismissTimeout);
      this.dismissTimeout = undefined;
    }
  }
}
