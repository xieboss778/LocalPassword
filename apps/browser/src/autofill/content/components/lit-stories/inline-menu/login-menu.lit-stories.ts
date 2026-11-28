import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@localpass/common/platform/enums/theme-type.enum";

import { InlineMenuCollapsedChip } from "../../inline-menu/collapsed-chip";
import {
  InlineMenuLoginMenu,
  InlineMenuLoginMenuI18n,
  InlineMenuLoginMenuProps,
} from "../../inline-menu/login-menu";
import { InlineMenuPasskeyVerifying } from "../../inline-menu/passkey-verifying";
import { InlineMenuTotpFilledCard } from "../../inline-menu/totp-filled-card";
import {
  mockLoginCiphers,
  mockPasskeyCiphers,
  mockPasskeysAndPasswords,
  mockTotpCiphers,
} from "../mock-data";

type ComponentAndControls = InlineMenuLoginMenuProps & { width: number };

const i18n: InlineMenuLoginMenuI18n = {
  accountCount: "{count} accounts",
  sameDomainRecent: "Same site · most recent first",
  filterMatch: 'Matches "{query}" · {matched} / {total}',
  showAll: "Show all",
  passkeysGroup: "Passkeys",
  passwordsGroup: "Passwords",
  totpGroup: "Verification codes",
  keyboardHint: "↑↓ select · Enter fill · Esc close",
  totpKeyboardHint: "↑↓ select · Enter fill · Esc close",
  newLogin: "New login",
  newLoginAria: "Add new vault login item",
  totpContext: "Current account {username} first · Fills and copies on selection",
  totpRefreshNote: "Codes update every 30 seconds",
  totpFill: "Fill",
  emptyTitle: "No matching accounts",
  emptyDescription: 'No account matches "{query}".',
  emptyDescriptionNoQuery: "No login items saved for this site yet.",
  showAllAccounts: "Show all {count} accounts",
  generatePassword: "Generate password",
  searchAll: "Search all items",
  readOnlyDomain: "Read-only domain",
  closeAria: "Close LocalPass menu",
  menuAriaLabel: "LocalPass login suggestions",
  totpMenuAriaLabel: "LocalPass verification codes",
  passkey: "passkey",
  password: "password",
  verificationCode: "verification code",
  lastUsed: "Last used",
  currentAccount: "Current account",
  fill: "Fill",
  verify: "Verify",
  fillPasswordAria: "Fill password for {username}",
  usePasskeyAria: "Use passkey for {username}",
  fillAria: "Fill and copy the verification code for {username}",
  codeAria: "Time-based One-Time Password Verification Code",
};

const baseArgs: ComponentAndControls = {
  theme: ThemeTypes.Dark,
  domain: "localhost:4180",
  ciphers: mockLoginCiphers,
  visibleCiphers: mockLoginCiphers,
  query: "",
  i18n,
  onFill: (cipher) => alert(`Fill ${cipher.name}`),
  onFillTotp: (cipher) => alert(`Fill code for ${cipher.name}`),
  onNewItem: () => alert("New login"),
  onGeneratePassword: () => alert("Generate password"),
  onSearchAll: () => alert("Search all items"),
  onClearFilter: () => alert("Clear filter"),
  onClose: () => alert("Close"),
  width: 312,
};

export default {
  title: "Components/Inline Menu/Login Menu",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    onFill: { control: false },
    onFillTotp: { control: false },
    onNewItem: { control: false },
    onGeneratePassword: { control: false },
    onSearchAll: { control: false },
    onClearFilter: { control: false },
    onClose: { control: false },
    width: { control: "number", min: 320, max: 520, step: 10 },
  },
  args: baseArgs,
} as Meta<ComponentAndControls>;

const Template = (args: ComponentAndControls) => {
  const { width, ...componentProps } = args;
  return html`<div style="width: ${width}px;">${InlineMenuLoginMenu(componentProps)}</div>`;
};

export const Default: StoryObj<ComponentAndControls> = {
  render: Template,
};

export const Filtered: StoryObj<ComponentAndControls> = {
  args: {
    query: "test",
  },
  render: Template,
};

export const Empty: StoryObj<ComponentAndControls> = {
  args: {
    query: "zzz",
  },
  render: Template,
};

export const PasskeysAndPasswords: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: mockPasskeysAndPasswords,
    visibleCiphers: mockPasskeysAndPasswords,
  },
  render: Template,
};

export const VerificationCodes: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: mockTotpCiphers,
    visibleCiphers: mockTotpCiphers,
    isTotp: true,
  },
  render: Template,
};

export const PasskeyVerifying: StoryObj<ComponentAndControls> = {
  render: () =>
    html`<div style="width: 420px;">
      ${InlineMenuPasskeyVerifying({
        theme: ThemeTypes.Dark,
        domain: "localhost:4180",
        username: "test@local.invalid",
        i18n: {
          headerCount: "Verifying",
          title: "Verifying passkey for {username}",
          body: "The site only receives one signature; your private key never leaves this device.",
          timeout: "30s timeout",
          cancel: "Cancel",
          ariaLabel: "Passkey verification in progress",
          closeAria: "Close LocalPass menu",
          showAll: "Show all",
        },
        onCancel: () => alert("Cancel verification"),
      })}
    </div>`,
};

export const TotpFilled: StoryObj<ComponentAndControls> = {
  render: () =>
    html`<div style="width: 420px;">
      ${InlineMenuTotpFilledCard({
        theme: ThemeTypes.Dark,
        username: "test@local.invalid",
        code: mockPasskeyCiphers[0].login?.totp ?? "123456",
        period: 30,
        canAutoCopy: true,
        copied: false,
        i18n: {
          ariaLabel: "Verification code filled",
          title: "Code filled for {username}",
          body: "Code filled and copied to the clipboard.",
          copiedBody: "Code copied to the clipboard again.",
          copied: "Copied",
          copyAria: "Copy verification code",
          remaining: "Expires in {seconds} s",
          switchAccount: "Switch account",
        },
        onCopy: () => alert("Copy code"),
        onSwitchAccount: () => alert("Switch account"),
      })}
    </div>`,
};

export const CollapsedPasswordChip: StoryObj<ComponentAndControls> = {
  render: () =>
    html`<div style="width: 420px;">
      ${InlineMenuCollapsedChip({
        theme: ThemeTypes.Dark,
        title: "Filled test@local.invalid",
        detail: "Click to switch accounts or view other suggestions",
        expandText: "Expand",
        ariaLabel: "Expand LocalPass suggestions",
        onOpen: () => alert("Expand"),
      })}
    </div>`,
};
