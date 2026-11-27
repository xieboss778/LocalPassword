import { AuthenticationStatus } from "@localpass/common/auth/enums/authentication-status";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { InlineMenuFillType } from "../../../enums/autofill-overlay.enum";

type AutofillInlineMenuListMessage = { command: string };

export type UpdateAutofillInlineMenuListCiphersParams = {
  ciphers: InlineMenuCipherData[];
  showInlineMenuAccountCreation?: boolean;
  showPasskeysLabels?: boolean;
  focusedFieldValue?: string;
  isTotpField?: boolean;
  focusedFieldHasValue?: boolean;
};

export type UpdateAutofillInlineMenuListCiphersMessage = AutofillInlineMenuListMessage &
  UpdateAutofillInlineMenuListCiphersParams;

export type UpdateAutofillInlineMenuGeneratedPasswordMessage = AutofillInlineMenuListMessage & {
  generatedPassword: string;
};

export type InitAutofillInlineMenuListMessage = AutofillInlineMenuListMessage & {
  authStatus: AuthenticationStatus;
  styleSheetUrl: string;
  theme: string;
  translations: Record<string, string>;
  ciphers?: InlineMenuCipherData[];
  inlineMenuFillType?: InlineMenuFillType;
  showInlineMenuAccountCreation?: boolean;
  showPasskeysLabels?: boolean;
  portKey: string;
  token: string;
  generatedPassword?: string;
  showSaveLoginMenu?: boolean;
  showAnimations?: boolean;
  useLitComponents?: boolean;
  domain?: string;
  focusedFieldValue?: string;
  isTotpField?: boolean;
};

export type AutofillInlineMenuListWindowMessageHandlers = {
  [key: string]: CallableFunction;
  initAutofillInlineMenuList: ({ message }: { message: InitAutofillInlineMenuListMessage }) => void;
  checkAutofillInlineMenuListFocused: () => void;
  updateAutofillInlineMenuListCiphers: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuListCiphersMessage;
  }) => void;
  updateAutofillInlineMenuGeneratedPassword: ({
    message,
  }: {
    message: UpdateAutofillInlineMenuGeneratedPasswordMessage;
  }) => void;
  focusAutofillInlineMenuList: () => void;
};
