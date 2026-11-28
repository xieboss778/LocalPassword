import { Observable } from "rxjs";

import { UriMatchStrategySetting } from "@localpass/common/models/domain/domain-service";
import { CommandDefinition } from "@localpass/common/platform/messaging";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { AutofillMessageCommand } from "../../enums/autofill-message.enums";
import { InlineMenuFillType } from "../../enums/autofill-overlay.enum";
import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { FillResult } from "../../orchestration";
import { InlineMenuFillReceipt } from "../../types/inline-menu-fill-receipt";

export interface PageDetail {
  frameId: number;
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
}

export interface AutoFillOptions {
  cipher: CipherView;
  pageDetails: PageDetail[];
  doc?: typeof self.document;
  tab: chrome.tabs.Tab;
  skipUsernameOnlyFill?: boolean;
  onlyEmptyFields?: boolean;
  fillNewPassword?: boolean;
  skipLastUsed?: boolean;
  allowUntrustedIframe?: boolean;
  allowTotpAutofill?: boolean;
  autoSubmitLogin?: boolean;
  focusedFieldForm?: string;
  focusedFieldOpid?: string;
  inlineMenuFillType?: InlineMenuFillType;
  /**
   * Keep the inline menu list open after a fill that started from the list itself. The list
   * renders its own post-fill confirmation (a TOTP card or a collapsed password chip) instead of
   * being torn down with the field blur that a normal fill performs.
   */
  retainInlineMenu?: boolean;
  /**
   * Display-safe receipt for a card or identity fill that started from the inline menu. The
   * content script shows a bottom-right undo card once the fill lands.
   */
  inlineMenuFillReceipt?: InlineMenuFillReceipt;
  /**
   * Opaque, per-fill token shared with every frame the fill is written to. Each frame keeps the
   * pre-fill values of the fields it wrote under this token, so the receipt in the top document
   * can undo the fill across every frame it touched. Never derived from vault data.
   */
  inlineMenuFillToken?: string;
}

interface FormDataBase {
  form: AutofillForm;
  password: AutofillField;
  passwords: AutofillField[];
}

export interface FormDataWithUsername extends FormDataBase {
  username: AutofillField;
}

export interface FormDataPasswordOnly extends FormDataBase {
  username: null;
}

export type FormData = FormDataWithUsername | FormDataPasswordOnly;

export interface GenerateFillScriptOptions {
  skipUsernameOnlyFill: boolean;
  onlyEmptyFields: boolean;
  fillNewPassword: boolean;
  allowTotpAutofill: boolean;
  autoSubmitLogin: boolean;
  cipher: CipherView;
  /**
   * Whether the account is entitled to TOTP for this cipher. Gates filling the value only,
   * `allowTotpAutofill` gates whether TOTP fields are identified.
   */
  canAccessTotp: boolean;
  tabUrl: string;
  defaultUriMatch: UriMatchStrategySetting;
  focusedFieldOpid?: string;
  inlineMenuFillType?: InlineMenuFillType;
}

export type CollectPageDetailsResponseMessage = {
  tab: chrome.tabs.Tab;
  details: AutofillPageDetails;
  sender?: string;
};

export const COLLECT_PAGE_DETAILS_RESPONSE_COMMAND =
  new CommandDefinition<CollectPageDetailsResponseMessage>(
    AutofillMessageCommand.collectPageDetailsResponse,
  );

export abstract class AutofillService {
  enableInlineMenuAnimation$!: Observable<boolean>;
  enableNotificationAnimation$!: Observable<boolean>;
  /** Non-null asserted. */
  collectPageDetailsFromTab$!: (tab: chrome.tabs.Tab, frameId?: number) => Observable<PageDetail[]>;
  /** Non-null asserted. */
  loadAutofillScriptsOnInstall!: () => Promise<void>;
  /** Non-null asserted. */
  reloadAutofillScripts!: () => Promise<void>;
  /** Non-null asserted. */
  injectAutofillScripts!: (
    tab: chrome.tabs.Tab,
    frameId?: number,
    triggeringOnPageLoad?: boolean,
  ) => Promise<void>;
  /** Non-null asserted. */
  getFormsWithPasswordFields!: (pageDetails: AutofillPageDetails) => FormData[];
  /**
   * Fills a concrete cipher into the instructed tab/frame(s) and reports the
   * outcome. Cipher selection and active-tab verification are the caller's concern.
   *
   * If you're calling this method, you're probably doing it wrong. Use the
   * {@link AutofillOrchestrator} to request an autofill!
   */
  doAutoFill!: (options: AutoFillOptions) => Promise<FillResult>;
  /** Non-null asserted. */
  setAutoFillOnPageLoadOrgPolicy!: () => Promise<void>;
  /** Non-null asserted. */
  isPasswordRepromptRequired!: (
    cipher: CipherView,
    tab: chrome.tabs.Tab,
    action?: string,
  ) => Promise<boolean>;
}
