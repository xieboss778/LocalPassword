import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";

import {
  InlineMenuCardIdentityMenu,
  InlineMenuCardIdentityMenuI18n,
  InlineMenuCardIdentityMenuProps,
} from "../../inline-menu/card-identity-menu";
import { mockCardCiphers, mockIdentityCiphers } from "../mock-data";

type ComponentAndControls = InlineMenuCardIdentityMenuProps & { width: number };

const i18n: InlineMenuCardIdentityMenuI18n = {
  cardsTitle: "Cards",
  identityTitle: "Identity & address",
  favorite: "Favorite",
  fill: "Fill",
  fillCardAria: "Fill card {name}",
  fillIdentityAria: "Fill identity {name}",
  cardMaskedNote: "Full card number stays hidden",
  identityFillNote: "Fills name and address",
  keysHint: "↑↓ ↵ esc",
  closeAria: "Close LocalPass menu",
  showAll: "Show all",
  cardMenuAriaLabel: "LocalPass card suggestions",
  identityMenuAriaLabel: "LocalPass identity suggestions",
};

const baseArgs: ComponentAndControls = {
  theme: ThemeTypes.Dark,
  kind: "card",
  ciphers: mockCardCiphers,
  i18n,
  onFill: (cipher) => alert(`Fill ${cipher.name}`),
  onClose: () => alert("Close"),
  width: 312,
};

export default {
  title: "Components/Inline Menu/Card & Identity Menu",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    kind: { control: "select", options: ["card", "identity"] },
    onFill: { control: false },
    onClose: { control: false },
    width: { control: "number", min: 280, max: 480, step: 8 },
  },
  args: baseArgs,
} as Meta<ComponentAndControls>;

const Template = (args: ComponentAndControls) => {
  const { width, ...componentProps } = args;
  return html`<div style="width: ${width}px;">${InlineMenuCardIdentityMenu(componentProps)}</div>`;
};

export const Cards: StoryObj<ComponentAndControls> = {
  render: Template,
};

export const Identities: StoryObj<ComponentAndControls> = {
  args: {
    kind: "identity",
    ciphers: mockIdentityCiphers,
  },
  render: Template,
};
