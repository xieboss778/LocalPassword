import {
  LOCAL_VAULT_BACKUP_DISK,
  LOCAL_VAULT_SYNC_DISK,
  UserKeyDefinition,
} from "@localpass/state";

import { Snapshot } from "./snapshot-merge";

/**
 * Where the vault backups are stored. The bucket is the whole vault boundary: one bucket holds
 * exactly one vault, and every object sits at its root.
 */
export interface VaultBackupConfig {
  /** `https://<account>.r2.cloudflarestorage.com` for R2, the service URL otherwise. */
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  /** Only ever held in memory, decrypted; on disk it is wrapped with the user key. */
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
}

/** What actually goes to disk: the secret is replaced by its wrapped form. */
export type StoredVaultBackupConfig = Omit<VaultBackupConfig, "secretAccessKey"> & {
  readonly wrappedSecretAccessKey: string;
};

export interface VaultBackupSyncState {
  /** ETag of the manifest this device last wrote or read. */
  readonly manifestEtag: string | null;
  readonly lastSyncedAt: string | null;
  /** True when local changes have not reached storage yet. */
  readonly pending: boolean;
}

export interface VaultBackupSettings {
  /** Backup cadence: off, daily or weekly. */
  readonly backupFrequency: "off" | "daily" | "weekly";
  /** How many timestamped backups to keep. */
  readonly backupRetention: number;
  /** Wrapped export password; a backup cannot be restored without it. */
  readonly wrappedBackupPassword: string | null;
  /** ISO timestamp of the newest backup this device uploaded. */
  readonly lastBackupAt: string | null;
}

export const VAULT_BACKUP_CONFIG = new UserKeyDefinition<StoredVaultBackupConfig | null>(
  LOCAL_VAULT_SYNC_DISK,
  "backupConfig",
  {
    deserializer: (value) => value as unknown as StoredVaultBackupConfig | null,
    clearOn: ["logout"],
  },
);

export const VAULT_BACKUP_SYNC_STATE = new UserKeyDefinition<VaultBackupSyncState>(
  LOCAL_VAULT_SYNC_DISK,
  "backupSyncState",
  {
    deserializer: (value) =>
      (value as unknown as VaultBackupSyncState) ?? {
        manifestEtag: null,
        lastSyncedAt: null,
        pending: false,
      },
    clearOn: ["logout"],
  },
);

/** The last snapshot this device synced, used only to tell "changed here" from "changed there". */
export const VAULT_BACKUP_BASE_SNAPSHOT = new UserKeyDefinition<Snapshot | null>(
  LOCAL_VAULT_SYNC_DISK,
  "baseSnapshot",
  { deserializer: (value) => value as unknown as Snapshot | null, clearOn: ["logout"] },
);

export const VAULT_BACKUP_SETTINGS = new UserKeyDefinition<VaultBackupSettings>(
  LOCAL_VAULT_BACKUP_DISK,
  "settings",
  {
    deserializer: (value) =>
      (value as unknown as VaultBackupSettings) ?? {
        backupFrequency: "daily",
        backupRetention: 10,
        wrappedBackupPassword: null,
        lastBackupAt: null,
      },
    clearOn: ["logout"],
  },
);

export const DEFAULT_BACKUP_SETTINGS: VaultBackupSettings = {
  backupFrequency: "daily",
  backupRetention: 10,
  wrappedBackupPassword: null,
  lastBackupAt: null,
};
