import { UserId } from "../../types/guid";
import { LocalVaultWriter } from "../abstractions/local-vault-writer.abstraction";
import { FolderData } from "../models/data/folder.data";
import { Folder } from "../models/domain/folder";
import { CipherView } from "../models/view/cipher.view";

/**
 * The behaviour when no local vault is registered: every write falls through to the server path,
 * so the client keeps working exactly as upstream.
 */
export class NoopLocalVaultWriter implements LocalVaultWriter {
  isLocalAccount(userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  createCipher(cipherView: CipherView, userId: UserId): Promise<CipherView | null> {
    return Promise.resolve(null);
  }

  updateCipher(cipherView: CipherView, userId: UserId): Promise<CipherView | null> {
    return Promise.resolve(null);
  }

  softDeleteManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  restoreManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  moveManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  deleteCipher(id: string, userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  deleteManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  softDeleteCipher(id: string, userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  restoreCipher(id: string, userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }

  saveFolder(folder: Folder, userId: UserId): Promise<FolderData | null> {
    return Promise.resolve(null);
  }

  deleteFolder(ids: string[], userId: UserId): Promise<boolean> {
    return Promise.resolve(false);
  }
}
