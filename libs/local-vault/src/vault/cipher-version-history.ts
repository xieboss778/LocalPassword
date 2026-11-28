import { Jsonify } from "type-fest";

import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { LOCAL_VAULT_DISK, UserKeyDefinition } from "@localpass/state";

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
