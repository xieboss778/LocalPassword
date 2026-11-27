import { firstValueFrom } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { KeyService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncString, EncryptService } from "@localpass/legacy-crypto";
import { LogService } from "@localpass/logging";
import { StateProvider } from "@localpass/state";

import { exportKey } from "./backup-layout";
import {
  DEFAULT_BACKUP_SETTINGS,
  VAULT_BACKUP_SETTINGS,
  VaultBackupSettings,
} from "./vault-backup-config";
import { VaultBackupSyncService } from "./vault-backup-sync.service";

export interface BackupResult {
  readonly uploaded: boolean;
  readonly key: string | null;
}

const BACKUP_PASSWORD_BYTES = 24;

/**
 * Writes a standard, password-protected LocalPass export into storage on demand.
 *
 * The export is the same JSON every LocalPass client can import, which is what makes it a usable
 * disaster recovery path even if this project disappears.
 */
export class VaultBackupService {
  constructor(
    private readonly syncService: VaultBackupSyncService,
    /** Produces the password-protected export for a user; supplied by the client that owns it. */
    private readonly exportVault: (userId: UserId, password: string) => Promise<string>,
    private readonly stateProvider: StateProvider,
    private readonly keyService: KeyService,
    private readonly encryptService: EncryptService,
    private readonly logService: LogService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async getSettings(userId: UserId): Promise<VaultBackupSettings> {
    const settings = await firstValueFrom(this.settingsState(userId).state$);
    return { ...DEFAULT_BACKUP_SETTINGS, ...(settings ?? {}) };
  }

  async setSettings(userId: UserId, patch: Partial<VaultBackupSettings>): Promise<void> {
    const current = await this.getSettings(userId);
    await this.settingsState(userId).update(() => ({ ...current, ...patch }));
  }

  /** The export password, generated on first use and wrapped with the user key. */
  async getPassword(userId: UserId): Promise<string | null> {
    const settings = await this.getSettings(userId);
    if (settings.wrappedBackupPassword == null) {
      return null;
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      return null;
    }

    return await this.encryptService.decryptString(
      new EncString(settings.wrappedBackupPassword),
      userKey,
    );
  }

  /** Returns the export password, generating and storing one when there is none yet. */
  async ensurePassword(userId: UserId): Promise<string> {
    const existing = await this.getPassword(userId);
    if (existing != null) {
      return existing;
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("Unlock the vault before creating a backup password.");
    }

    const password = generatePassword(BACKUP_PASSWORD_BYTES);
    const wrapped = await this.encryptService.encryptString(password, userKey);
    await this.setSettings(userId, { wrappedBackupPassword: wrapped.encryptedString });
    return password;
  }

  /** Exports the vault and uploads it under `exports/<year-month-day>/<timestamp>.json`. */
  async backupNow(userId: UserId): Promise<BackupResult> {
    const client = await this.syncService.clientFor(userId);
    if (client == null) {
      return { uploaded: false, key: null };
    }

    // The account object is what a new device restores from, so it must exist before the
    // export does — otherwise the bucket is unreachable even though the upload "succeeded".
    await this.syncService.ensureAccountObject(userId, client);

    const password = await this.ensurePassword(userId);
    const exported = await this.exportVault(userId, password);
    const key = exportKey(this.clock());

    await client.putObject(key, exported, { contentType: "application/json" });
    await this.syncService.prune(userId, client);
    await this.setSettings(userId, { lastBackupAt: this.clock().toISOString() });
    this.logService.info("Uploaded vault backup", { key });

    return { uploaded: true, key };
  }

  private settingsState(userId: UserId) {
    return this.stateProvider.getUser(userId, VAULT_BACKUP_SETTINGS);
  }
}

/** A URL-safe random password a user can retype on another device. */
function generatePassword(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
}
