import { Jsonify } from "type-fest";

import { UserId } from "@localpass/common/types/guid";
import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { LOCAL_VAULT_DISK, StateProvider, UserKeyDefinition } from "@localpass/state";

/** One previous encrypted snapshot of an item, kept locally so it can be shown or restored. */
export interface CipherVersion {
  readonly revisionDate: string;
  readonly data: CipherData;
}

/**
 * Device-local version stack keyed by cipher id.
 *
 * Entries hold the encrypted `CipherData` that was current before a save, so the state contains
 * ciphertext only and never needs its own encryption key. The stack is intentionally not part of
 * the R2 snapshot: it is a local undo aid, while the portable `passwordHistory` stays on the item.
 */
export const CIPHER_VERSION_HISTORY = new UserKeyDefinition<Record<string, CipherVersion[]>>(
  LOCAL_VAULT_DISK,
  "cipherVersionHistory",
  {
    deserializer: (value) => {
      const stored =
        (value as unknown as Record<
          string,
          readonly { revisionDate: string; data: Jsonify<CipherData> }[]
        >) ?? {};
      const result: Record<string, CipherVersion[]> = {};
      for (const [id, versions] of Object.entries(stored)) {
        result[id] = versions.map((version) => ({
          revisionDate: version.revisionDate,
          data: CipherData.fromJSON(version.data),
        }));
      }
      return result;
    },
    clearOn: ["logout"],
  },
);

/**
 * Drops every stored revision for a user.
 *
 * Clearing the vault removes the items those revisions belong to. Per-item deletion already
 * drops that item's stack, but a stack can outlive its row (for example after a snapshot
 * restore), so clearing everything keeps no old password on disk once the warning said every
 * item is gone.
 */
export async function clearCipherVersionHistory(
  stateProvider: StateProvider,
  userId: UserId,
): Promise<void> {
  await stateProvider.getUser(userId, CIPHER_VERSION_HISTORY).update(() => ({}));
}
