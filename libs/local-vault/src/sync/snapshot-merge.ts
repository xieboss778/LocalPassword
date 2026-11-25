/**
 * Snapshot merge for the R2/S3 sync engine.
 *
 * Each device uploads a full snapshot and updates `manifest.json` with a conditional PUT.
 * Pulls merge item-by-item: the newer `revisionDate` wins, deletions travel as tombstones,
 * and a tombstone that is at least as new as the surviving record removes it.
 *
 * All functions are pure and deterministic so they can be tested without storage.
 */

export interface VaultRecord {
  readonly id: string;
  /** ISO 8601. Compared lexicographically. */
  readonly revisionDate: string;
  readonly deletedDate?: string | null;
  /**
   * The encrypted payload that travels with the record, e.g. a `CipherData` or `FolderData` as
   * JSON. The merge never inspects it — it moves with whichever side wins.
   */
  readonly data?: unknown;
}

export interface Tombstone {
  readonly id: string;
  /** ISO 8601, when the delete happened on the device that produced it. */
  readonly deletedAt: string;
}

export interface Snapshot {
  readonly updatedAt: string;
  readonly ciphers: readonly VaultRecord[];
  readonly folders: readonly VaultRecord[];
  readonly tombstones: readonly Tombstone[];
}

export interface MergeConflict {
  readonly id: string;
  readonly localRevision: string;
  readonly remoteRevision: string;
  readonly winner: "local" | "remote";
}

export interface MergeResult {
  readonly snapshot: Snapshot;
  readonly conflicts: readonly MergeConflict[];
}

function byId(records: readonly VaultRecord[]): Map<string, VaultRecord> {
  const map = new Map<string, VaultRecord>();
  for (const record of records) {
    map.set(record.id, record);
  }
  return map;
}

function newer(a: VaultRecord, b: VaultRecord): VaultRecord {
  if (a.revisionDate === b.revisionDate) {
    // Deterministic tie-break: the id is already equal, so keep local (first argument).
    return a;
  }
  return a.revisionDate > b.revisionDate ? a : b;
}

function latestTombstones(snapshots: ReadonlyArray<Snapshot | null>): Map<string, Tombstone> {
  const map = new Map<string, Tombstone>();
  for (const snapshot of snapshots) {
    for (const tombstone of snapshot?.tombstones ?? []) {
      const existing = map.get(tombstone.id);
      if (existing === undefined || tombstone.deletedAt > existing.deletedAt) {
        map.set(tombstone.id, tombstone);
      }
    }
  }
  return map;
}

function mergeCollection(
  kind: "ciphers" | "folders",
  base: Snapshot | null,
  local: Snapshot,
  remote: Snapshot | null,
  tombstones: Map<string, Tombstone>,
  conflicts: MergeConflict[],
): VaultRecord[] {
  const localRecords = byId(local[kind]);
  const remoteRecords = byId(remote?.[kind] ?? []);
  const baseRecords = base === null ? new Map<string, VaultRecord>() : byId(base[kind]);
  const ids = new Set<string>([...localRecords.keys(), ...remoteRecords.keys()]);
  const merged: VaultRecord[] = [];

  for (const id of ids) {
    const localRecord = localRecords.get(id);
    const remoteRecord = remoteRecords.get(id);
    const baseRecord = baseRecords.get(id);

    let winner: VaultRecord;
    if (localRecord === undefined) {
      winner = remoteRecord!;
    } else if (remoteRecord === undefined) {
      winner = localRecord;
    } else {
      winner = newer(localRecord, remoteRecord);
      const bothChanged =
        baseRecord === undefined ||
        (localRecord.revisionDate !== baseRecord.revisionDate &&
          remoteRecord.revisionDate !== baseRecord.revisionDate);
      if (bothChanged && localRecord.revisionDate !== remoteRecord.revisionDate) {
        conflicts.push({
          id,
          localRevision: localRecord.revisionDate,
          remoteRevision: remoteRecord.revisionDate,
          winner: winner === localRecord ? "local" : "remote",
        });
      }
    }

    const tombstone = tombstones.get(id);
    if (tombstone !== undefined && tombstone.deletedAt >= winner.revisionDate) {
      continue;
    }
    merged.push(winner);
  }

  return merged.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Merges the remote snapshot into the local one. `base` is the last snapshot this device
 * synced successfully; it is only used to tell "changed here" from "changed elsewhere" when
 * reporting conflicts, never to pick a winner.
 */
export function mergeSnapshots(
  local: Snapshot,
  remote: Snapshot | null,
  base: Snapshot | null = null,
): MergeResult {
  const tombstones = latestTombstones([base, local, remote]);
  const conflicts: MergeConflict[] = [];

  const ciphers = mergeCollection("ciphers", base, local, remote, tombstones, conflicts);
  const folders = mergeCollection("folders", base, local, remote, tombstones, conflicts);

  const liveIds = new Set<string>([...ciphers.map((c) => c.id), ...folders.map((f) => f.id)]);
  const tombstonesOut = [...tombstones.values()]
    .filter((t) => !liveIds.has(t.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const timestamps = [local.updatedAt, remote?.updatedAt ?? ""].sort();

  return {
    snapshot: {
      updatedAt: timestamps[timestamps.length - 1],
      ciphers,
      folders,
      tombstones: tombstonesOut,
    },
    conflicts,
  };
}

/** True when two snapshots carry identical vault content (ignores `updatedAt`). */
export function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify({ c: a.ciphers, f: a.folders, t: a.tombstones }) ===
    JSON.stringify({ c: b.ciphers, f: b.folders, t: b.tombstones });
}
