import { LOCAL_VAULT_SYNC_DISK, UserKeyDefinition } from "@localpass/state";

import { VaultRecord } from "./snapshot-merge";

/** Which local collection a held conflict belongs to. */
export type VaultConflictKind = "cipher" | "folder";

/** What the user chose to do with one held conflict. */
export type VaultConflictChoice = "local" | "remote" | "both";

/**
 * A record that changed on both sides since the last successful sync.
 *
 * Both records are the encrypted payloads read from the local and remote snapshots; this state
 * only stores ciphertext and revision timestamps. Nothing here is decrypted until the resolve
 * screen builds a display copy.
 */
export interface PendingVaultConflict {
  readonly id: string;
  readonly kind: VaultConflictKind;
  readonly local: VaultRecord;
  readonly remote: VaultRecord;
  /**
   * Id for the extra record "keep both" writes. Generated once when the conflict is held, so a
   * retry after a failed upload updates that copy instead of creating duplicates. It must be a
   * UUID: cipher ids go through the SDK, which rejects non-UUID values.
   */
  readonly copyId: string;
}

export const VAULT_BACKUP_PENDING_CONFLICTS = new UserKeyDefinition<PendingVaultConflict[]>(
  LOCAL_VAULT_SYNC_DISK,
  "pendingConflicts",
  {
    deserializer: (value) => {
      const pending = (value as unknown as PendingVaultConflict[] | null) ?? [];
      // Conflicts held by an older build have no copyId; give them a valid one the next
      // keep-both can use instead of writing a cipher under an SDK-rejected id.
      return pending.map((conflict) =>
        conflict.copyId == null ? { ...conflict, copyId: crypto.randomUUID() } : conflict,
      );
    },
    clearOn: ["logout"],
  },
);
