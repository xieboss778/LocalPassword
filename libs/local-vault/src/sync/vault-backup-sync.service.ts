import { firstValueFrom } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { FolderData } from "@localpass/common/vault/models/data/folder.data";
import { ENCRYPTED_CIPHERS } from "@localpass/common/vault/services/key-state/ciphers.state";
import { FOLDER_ENCRYPTED_FOLDERS } from "@localpass/common/vault/services/key-state/folder.state";
import { KeyService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncString, EncryptService } from "@localpass/legacy-crypto";
import { LogService } from "@localpass/logging";
import { StateProvider } from "@localpass/state";

import { LocalAccountService } from "../account/local-account.service";
import { S3Client, S3PreconditionFailedError } from "../s3/s3-client";

import { LocalAccountObject } from "./local-account-object";
import { MergeConflict, mergeSnapshots, Snapshot, VaultRecord } from "./snapshot-merge";
import {
  StoredVaultBackupConfig,
  VAULT_BACKUP_BASE_SNAPSHOT,
  VAULT_BACKUP_CONFIG,
  VAULT_BACKUP_SYNC_STATE,
  VaultBackupConfig,
  VaultBackupSyncState,
} from "./vault-backup-config";

/** The object layout under `<bucket>/<prefix>/<userId>/`. */
export const ACCOUNT_OBJECT = "account.json";
export const MANIFEST_OBJECT = "manifest.json";
export const SNAPSHOT_PREFIX = "snapshots/";
export const BACKUP_PREFIX = "backups/";

/** The state a vault starts with before its first sync. */
const EMPTY_SYNC_STATE: VaultBackupSyncState = {
  manifestEtag: null,
  lastSyncedAt: null,
  pending: false,
};

/** How many times a conditional manifest update is retried after losing a race. */
const MAX_MANIFEST_RETRIES = 3;

export interface PushResult {
  readonly uploaded: boolean;
  readonly snapshotId: string | null;
}

export interface PullResult {
  readonly applied: number;
  readonly upToDate: boolean;
  /** 这次拉取里两边都改过的条目；按更新时间较新的一侧胜出，界面据此给用户过目。 */
  readonly conflicts: readonly MergeConflict[];
}

export interface SyncResult {
  readonly pulled: PullResult;
  readonly pushed: PushResult;
}

interface Manifest {
  readonly snapshot: string;
  readonly updatedAt: string;
}

/**
 * Moves encrypted vault snapshots between this device and S3-compatible storage.
 *
 * Snapshots carry the same encrypted records the SDK already reads, so a pull is a plain state
 * write and a push is a copy of that state. Nothing here decrypts vault data; the only value that
 * gets wrapped is the storage secret.
 */
export class VaultBackupSyncService {
  constructor(
    private readonly localAccountService: LocalAccountService,
    private readonly stateProvider: StateProvider,
    private readonly keyService: KeyService,
    private readonly encryptService: EncryptService,
    private readonly logService: LogService,
    private readonly clientFactory: (config: VaultBackupConfig) => S3Client = (config) =>
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        prefix: config.prefix,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    private readonly clock: () => Date = () => new Date(),
    /** Supplies `account.json` for cross-device restore; null disables the upload. */
    private readonly readLocalAccountObject: (
      userId: UserId,
    ) => Promise<LocalAccountObject | null> = async () => null,
  ) {}

  async getConfig(userId: UserId): Promise<VaultBackupConfig | null> {
    const stored = await firstValueFrom(this.configState(userId).state$);
    if (stored == null) {
      return null;
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      return null;
    }

    const secretAccessKey = await this.encryptService.decryptString(
      new EncString(stored.wrappedSecretAccessKey),
      userKey,
    );

    return { ...stored, secretAccessKey };
  }

  async configure(userId: UserId, config: VaultBackupConfig): Promise<void> {
    if (!(await this.localAccountService.isLocalAccount(userId))) {
      throw new Error("Cloud sync is only available for a local vault.");
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("Unlock the vault before configuring cloud sync.");
    }

    const wrappedSecretAccessKey = await this.encryptService.encryptString(
      config.secretAccessKey,
      userKey,
    );
    const stored: StoredVaultBackupConfig = {
      provider: config.provider,
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      prefix: config.prefix,
      forcePathStyle: config.forcePathStyle,
      wrappedSecretAccessKey: wrappedSecretAccessKey.encryptedString ?? "",
    };

    await this.configState(userId).update(() => stored);
    await this.syncState(userId).update((state) => ({
      ...EMPTY_SYNC_STATE,
      ...(state ?? {}),
      pending: true,
    }));
  }

