import { CipherViewLike } from "@localpass/common/vault/utils/cipher-view-like-utils";
import { SafeInjectionToken } from "@localpass/ui-common";

/**
 * Runs the client's master-password re-prompt for a cipher, returning whether the caller may
 * proceed. Implementations return `true` for ciphers that are not re-prompt protected.
 *
 * Re-prompt lives in the Vault layer, which imports this library for its item forms — so it is
 * reached through a token rather than imported back, to keep the two packages from depending on
 * each other. Clients that render the item form must provide it; the form deliberately fails
 * closed rather than opening a protected item without verification.
 */
export interface ItemEntryPasswordReprompt {
  passwordRepromptCheck(cipher: CipherViewLike): Promise<boolean>;
}

export const ITEM_ENTRY_PASSWORD_REPROMPT = new SafeInjectionToken<ItemEntryPasswordReprompt>(
  "ITEM_ENTRY_PASSWORD_REPROMPT",
);
