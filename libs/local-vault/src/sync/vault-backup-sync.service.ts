import { firstValueFrom } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { UserKey } from "@localpass/common/types/key";
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

import { ACCOUNT_OBJECT, EXPORT_PREFIX, MANIFEST_OBJECT, SNAPSHOT_PREFIX } from "./backup-layout";
import { LocalAccountObject, isLocalAccountObject } from "./local-account-object";
import {
  PendingVaultConflict,
  VAULT_BACKUP_PENDING_CONFLICTS,
  VaultConflictChoice,
} from "./pending-conflicts";
import {
  ConflictPreference,
  MergeConflict,
  mergeSnapshots,
  Snapshot,
  VaultRecord,
} from "./snapshot-merge";
import {
  DEFAULT_BACKUP_SETTINGS,
  StoredVaultBackupConfig,
  VAULT_BACKUP_BASE_SNAPSHOT,
  VAULT_BACKUP_CONFIG,
  VAULT_BACKUP_SETTINGS,
  VAULT_BACKUP_SYNC_STATE,
  VaultBackupConfig,
  VaultBackupSyncState,
} from "./vault-backup-config";

/** The state a vault starts with before its first sync. */
const EMPTY_SYNC_STATE: VaultBackupSyncState = {
  manifestEtag: null,
  lastSyncedAt: null,
  generation: null,
  pending: false,
};

/** How many times a conditional manifest update is retried after losing a race. */
const MAX_MANIFEST_RETRIES = 3;

/** Raised when the bucket already holds a different vault and writing would clobber it. */
export class RemoteVaultMismatchError extends Error {
  constructor() {
    super("This bucket already belongs to another vault.");
    this.name = "RemoteVaultMismatchError";
  }
}

export interface PushResult {
  readonly uploaded: boolean;
  readonly snapshotId: string | null;
}

export interface PullResult {
  readonly applied: number;
  readonly upToDate: boolean;
  /**
   * 这次拉取里两边都改过的条目。合并时先保留本机版本，远端版本进入待解决冲突，
   * 由界面让用户在「本机 / 远端 / 两份都留」之间选择；在解决前不会上传。
   */
  readonly conflicts: readonly MergeConflict[];
}

export interface SyncResult {
  readonly pulled: PullResult;
  readonly pushed: PushResult;
}