  async disconnect(userId: UserId): Promise<void> {
    await this.configState(userId).update(() => null);
    await this.syncState(userId).update(() => ({
      manifestEtag: null,
      lastSyncedAt: null,
      pending: false,
    }));
    await this.baseSnapshotState(userId).update(() => null);
  }

  async getSyncState(userId: UserId): Promise<VaultBackupSyncState> {
    const state = await firstValueFrom(this.syncState(userId).state$);
    return state ?? EMPTY_SYNC_STATE;
  }

  /** An S3 client for the configured storage, or null when sync is not configured yet. */
  async clientFor(userId: UserId): Promise<S3Client | null> {
    const config = await this.getConfig(userId);
    return config == null ? null : this.clientFactory(config);
  }

  /** Pulls the remote snapshot, merges it in, then pushes the merged result back. */
  async sync(userId: UserId): Promise<SyncResult> {
    const config = await this.getConfig(userId);
    if (config == null) {
      return {
        pulled: { applied: 0, upToDate: true, conflicts: [] },
        pushed: { uploaded: false, snapshotId: null },
      };
    }

    const client = this.clientFactory(config);
    const pulled = await this.pull(userId, client);
    const pushResult = await this.push(userId, client);

    return { pulled, pushed: pushResult };
  }

  /** Downloads the newest snapshot and applies it, unless it is the one already applied. */
  async pull(userId: UserId, client?: S3Client): Promise<PullResult> {
    const syncClient = client ?? (await this.requireClient(userId));

    const manifestObject = await syncClient.getText(MANIFEST_OBJECT);
    if (manifestObject == null) {
      return { applied: 0, upToDate: true, conflicts: [] };
    }
    const manifest = JSON.parse(manifestObject.text) as Manifest;

    const state = await this.getSyncState(userId);
    if (state.manifestEtag != null && manifestObject.etag === state.manifestEtag) {
      return { applied: 0, upToDate: true, conflicts: [] };
    }

    const remote = await syncClient.getText(`${SNAPSHOT_PREFIX}${manifest.snapshot}.json`);
    if (remote == null) {
      return { applied: 0, upToDate: true, conflicts: [] };
    }

    const remoteSnapshot = JSON.parse(remote.text) as Snapshot;
    const localSnapshot = await this.buildSnapshot(userId);
    const base = await firstValueFrom(this.baseSnapshotState(userId).state$);

    const { snapshot: merged, conflicts } = mergeSnapshots(localSnapshot, remoteSnapshot, base);
    const applied = await this.applySnapshot(userId, merged);

    await this.baseSnapshotState(userId).update(() => merged);
    await this.syncState(userId).update((current) => ({
      ...current,
      manifestEtag: manifestObject.etag,
      lastSyncedAt: this.clock().toISOString(),
      pending: conflicts.length > 0,
    }));

    return { applied, upToDate: false, conflicts };
  }

  /** Uploads a new snapshot and points the manifest at it. */
  async push(userId: UserId, client?: S3Client): Promise<PushResult> {
    const syncClient = client ?? (await this.requireClient(userId));

    let snapshot = await this.buildSnapshot(userId);
    let manifestEtag = (await this.getSyncState(userId)).manifestEtag;

    for (let attempt = 0; attempt < MAX_MANIFEST_RETRIES; attempt++) {
      const snapshotId = snapshotIdFor(this.clock());
      await syncClient.putObject(`${SNAPSHOT_PREFIX}${snapshotId}.json`, JSON.stringify(snapshot), {
        contentType: "application/json",
      });

      const manifest: Manifest = {
        snapshot: snapshotId,
        updatedAt: this.clock().toISOString(),
      };

      let newEtag: string | null;
      try {
        newEtag = await syncClient.putObject(MANIFEST_OBJECT, JSON.stringify(manifest), {
          contentType: "application/json",
          ifMatch: manifestEtag ?? undefined,
          ifNoneMatch: manifestEtag == null ? "*" : undefined,
        });
      } catch (error) {
        if (!(error instanceof S3PreconditionFailedError)) {
          throw error;
        }

        // Another device published first: take its snapshot, merge, and try again with its ETag.
        this.logService.info("Manifest changed while pushing; merging and retrying");
        const remote = await syncClient.getText(MANIFEST_OBJECT);
        if (remote == null) {
          manifestEtag = null;
          continue;
        }
        manifestEtag = remote.etag;
        const remoteManifest = JSON.parse(remote.text) as Manifest;
        const remoteSnapshot = await syncClient.getText(
          `${SNAPSHOT_PREFIX}${remoteManifest.snapshot}.json`,
        );
        if (remoteSnapshot != null) {
          const base = await firstValueFrom(this.baseSnapshotState(userId).state$);
          snapshot = mergeSnapshots(
            snapshot,
            JSON.parse(remoteSnapshot.text) as Snapshot,
            base,
          ).snapshot;
        }
        continue;
      }

      await this.baseSnapshotState(userId).update(() => snapshot);
      await this.syncState(userId).update(() => ({
        manifestEtag: newEtag,
        lastSyncedAt: this.clock().toISOString(),
        pending: false,
      }));

      // account.json is what a new device restores from; a failure here must not fail the push.
      await this.uploadAccountObject(userId, syncClient);

      return { uploaded: true, snapshotId };
    }

    this.logService.error("Gave up pushing the vault snapshot after repeated manifest races");
    return { uploaded: false, snapshotId: null };
  }

