import { CipherViewLike } from "@localpass/common/vault/utils/cipher-view-like-utils";
import { VaultItemEvent as BaseVaultItemEvent } from "@localpass/vault";

// Extend base events with desktop-specific events
export type VaultItemEvent<C extends CipherViewLike> =
  BaseVaultItemEvent<C> | { type: "viewCipher"; item: C };
