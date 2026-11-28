import { firstValueFrom } from "rxjs";

import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId, CipherId } from "@localpass/common/types/guid";
import { CipherEncryptionService } from "@localpass/common/vault/abstractions/cipher-encryption.service";
import { LocalVaultWriter } from "@localpass/common/vault/abstractions/local-vault-writer.abstraction";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { FolderData } from "@localpass/common/vault/models/data/folder.data";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { Folder } from "@localpass/common/vault/models/domain/folder";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { PasswordHistoryView } from "@localpass/common/vault/models/view/password-history.view";
import { ENCRYPTED_CIPHERS } from "@localpass/common/vault/services/key-state/ciphers.state";
import { FOLDER_ENCRYPTED_FOLDERS } from "@localpass/common/vault/services/key-state/folder.state";
import { newGuid } from "@localpass/guid";
import { StateProvider } from "@localpass/state";

import { LocalAccountService } from "../account/local-account.service";
import { diffFieldLabelKeys } from "../items/item-diff";
import { isSecretCarrier, kindOf } from "../items/item-kind";

import { CipherVersion, CIPHER_VERSION_HISTORY } from "./cipher-version-history";

/**
 * Thrown when a local vault is asked to do something that only a server can do, such as moving an
 * item into an organization.
 */
export class LocalVaultUnsupportedError extends Error {
  constructor(operation: string) {
    super(`${operation} is not available for a local vault.`);
    this.name = "LocalVaultUnsupportedError";
  }
}

/** 版本历史抽屉展示的旧密码上限（AGY 原型保留最近 10 版）。 */
const PASSWORD_HISTORY_LIMIT = 10;

/** 本机加密版本栈保留的旧版本数，与原型一致。 */
const VERSION_HISTORY_LIMIT = 10;

/**
 * Persists vault writes for accounts that have no server.
 *
 * Ciphers live in the same client-managed state the SDK reads through its repository, so a write
 * made here is immediately visible to every reader — the SDK included — with no sync involved.
 * Encryption goes through `CipherEncryptionService`, which is the SDK's local encryption path and
 * never touches the network.
 */
export class DefaultLocalVaultWriter implements LocalVaultWriter {
  /** Called after every local write so the sync scheduler can debounce an upload. */
  private changeListener: ((userId: UserId) => void) | null = null;

  /** Registers the callback that hears about local writes. */
  setChangeListener(listener: (userId: UserId) => void): void {
    this.changeListener = listener;
  }

  constructor(
    private readonly localAccountService: LocalAccountService,
    private readonly cipherEncryptionService: CipherEncryptionService,
    private readonly stateProvider: StateProvider,
    private readonly logService: LogService,
  ) {}

  async isLocalAccount(userId: UserId): Promise<boolean> {
    return await this.localAccountService.isLocalAccount(userId);
  }

  async createCipher(cipherView: CipherView, userId: UserId): Promise<CipherView | null> {
    if (!(await this.isLocalAccount(userId))) {
      return null;
    }

    const cipher = await this.encrypt(cipherView, userId);
    const now = new Date();
    // `CipherView.id` starts as an empty string, not null; `??` would keep it and store the
    // cipher under "". The SDK then reads it back without an id, so the UI cannot select it.
    cipher.id = (cipherView.id || newGuid()) as CipherId;
    cipher.creationDate = now;
    cipher.revisionDate = now;
    cipher.deletedDate = undefined;
    cipher.edit = true;
    cipher.viewPassword = true;

    await this.write(cipher, userId);
    this.logService.info("Saved cipher to local vault", { cipherId: cipher.id });
    return await this.decrypt(cipher, userId);
  }

  async updateCipher(cipherView: CipherView, userId: UserId): Promise<CipherView | null> {
    if (!(await this.isLocalAccount(userId))) {
      return null;
    }

    const existing = await this.read(cipherView.id, userId);
    if (existing != null) {
      const previous = await this.decryptQuietly(existing, userId);
      if (previous != null) {
        if (this.hasContentChanges(previous, cipherView)) {
          await this.recordVersion(existing, userId);
        }
        this.recordPasswordChange(cipherView, previous);
      }
    }
    const cipher = await this.encrypt(cipherView, userId);
    cipher.id = cipherView.id;
    cipher.creationDate = existing?.creationDate ?? new Date();
    cipher.revisionDate = new Date();
    cipher.deletedDate = existing?.deletedDate;
    cipher.edit = true;
    cipher.viewPassword = true;

    await this.write(cipher, userId);
    return await this.decrypt(cipher, userId);
  }