interface Manifest {
  readonly snapshot: string;
  readonly updatedAt: string;
  /** Monotonic manifest generation; absent on buckets written by older builds. */
  readonly gen?: number;
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
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      return null;
    }

    return this.getConfigWithUserKey(userId, userKey);
  }

  /**
   * Whether storage has been configured for this vault, without decrypting anything.
   *
   * Used by the restore screen while the vault is still locked: it can show the saved
   * snapshot flow without the user key, then decrypt the storage secret only after the
   * master password has been entered.
   */
  async hasConfig(userId: UserId): Promise<boolean> {
    const stored = await firstValueFrom(this.configState(userId).state$);
    return stored != null;
  }

  /**
   * Decrypts the storage secret with a caller-supplied user key.
   *
   * The restore screen derives this key from the entered master password so a locked
   * vault can still read its configured bucket. The key is only used to unwrap the
   * storage secret; callers must not persist it.
   */
  async getConfigWithUserKey(userId: UserId, userKey: UserKey): Promise<VaultBackupConfig | null> {
    const stored = await firstValueFrom(this.configState(userId).state$);
    if (stored == null) {
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
      endpoint: config.endpoint,
      region: config.region,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      forcePathStyle: config.forcePathStyle,
      wrappedSecretAccessKey: wrappedSecretAccessKey.encryptedString ?? "",
    };

    await this.configState(userId).update(() => stored);
    await this.conflictsState(userId).update(() => []);
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
      generation: null,
      pending: false,
    }));
    await this.baseSnapshotState(userId).update(() => null);
    await this.conflictsState(userId).update(() => []);
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

    const pending = await this.getPendingConflicts(userId);
    if (pending.length > 0) {
      return {
        pulled: { applied: 0, upToDate: false, conflicts: conflictsFromPending(pending) },
        pushed: { uploaded: false, snapshotId: null },
      };
    }

    const client = this.clientFactory(config);
    // The ownership check comes before the pull: a foreign bucket must never merge its
    // snapshot into this vault, even though nothing would be written yet.
    await this.ensureAccountObject(userId, client);
    const pulled = await this.pull(userId, client);

    // A conflicted pull holds this device's records. Uploading now would publish one side of
    // an unresolved conflict, so the push waits until the user has chosen.
    if (pulled.conflicts.length > 0) {
      return { pulled, pushed: { uploaded: false, snapshotId: null } };
    }

    const pushResult = await this.push(userId, client);

    return { pulled, pushed: pushResult };
  }

  /** Conflicts from the last pull that still need a user decision, held as encrypted records. */
  async getPendingConflicts(userId: UserId): Promise<PendingVaultConflict[]> {
    return (await firstValueFrom(this.conflictsState(userId).state$)) ?? [];
  }

  /**
   * Applies the user's choices for the held conflicts, then uploads the resolved snapshot.
   *
   * - `local` keeps this device's record untouched.
   * - `remote` writes the cloud record into local state.
   * - `both` keeps the local record and adds the cloud branch as a separate copy.
   *
   * Every choice is idempotent. The pending state survives a failed upload, and `both` derives
   * the copy id from the held remote revision, so retrying cannot create duplicate copies.
   */
  async resolveConflicts(
    userId: UserId,
    choices: Readonly<Record<string, VaultConflictChoice>>,
  ): Promise<PushResult> {
    const pending = await this.getPendingConflicts(userId);
    if (pending.length === 0) {
      return this.push(userId);
    }

    const cipherChanges: Record<string, CipherData> = {};
    const folderChanges: Record<string, FolderData> = {};
    const apply = (conflict: PendingVaultConflict, targetId: string) => {
      if (conflict.remote.data == null) {
        return;
      }
      const data = {
        ...(conflict.remote.data as Record<string, unknown>),
        id: targetId,
      };
      if (conflict.kind === "cipher") {
        cipherChanges[targetId] = data as unknown as CipherData;
      } else {
        folderChanges[targetId] = data as unknown as FolderData;
      }
    };

    for (const conflict of pending) {
      const choice = choices[conflict.id] ?? "both";
      if (choice === "remote") {
        apply(conflict, conflict.id);
      } else if (choice === "both") {
        apply(conflict, conflict.copyId);
      }
    }

    const previousCiphers =
      Object.keys(cipherChanges).length > 0
        ? { ...((await firstValueFrom(this.ciphersState(userId).state$)) ?? {}) }
        : null;
    const previousFolders =
      Object.keys(folderChanges).length > 0
        ? { ...((await firstValueFrom(this.foldersState(userId).state$)) ?? {}) }
        : null;

    if (previousCiphers != null) {
      await this.ciphersState(userId).update((state) => ({
        ...(state ?? {}),
        ...cipherChanges,
      }));
    }
    if (previousFolders != null) {
      await this.foldersState(userId).update((state) => ({
        ...(state ?? {}),
        ...folderChanges,
      }));
    }

    const rollback = async () => {
      if (previousCiphers != null) {
        await this.ciphersState(userId).update(() => previousCiphers);
      }
      if (previousFolders != null) {
        await this.foldersState(userId).update(() => previousFolders);
      }
      await this.conflictsState(userId).update(() => pending);
    };

    // push() refuses while conflicts are pending, so clear them for the duration of the upload
    // and roll back both local edits and pending conflicts if the upload does not succeed.
    await this.conflictsState(userId).update(() => []);
    try {
      const result = await this.push(userId);
      if (!result.uploaded) {
        const nextPending = await this.getPendingConflicts(userId);
        if (nextPending.length === 0) {
          await rollback();
        }
      }
      return result;
    } catch (error) {
      await rollback();
      throw error;
    }
  }

  /** Downloads the newest snapshot and applies it, unless it is the one already applied. */
  async pull(userId: UserId, client?: S3Client): Promise<PullResult> {
    const pendingBefore = await this.getPendingConflicts(userId);
    if (pendingBefore.length > 0) {
      return {
        applied: 0,
        upToDate: false,
        conflicts: conflictsFromPending(pendingBefore),
      };
    }

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

    const firstMerge = mergeSnapshots(localSnapshot, remoteSnapshot, base);
    let merged = firstMerge.snapshot;
    let conflicts = firstMerge.conflicts;

    if (conflicts.length > 0) {
      // Hold this device's version for every conflicted record. The cloud branch stays in the
      // pending state until the user chooses; nothing is silently overwritten.
      const holdLocal: Record<string, ConflictPreference> = {};
      for (const conflict of conflicts) {
        holdLocal[conflict.id] = "local";
      }
      const held = mergeSnapshots(localSnapshot, remoteSnapshot, base, holdLocal);
      merged = held.snapshot;
      conflicts = held.conflicts;
      const pending = pendingFrom(conflicts, localSnapshot, remoteSnapshot);
      await this.conflictsState(userId).update(() => pending);
    } else {
      await this.conflictsState(userId).update(() => []);
    }

    const applied = await this.applySnapshot(userId, merged);

    await this.baseSnapshotState(userId).update(() => merged);
    await this.syncState(userId).update((current) => ({
      ...current,
      manifestEtag: manifestObject.etag,
      lastSyncedAt: this.clock().toISOString(),
      generation: Math.max(current?.generation ?? 0, manifest.gen ?? 0) || null,
      pending: conflicts.length > 0,
    }));

    return { applied, upToDate: false, conflicts };
  }

  /** Uploads a new snapshot and points the manifest at it. */
  async push(userId: UserId, client?: S3Client): Promise<PushResult> {
    const syncClient = client ?? (await this.requireClient(userId));

    const pending = await this.getPendingConflicts(userId);
    if (pending.length > 0) {
      // Publishing now would pick a side of an unresolved conflict.
      this.logService.info("Skipped push while vault conflicts need review");
      return { uploaded: false, snapshotId: null };
    }

    // `sync` has already run the ownership check before pulling; a direct push must run it here.
    if (client == null) {
      await this.ensureAccountObject(userId, syncClient);
    }

    let snapshot = await this.buildSnapshot(userId);
    let mergedFromRemote = false;
    const syncState = await this.getSyncState(userId);
    let manifestEtag = syncState.manifestEtag;
    let generation = syncState.generation ?? 0;

    for (let attempt = 0; attempt < MAX_MANIFEST_RETRIES; attempt++) {
      const snapshotId = snapshotIdFor(this.clock());
      await syncClient.putObject(`${SNAPSHOT_PREFIX}${snapshotId}.json`, JSON.stringify(snapshot), {
        contentType: "application/json",
      });

      const manifest: Manifest = {
        snapshot: snapshotId,
        updatedAt: this.clock().toISOString(),
        gen: generation + 1,
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
        generation = Math.max(generation, remoteManifest.gen ?? 0);
        const remoteSnapshot = await syncClient.getText(
          `${SNAPSHOT_PREFIX}${remoteManifest.snapshot}.json`,
        );
        if (remoteSnapshot != null) {
          const parsedRemote = JSON.parse(remoteSnapshot.text) as Snapshot;
          const base = await firstValueFrom(this.baseSnapshotState(userId).state$);
          const mergeResult = mergeSnapshots(snapshot, parsedRemote, base);
          if (mergeResult.conflicts.length > 0) {
            const holdLocal: Record<string, ConflictPreference> = {};
            for (const conflict of mergeResult.conflicts) {
              holdLocal[conflict.id] = "local";
            }
            const held = mergeSnapshots(snapshot, parsedRemote, base, holdLocal);
            const nextPending = pendingFrom(held.conflicts, snapshot, parsedRemote);
            await this.applySnapshot(userId, held.snapshot);
            await this.conflictsState(userId).update(() => nextPending);
            await this.baseSnapshotState(userId).update(() => held.snapshot);
            await this.syncState(userId).update((current) => ({
              ...current,
              manifestEtag,
              lastSyncedAt: this.clock().toISOString(),
              generation: generation || null,
              pending: true,
            }));
            return { uploaded: false, snapshotId: null };
          }
          snapshot = mergeResult.snapshot;
          mergedFromRemote = true;
        }
        continue;
      }

      if (mergedFromRemote) {
        await this.applySnapshot(userId, snapshot);
      }
      await this.baseSnapshotState(userId).update(() => snapshot);
      await this.syncState(userId).update(() => ({
        manifestEtag: newEtag,
        lastSyncedAt: this.clock().toISOString(),
        generation: generation + 1,
        pending: false,
      }));

      await this.prune(userId, syncClient);

      return { uploaded: true, snapshotId };
    }

    this.logService.error("Gave up pushing the vault snapshot after repeated manifest races");
    return { uploaded: false, snapshotId: null };
  }

  /**
   * Writes the object another device restores from. Runs before anything else is written, so a
   * bucket that cannot hold an account file never receives a snapshot or an export.
   */
  async ensureAccountObject(userId: UserId, client?: S3Client): Promise<void> {
    const syncClient = client ?? (await this.requireClient(userId));

    const account = await this.readLocalAccountObject(userId);
    if (account == null) {
      throw new Error("Cannot write account.json: the vault is not unlocked.");
    }

    const existing = await syncClient.getText(ACCOUNT_OBJECT);
    if (existing != null) {
      if (this.userIdOf(existing.text) !== userId) {
        throw new RemoteVaultMismatchError();
      }
    } else if ((await syncClient.getText(MANIFEST_OBJECT)) != null) {
      // Objects without an account file are an inconsistent or foreign bucket; never adopt it.
      throw new RemoteVaultMismatchError();
    }

    await syncClient.putObject(ACCOUNT_OBJECT, JSON.stringify(account), {
      contentType: "application/json",
    });
  }

  private userIdOf(accountObject: string): UserId | null {
    try {
      const parsed: unknown = JSON.parse(accountObject);
      return isLocalAccountObject(parsed) ? parsed.userId : null;
    } catch {
      return null;
    }
  }

  /**
   * Deletes the oldest snapshots and exports beyond the retention count. Best-effort: a failed
   * cleanup must never turn a successful upload into a failed one, and the snapshot the manifest
   * points at is never deleted.
   */
  async prune(userId: UserId, client?: S3Client): Promise<void> {
    try {
      const syncClient = client ?? (await this.requireClient(userId));
      const retention = await this.retention(userId);
      const manifest = await syncClient.getText(MANIFEST_OBJECT);
      const keep = manifest == null ? null : this.snapshotKeyOf(manifest.text);
      await this.prunePrefix(syncClient, SNAPSHOT_PREFIX, retention, keep);
      await this.prunePrefix(syncClient, EXPORT_PREFIX, retention, null);
    } catch (error) {
      this.logService.error("Failed to prune remote vault history", error);
    }
  }

  private async retention(userId: UserId): Promise<number> {
    const settings = await firstValueFrom(this.settingsState(userId).state$);
    return settings?.backupRetention ?? DEFAULT_BACKUP_SETTINGS.backupRetention;
  }

  private snapshotKeyOf(manifest: string): string | null {
    try {
      const parsed = JSON.parse(manifest) as Manifest;
      return parsed.snapshot ? `${SNAPSHOT_PREFIX}${parsed.snapshot}.json` : null;
    } catch {
      return null;
    }
  }

  private async prunePrefix(
    client: S3Client,
    prefix: string,
    retention: number,
    keep: string | null,
  ): Promise<void> {
    const keys = (await client.listObjects(prefix)).map((object) => object.key).sort();
    const excess = keys.length - retention;
    if (excess <= 0) {
      return;
    }

    let deleted = 0;
    for (const key of keys) {
      if (deleted >= excess) {
        return;
      }
      if (key === keep) {
        continue;
      }
      await client.deleteObject(key);
      deleted++;
    }
  }

  /**
   * How many records differ from the last snapshot this device synced.
   *
   * The backup screen shows this as "changes waiting to upload": added, edited, and locally
   * deleted records all count once. It only reads local state, so it never contacts the bucket.
   * A vault that has never synced counts every record it holds.
   */
  async countPendingChanges(userId: UserId): Promise<number> {
    const base = await firstValueFrom(this.baseSnapshotState(userId).state$);
    const current = await this.buildSnapshot(userId);

    if (base == null) {
      return current.ciphers.length + current.folders.length;
    }

    let pending = 0;
    for (const kind of ["ciphers", "folders"] as const) {
      const unsynced = new Map(base[kind].map((record) => [record.id, record]));

      for (const record of current[kind]) {
        const synced = unsynced.get(record.id);
        if (
          synced == null ||
          synced.revisionDate !== record.revisionDate ||
          synced.deletedDate !== record.deletedDate
        ) {
          pending++;
        }
        unsynced.delete(record.id);
      }

      // Whatever the base snapshot still has and this device does not is a local deletion.
      pending += unsynced.size;
    }

    return pending;
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

    const now = this.clock().toISOString();
    return {
      updatedAt: now,
      ciphers: records(ciphers as Record<string, CipherData>),
      folders: records(folders as Record<string, FolderData>),
      // Deletions since the last sync travel as tombstones, newest first.
      tombstones: tombstonesSince(base, [...records(ciphers), ...records(folders)], now),
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

  /**
   * Restores a specific snapshot chosen by the user and advances the local baseline so
   * pending-change counts and sync state reflect the restored vault immediately.
   */
  async restoreSnapshot(userId: UserId, snapshot: Snapshot): Promise<number> {
    const applied = await this.applySnapshot(userId, snapshot);
    await this.baseSnapshotState(userId).update(() => snapshot);
    await this.conflictsState(userId).update(() => []);
    await this.syncState(userId).update((current) => ({
      ...EMPTY_SYNC_STATE,
      ...(current ?? {}),
      lastSyncedAt: this.clock().toISOString(),
      pending: false,
    }));
    return applied;
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

  private conflictsState(userId: UserId) {
    return this.stateProvider.getUser(userId, VAULT_BACKUP_PENDING_CONFLICTS);
  }

  private settingsState(userId: UserId) {
    return this.stateProvider.getUser(userId, VAULT_BACKUP_SETTINGS);
  }
}

function isoOf(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "string" ? value : new Date(0).toISOString();
}

/** Shape held conflicts as the merge summary the sync screen already understands. */
function conflictsFromPending(pending: readonly PendingVaultConflict[]): MergeConflict[] {
  return pending.map((conflict) => ({
    id: conflict.id,
    localRevision: conflict.local.revisionDate,
    remoteRevision: conflict.remote.revisionDate,
    winner: "local",
  }));
}

/** Collect the encrypted local and remote records for every id the merge reported. */
function pendingFrom(
  conflicts: readonly MergeConflict[],
  local: Snapshot,
  remote: Snapshot,
): PendingVaultConflict[] {
  const localCiphers = new Map(local.ciphers.map((record) => [record.id, record]));
  const remoteCiphers = new Map(remote.ciphers.map((record) => [record.id, record]));
  const localFolders = new Map(local.folders.map((record) => [record.id, record]));
  const remoteFolders = new Map(remote.folders.map((record) => [record.id, record]));

  const pending: PendingVaultConflict[] = [];
  for (const conflict of conflicts) {
    const localCipher = localCiphers.get(conflict.id);
    const remoteCipher = remoteCiphers.get(conflict.id);
    if (localCipher != null && remoteCipher != null) {
      pending.push({
        id: conflict.id,
        kind: "cipher",
        local: localCipher,
        remote: remoteCipher,
        copyId: crypto.randomUUID(),
      });
      continue;
    }

    const localFolder = localFolders.get(conflict.id);
    const remoteFolder = remoteFolders.get(conflict.id);
    if (localFolder != null && remoteFolder != null) {
      pending.push({
        id: conflict.id,
        kind: "folder",
        local: localFolder,
        remote: remoteFolder,
        copyId: crypto.randomUUID(),
      });
    }
  }
  return pending;
}

/** Ids that were in the last synced snapshot but are gone locally are deletions. */
function tombstonesSince(
  base: Snapshot | null,
  current: VaultRecord[],
  now: string,
): Snapshot["tombstones"] {
  if (base == null) {
    return [];
  }
  const live = new Set(current.map((record) => record.id));
  return [...base.ciphers, ...base.folders]
    .filter((record) => !live.has(record.id))
    .map((record) => ({ id: record.id, deletedAt: now }));
}

/** Snapshot ids sort by time, which is what the manifest needs to point at "the newest". */
function snapshotIdFor(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
