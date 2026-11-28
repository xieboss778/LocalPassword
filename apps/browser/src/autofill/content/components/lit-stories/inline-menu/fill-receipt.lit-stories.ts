import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";

import { InlineMenuFillReceipt } from "../../../../types/inline-menu-fill-receipt";
import { AutofillFillReceipt, AutofillFillReceiptProps } from "../../fill-receipt/fill-receipt";
import { mockBrowserI18nGetMessage } from "../mock-data";

type ComponentAndControls = Omit<AutofillFillReceiptProps, "receipt" | "onUndo" | "onRefill"> & {
  kind: InlineMenuFillReceipt["kind"];
  last4?: string;
  title?: string;
};

const baseArgs: ComponentAndControls = {
  theme: ThemeTypes.Light,
  kind: "card",
  last4: "4242",
  undone: false,
};

export default {
  title: "Components/Inline Menu/Fill Receipt",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    kind: { control: "select", options: ["login", "card", "identity"] },
    last4: { control: "text" },
    title: { control: "text" },
    undone: { control: "boolean" },
    onUndo: { control: false },
    onRefill: { control: false },
  },
  args: baseArgs,
} as Meta<ComponentAndControls>;

const Template = (args: ComponentAndControls) => {
  const { kind, last4, title, ...props } = args;
  return html`<div style="padding: 24px;">
    ${AutofillFillReceipt({
      ...props,
      receipt: { kind, last4, title, theme: args.theme },
      onUndo: () => alert("Undo"),
      onRefill: () => alert("Refill"),
    })}
  </div>`;
};

export const Cards: StoryObj<ComponentAndControls> = {
  render: Template,
};

export const Identities: StoryObj<ComponentAndControls> = {
  args: { kind: "identity", last4: undefined },
  render: Template,
};

export const Logins: StoryObj<ComponentAndControls> = {
  args: { kind: "login", title: "GitHub", last4: undefined },
  render: Template,
};

export const Undone: StoryObj<ComponentAndControls> = {
  args: { undone: true },
  render: Template,
};

window.chrome = {
  ...window.chrome,
  i18n: {
    getMessage: mockBrowserI18nGetMessage,
  },
} as typeof chrome;