  private async uploadAccountObject(userId: UserId, client: S3Client): Promise<void> {
    try {
      const account = await this.readLocalAccountObject(userId);
      if (account == null) {
        return;
      }
      await client.putObject(ACCOUNT_OBJECT, JSON.stringify(account), {
        contentType: "application/json",
      });
    } catch (error) {
      this.logService.error("Failed to upload account.json", error);
    }
  }

  /** Builds the snapshot that represents what this device holds right now. */
  async buildSnapshot(userId: UserId): Promise<Snapshot> {
    const ciphers = (await firstValueFrom(this.ciphersState(userId).state$)) ?? {};
    const folders = (await firstValueFrom(this.foldersState(userId).state$)) ?? {};
    const base = await firstValueFrom(this.baseSnapshotState(userId).state$);

    const records = <T extends { revisionDate?: unknown; deletedDate?: unknown }>(
      bag: Record<string, T>,
    ): VaultRecord[] =>
      Object.entries(bag).map(([id, data]) => ({
        id,
        revisionDate: isoOf(data.revisionDate),
        deletedDate: data.deletedDate == null ? null : isoOf(data.deletedDate),
        data,
      }));

    return {
      updatedAt: this.clock().toISOString(),
      ciphers: records(ciphers as Record<string, CipherData>),
      folders: records(folders as Record<string, FolderData>),
      // Deletions since the last sync travel as tombstones, newest first.
      tombstones: tombstonesSince(base, [...records(ciphers), ...records(folders)]),
    };
  }

  /** Writes a merged snapshot back into local state; returns how many records were applied. */
  async applySnapshot(userId: UserId, snapshot: Snapshot): Promise<number> {
    const ciphers: Record<string, unknown> = {};
    const folders: Record<string, unknown> = {};

    for (const record of snapshot.ciphers) {
      if (record.data != null) {
        ciphers[record.id] = record.data;
      }
    }
    for (const record of snapshot.folders) {
      if (record.data != null) {
        folders[record.id] = record.data;
      }
    }

    await this.ciphersState(userId).update(() => ciphers as Record<string, CipherData>);
    await this.foldersState(userId).update(() => folders as Record<string, FolderData>);
    return snapshot.ciphers.length + snapshot.folders.length;
  }

  private async requireClient(userId: UserId): Promise<S3Client> {
    const config = await this.getConfig(userId);
    if (config == null) {
      throw new Error("Cloud sync is not configured for this vault.");
    }
    return this.clientFactory(config);
  }

  private ciphersState(userId: UserId) {
    return this.stateProvider.getUser(userId, ENCRYPTED_CIPHERS);
  }

  private foldersState(userId: UserId) {
    return this.stateProvider.getUser(userId, FOLDER_ENCRYPTED_FOLDERS);
  }

  private configState(userId: UserId) {
    return this.stateProvider.getUser(userId, VAULT_BACKUP_CONFIG);
  }

  private syncState(userId: UserId) {
    return this.stateProvider.getUser(userId, VAULT_BACKUP_SYNC_STATE);
  }

  private baseSnapshotState(userId: UserId) {
    return this.stateProvider.getUser(userId, VAULT_BACKUP_BASE_SNAPSHOT);
  }
}

function isoOf(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "string" ? value : new Date(0).toISOString();
}

/** Ids that were in the last synced snapshot but are gone locally are deletions. */
function tombstonesSince(base: Snapshot | null, current: VaultRecord[]): Snapshot["tombstones"] {
  if (base == null) {
    return [];
  }
  const live = new Set(current.map((record) => record.id));
  const now = new Date().toISOString();
  return [...base.ciphers, ...base.folders]
    .filter((record) => !live.has(record.id))
    .map((record) => ({ id: record.id, deletedAt: now }));
}

/** Snapshot ids sort by time, which is what the manifest needs to point at "the newest". */
function snapshotIdFor(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