  async deleteCipher(id: string, userId: UserId): Promise<boolean> {
    return await this.deleteManyCiphers([id], userId);
  }

  async deleteManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    if (!(await this.isLocalAccount(userId))) {
      return false;
    }

    await this.ciphersState(userId).update((state) => {
      const next = { ...(state ?? {}) };
      for (const id of ids) {
        delete next[id];
      }
      return next;
    });
    // A permanently removed item has no detail screen left to show its versions in.
    await this.versionsState(userId).update((state) => {
      const next = { ...(state ?? {}) };
      for (const id of ids) {
        delete next[id];
      }
      return next;
    });
    this.changeListener?.(userId);
    return true;
  }

  async softDeleteCipher(id: string, userId: UserId): Promise<boolean> {
    return await this.stamp(id, userId, new Date());
  }

  async softDeleteManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    const deletedAt = new Date();
    return await this.stampMany(ids, userId, deletedAt);
  }

  async restoreCipher(id: string, userId: UserId): Promise<boolean> {
    return await this.stamp(id, userId, undefined);
  }

  async restoreManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    return await this.stampMany(ids, userId, undefined);
  }

  async saveFolder(folder: Folder, userId: UserId): Promise<FolderData | null> {
    if (!(await this.isLocalAccount(userId))) {
      return null;
    }

    const data = new FolderData({
      id: folder.id || newGuid(),
      name: folder.name?.encryptedString ?? "",
      revisionDate: new Date().toISOString(),
    });
    // Folders live in the same client-managed state the SDK repository reads.
    await this.foldersState(userId).update((state) => ({ ...(state ?? {}), [data.id]: data }));
    this.changeListener?.(userId);
    return data;
  }

  async deleteFolder(ids: string[], userId: UserId): Promise<boolean> {
    if (!(await this.isLocalAccount(userId))) {
      return false;
    }

    await this.foldersState(userId).update((state) => {
      const next = { ...(state ?? {}) };
      for (const id of ids) {
        delete next[id];
      }
      return next;
    });

    // Items in a deleted folder are re-assigned to "No Folder", matching FolderService.delete.
    // Without this the stored items would keep pointing at a folder that no longer exists.
    // Copy the row instead of re-encrypting it: imported rows may carry dates `Cipher` rejects.
    await this.ciphersState(userId).update((state) => {
      const next = { ...(state ?? {}) };
      for (const [cipherId, data] of Object.entries(next)) {
        if (data.folderId != null && ids.includes(data.folderId)) {
          next[cipherId as CipherId] = {
            ...data,
            folderId: undefined,
            revisionDate: new Date().toISOString(),
          };
        }
      }
      return next;
    });
    this.changeListener?.(userId);
    return true;
  }

  /** Moves a cipher into an organization; a local vault has none, so this refuses loudly. */
  async moveManyCiphers(ids: string[], userId: UserId): Promise<boolean> {
    if (!(await this.isLocalAccount(userId))) {
      return false;
    }
    throw new LocalVaultUnsupportedError("Moving items to an organization");
  }

  private async stampMany(
    ids: string[],
    userId: UserId,
    deletedDate: Date | undefined,
  ): Promise<boolean> {
    if (!(await this.isLocalAccount(userId))) {
      return false;
    }
    for (const id of ids) {
      await this.stamp(id, userId, deletedDate);
    }
    return true;
  }

  private async stamp(id: string, userId: UserId, deletedDate: Date | undefined): Promise<boolean> {
    if (!(await this.isLocalAccount(userId))) {
      return false;
    }

    const cipher = await this.read(id, userId);
    if (cipher == null) {
      return true;
    }

    cipher.deletedDate = deletedDate;
    cipher.revisionDate = new Date();
    await this.write(cipher, userId);
    return true;
  }

  private async encrypt(cipherView: CipherView, userId: UserId): Promise<Cipher> {
    const context = await this.cipherEncryptionService.encrypt(cipherView, userId);
    if (context == null) {
      throw new Error("Failed to encrypt a cipher for the local vault.");
    }
    return context.cipher;
  }

  /**
   * 本地保险库没有服务端路径里的 `CipherService.adjustCipherHistory`，密码历史只能在这里补。
   *
   * 只有登录密码确实变了才把旧值插入历史；历史随条目一起加密，不写日志、不额外落盘。
   */
  private recordPasswordChange(next: CipherView, previous: CipherView): void {
    if (
      next.type !== CipherType.Login ||
      previous.type !== CipherType.Login ||
      isSecretCarrier(kindOf(next)) ||
      isSecretCarrier(kindOf(previous))
    ) {
      return;
    }

    const oldPassword = previous.login?.password;
    const newPassword = next.login?.password;
    if (!oldPassword || !newPassword || oldPassword === newPassword) {
      return;
    }

    const entry = new PasswordHistoryView();
    entry.password = oldPassword;
    entry.lastUsedDate = new Date();
    next.passwordHistory = [entry, ...(next.passwordHistory ?? [])].slice(
      0,
      PASSWORD_HISTORY_LIMIT,
    );
    next.login.passwordRevisionDate = new Date();
  }

  /** Decrypts the previous revision for history; a record this key cannot open skips history. */
  private async decryptQuietly(cipher: Cipher, userId: UserId): Promise<CipherView | null> {
    try {
      return await this.decrypt(cipher, userId);
    } catch {
      return null;
    }
  }

  /**
   * Stores the encrypted revision that is about to be replaced. Only content changes create a
   * version; saving the form without touching a field does not grow the stack.
   */
  private async recordVersion(existing: Cipher, userId: UserId): Promise<void> {
    // Old imported rows can carry missing dates; `toCipherData` would throw on them.
    const now = new Date();
    if (Number.isNaN(existing.revisionDate?.getTime())) {
      existing.revisionDate = now;
    }
    if (Number.isNaN(existing.creationDate?.getTime())) {
      existing.creationDate = now;
    }
    const version: CipherVersion = {
      revisionDate: existing.revisionDate.toISOString(),
      data: existing.toCipherData(),
    };
    await this.versionsState(userId).update((state) => {
      const current = state?.[existing.id] ?? [];
      const versions = current.filter((item) => item.revisionDate !== version.revisionDate);
      return {
        ...(state ?? {}),
        [existing.id]: [version, ...versions].slice(0, VERSION_HISTORY_LIMIT),
      };
    });
  }

  /**
   * Decides whether a save created a revision worth keeping in the version stack.
   *
   * Flag toggles (favorite, reprompt) are deliberately excluded: they change how the item behaves
   * in the UI, not its content, so starring an item must not push a duplicate into its history.
   */
  private hasContentChanges(previous: CipherView, next: CipherView): boolean {
    if (diffFieldLabelKeys(previous, next).length > 0) {
      return true;
    }
    if ((previous.folderId ?? "") !== (next.folderId ?? "")) {
      return true;
    }
    return this.passkeyFingerprint(previous) !== this.passkeyFingerprint(next);
  }

  private passkeyFingerprint(view: CipherView): string {
    return JSON.stringify(
      view.login?.fido2Credentials?.map((credential) => [
        credential.credentialId,
        credential.userName,
      ]) ?? [],
    );
  }

  private async decrypt(cipher: Cipher, userId: UserId): Promise<CipherView> {
    return await this.cipherEncryptionService.decrypt(cipher, userId);
  }

  private async read(id: string, userId: UserId): Promise<Cipher | null> {
    const state = await firstValueFrom(this.ciphersState(userId).state$);
    const data = state?.[id as CipherId];
    return data == null ? null : new Cipher(data);
  }

  private async write(cipher: Cipher, userId: UserId): Promise<void> {
    const data = cipher.toCipherData();
    await this.ciphersState(userId).update((state) => ({ ...(state ?? {}), [cipher.id]: data }));
    this.changeListener?.(userId);
  }

  private ciphersState(userId: UserId) {
    return this.stateProvider.getUser(userId, ENCRYPTED_CIPHERS);
  }

  private foldersState(userId: UserId) {
    return this.stateProvider.getUser(userId, FOLDER_ENCRYPTED_FOLDERS);
  }

  private versionsState(userId: UserId) {
    return this.stateProvider.getUser(userId, CIPHER_VERSION_HISTORY);
  }
}
