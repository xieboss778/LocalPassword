import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

/**
 * Deep-copies a decrypted cipher so edits can be applied before a write without touching the
 * instance the vault's caches still hold.
 *
 * A failed write must leave the cached item exactly as it was, otherwise the next read or save
 * could persist fields the user never successfully saved. The clone uses the serialization path
 * the cipher views already implement, which rebuilds typed nested views (login, card, fields,
 * password history) instead of sharing references.
 */
export function cloneCipherView(view: CipherView): CipherView {
  const clone = CipherView.fromJSON(JSON.parse(JSON.stringify(view)));
  if (clone == null) {
    throw new Error("Failed to clone cipher view.");
  }
  return clone;
}
