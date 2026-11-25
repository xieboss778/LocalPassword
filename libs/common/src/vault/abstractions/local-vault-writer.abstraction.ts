import { UserId } from "../../types/guid";
import { FolderData } from "../models/data/folder.data";
import { Folder } from "../models/domain/folder";
import { CipherView } from "../models/view/cipher.view";

/**
 * Local write path for a vault that has no server behind it.
 *
 * Every method returns `null`/`false` when the user's vault is not local, which makes the caller
 * fall through to the ordinary server path untouched. Implementations live in
 * `@bitwarden/local-vault`; `NoopLocalVaultWriter` is the default so that a client which never
 * registers one behaves exactly as upstream.
 */
export abstract class LocalVaultWriter {
  /** True when the account was created on this device and has no server. */
  abstract isLocalAccount(userId: UserId): Promise<boolean>;

  /** Persists a new cipher locally and returns its decrypted view, or null when not local. */
  abstract createCipher(cipherView: CipherView, userId: UserId): Promise<CipherView | null>;

  /** Persists a changed cipher locally and returns its decrypted view, or null when not local. */
  abstract updateCipher(cipherView: CipherView, userId: UserId): Promise<CipherView | null>;

  /** Permanently removes a cipher. Returns false when the vault is not local. */
  abstract deleteCipher(id: string, userId: UserId): Promise<boolean>;

  /** Removes several ciphers at once. Returns false when the vault is not local. */
  abstract deleteManyCiphers(ids: string[], userId: UserId): Promise<boolean>;

  /** Moves a cipher to the trash. Returns false when the vault is not local. */
  abstract softDeleteCipher(id: string, userId: UserId): Promise<boolean>;

  /** Moves several ciphers to the trash. Returns false when the vault is not local. */
  abstract softDeleteManyCiphers(ids: string[], userId: UserId): Promise<boolean>;

  /** Restores several ciphers from the trash. Returns false when the vault is not local. */
  abstract restoreManyCiphers(ids: string[], userId: UserId): Promise<boolean>;

  /** Moves ciphers into an organization. A local vault has none and must refuse. */
  abstract moveManyCiphers(ids: string[], userId: UserId): Promise<boolean>;

  /** Restores a cipher from the trash. Returns false when the vault is not local. */
  abstract restoreCipher(id: string, userId: UserId): Promise<boolean>;

  /** Saves a folder locally and returns its stored data, or null when not local. */
  abstract saveFolder(folder: Folder, userId: UserId): Promise<FolderData | null>;

  /** Deletes folders locally. Returns false when the vault is not local. */
  abstract deleteFolder(ids: string[], userId: UserId): Promise<boolean>;
}
