import { BehaviorSubject, of } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { StateProvider } from "@localpass/state";

import { LocalAccountService } from "../account/local-account.service";
import { S3PreconditionFailedError } from "../s3/s3-client";

import { ACCOUNT_OBJECT, MANIFEST_OBJECT, SNAPSHOT_PREFIX } from "./backup-layout";
import { LocalAccountObject } from "./local-account-object";
import { Snapshot, VaultRecord } from "./snapshot-merge";
import {
  RemoteSnapshotUnavailableError,
  RemoteVaultMismatchError,
  VaultBackupSyncService,
} from "./vault-backup-sync.service";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;
const otherUserId = "22222222-2222-2222-2222-222222222222" as UserId;

const account: LocalAccountObject = {
  version: 2,
  userId,
  email: "owner@example.com",
  updatedAt: "2026-11-24T09:00:00.000Z",
  unlock: {
    salt: "owner@example.com",
    kdf: { kdfType: 0 },
    masterKeyWrappedUserKey: "wrapped-user-key",
  },
  wrappedPrivateKey: "wrapped-private-key",
};

/** A tiny fake S3 service: one bucket held in a Map, with real conditional-PUT semantics. */
class FakeS3 {
  readonly objects = new Map<string, { body: string; etag: string }>();
  private version = 0;

  async getText(path: string) {
    const object = this.objects.get(path);
    return object == null ? null : { text: object.body, etag: object.etag };
  }

  async getObject(path: string) {
    const object = this.objects.get(path);
    return object == null
      ? null
      : { key: path, body: new TextEncoder().encode(object.body), etag: object.etag };
  }

  async putObject(
    path: string,
    body: Uint8Array | string,
    options: { ifMatch?: string; ifNoneMatch?: string } = {},
  ) {
    const existing = this.objects.get(path);
    if (options.ifMatch != null && existing?.etag !== options.ifMatch) {
      throw new S3PreconditionFailedError("stale");
    }
    if (options.ifNoneMatch === "*" && existing != null) {
      throw new S3PreconditionFailedError("exists");
    }
    const etag = `etag-${++this.version}`;
    this.objects.set(path, { body: String(body), etag });
    return etag;
  }

  async deleteObject(path: string) {
    this.objects.delete(path);
  }

  async listObjects(prefix: string) {
    return [...this.objects.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, etag: value.etag, size: value.body.length }));
  }
}

function setup(
  initial: Record<string, unknown> = {},
  clientFactory?: (config: unknown) => unknown,
  storedAccount: LocalAccountObject | null = account,
) {
  const state = new Map<string, BehaviorSubject<unknown>>();
  let userKey: unknown = {};
  const bucket = (key: string, fallback: unknown) => {
    if (!state.has(key)) {
      state.set(key, new BehaviorSubject<unknown>(fallback));
    }
    return state.get(key)!;
  };

  const stateProvider = {
    getUser: (_userId: UserId, definition: { stateDefinition: { name: string }; key: string }) => {
      const name = `${definition.stateDefinition.name}:${definition.key}`;
      const subject = bucket(name, keyDefault(name, initial));
      return {
        state$: subject.asObservable(),
        update: async (updater: (value: unknown) => unknown) => {
          subject.next(updater(subject.value));
        },
      };
    },
  } as unknown as StateProvider;

  const fakeS3 = new FakeS3();
  const service = new VaultBackupSyncService(
    { isLocalAccount: async () => true } as unknown as LocalAccountService,
    stateProvider,
    { userKey$: () => of(userKey) } as any,
    {
      encryptString: async (value: string) => ({ encryptedString: `wrapped:${value}` }),
      decryptString: async (value: { encryptedString: string }) =>
        value.encryptedString.replace("wrapped:", ""),
    } as any,
    { info: jest.fn(), error: jest.fn() } as any,
    (clientFactory ?? (() => fakeS3)) as any,
    () => new Date("2026-11-24T10:00:00Z"),
    async () => storedAccount,
  );

  return {
    service,
    state,
    fakeS3,
    lock: (): void => {
      userKey = null;
    },
  };
}

function keyDefault(name: string, initial: Record<string, unknown>): unknown {
  if (name.includes("backupSyncState")) {
    return { manifestEtag: null, lastSyncedAt: null, generation: null, pending: false };
  }
  if (name.includes("pendingConflicts")) {
    return initial[name] ?? [];
  }
  if (name.includes("baseSnapshot")) {
    return initial[name] ?? null;
  }
  if (name.includes("backupConfig")) {
    return null;
  }
  if (initial[name] !== undefined) {
    return initial[name];
  }
  return {};
}

/** Snapshot ids that sort before the fixed clock in these tests, oldest first. */
function seededSnapshotIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `2026-11-20T00-00-00-${String(index + 1).padStart(2, "0")}Z`,
  );
}

async function configure(service: VaultBackupSyncService): Promise<void> {
  await service.configure(userId, {
    endpoint: "https://acct.r2.cloudflarestorage.com",
    region: "auto",
    bucket: "vault",
    accessKeyId: "AKIA",
    secretAccessKey: "s",
    forcePathStyle: false,
  });
}

function valueOf<T>(state: Map<string, BehaviorSubject<unknown>>, key: string): T {
  return state.get(key)!.value as T;
}

function remoteConflictFixture(localName: string, remoteName: string) {
  const base: Snapshot = {
    updatedAt: "2026-11-24T09:00:00.000Z",
    ciphers: [
      {
        id: "c1",
        revisionDate: "2026-11-24T09:00:00.000Z",
        data: { id: "c1", login: { username: "base" } },
      },
    ],
    folders: [],
    tombstones: [],
  };
  const local: VaultRecord = {
    id: "c1",
    revisionDate: "2026-11-24T10:00:00.000Z",
    deletedDate: null,
    data: {
      id: "c1",
      revisionDate: "2026-11-24T10:00:00.000Z",
      login: { username: localName },
    },
  };
  const remote: VaultRecord = {
    id: "c1",
    revisionDate: "2026-11-24T11:00:00.000Z",
    deletedDate: null,
    data: {
      id: "c1",
      revisionDate: "2026-11-24T11:00:00.000Z",
      login: { username: remoteName },
    },
  };
  return { base, local, remote };
}

describe("VaultBackupSyncService", () => {
  it("wraps the storage secret before it reaches disk", async () => {
    const { service, state } = setup();

    await service.configure(userId, {
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "vault",
      accessKeyId: "AKIA",
      secretAccessKey: "top-secret",
      forcePathStyle: false,
    });

    const stored = [...state.entries()].find(([key]) => key.includes("backupConfig"))![1].value as {
      wrappedSecretAccessKey: string;
    };
    expect(stored.wrappedSecretAccessKey).toBe("wrapped:top-secret");
    await expect(service.getConfig(userId)).resolves.toMatchObject({
      secretAccessKey: "top-secret",
    });
  });

  it("shows a stored config to a locked vault without decrypting the secret", async () => {
    const { service, lock } = setup();
    await service.configure(userId, {
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "vault",
      accessKeyId: "AKIA",
      secretAccessKey: "top-secret",
      forcePathStyle: false,
    });

    lock();

    await expect(service.hasConfig(userId)).resolves.toBe(true);
    await expect(service.getConfig(userId)).resolves.toBeNull();
    // The restore screen passes the key derived from the master password it has just verified.
    await expect(service.getConfigWithUserKey(userId, {} as any)).resolves.toMatchObject({
      secretAccessKey: "top-secret",
      bucket: "vault",
    });
  });

  it("reports no stored config for a fresh vault", async () => {
    const { service } = setup();

    await expect(service.hasConfig(userId)).resolves.toBe(false);
    await expect(service.getConfigWithUserKey(userId, {} as any)).resolves.toBeNull();
  });

  it("pushes a snapshot and points the manifest at it", async () => {
    const initialCiphers = { c1: { revisionDate: "2026-11-24T09:00:00.000Z" } };
    const { service, fakeS3 } = setup({ "ciphers:ciphers": initialCiphers });
    await service.configure(userId, {
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "vault",
      accessKeyId: "AKIA",
      secretAccessKey: "s",
      forcePathStyle: false,
    });

    const result = await service.push(userId);

    expect(result.uploaded).toBe(true);
    const manifest = JSON.parse(fakeS3.objects.get(MANIFEST_OBJECT)!.body);
    expect(fakeS3.objects.has(`${SNAPSHOT_PREFIX}${manifest.snapshot}.json`)).toBe(true);
  });

  it("counts every record as pending before the first sync", async () => {
    const { service } = setup({
      "ciphers:ciphers": {
        c1: { revisionDate: "2026-11-24T09:00:00.000Z" },
        c2: { revisionDate: "2026-11-24T09:00:00.000Z" },
      },
      "folder:folders": { f1: { revisionDate: "2026-11-24T09:00:00.000Z" } },
    });

    await expect(service.countPendingChanges(userId)).resolves.toBe(3);
  });

  it("counts only records that changed since the last sync", async () => {
    const base: Snapshot = {
      updatedAt: "2026-11-24T09:00:00.000Z",
      ciphers: [
        { id: "same", revisionDate: "2026-11-24T09:00:00.000Z", deletedDate: null, data: {} },
        { id: "edited", revisionDate: "2026-11-24T09:00:00.000Z", deletedDate: null, data: {} },
        { id: "removed", revisionDate: "2026-11-24T09:00:00.000Z", deletedDate: null, data: {} },
        {
          id: "restored",
          revisionDate: "2026-11-24T09:00:00.000Z",
          deletedDate: "2026-11-24T09:30:00.000Z",
          data: {},
        },
      ],
      folders: [
        {
          id: "folder-same",
          revisionDate: "2026-11-24T09:00:00.000Z",
          deletedDate: null,
          data: {},
        },
      ],
      tombstones: [],
    };
    const { service } = setup({
      "localVaultSync:baseSnapshot": base,
      "ciphers:ciphers": {
        same: { revisionDate: "2026-11-24T09:00:00.000Z" },
        edited: { revisionDate: "2026-11-24T10:00:00.000Z" },
        added: { revisionDate: "2026-11-24T10:00:00.000Z" },
        restored: { revisionDate: "2026-11-24T10:00:00.000Z" },
      },
      "folder:folders": {
        "folder-same": { revisionDate: "2026-11-24T09:00:00.000Z" },
      },
    });

    // edited, added, removed, and restored; `same` and `folder-same` match the base.
    await expect(service.countPendingChanges(userId)).resolves.toBe(4);
  });

  it("reports no pending changes after a push", async () => {
    const { service } = setup({
      "ciphers:ciphers": { c1: { revisionDate: "2026-11-24T09:00:00.000Z" } },
    });
    await configure(service);

    await expect(service.countPendingChanges(userId)).resolves.toBe(1);
    await service.push(userId);
    await expect(service.countPendingChanges(userId)).resolves.toBe(0);
  });

  it("merges the remote snapshot into local state on pull", async () => {
    const { service, fakeS3 } = setup();

    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "remote-1", updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-m",
    });
    fakeS3.objects.set(`${SNAPSHOT_PREFIX}remote-1.json`, {
      body: JSON.stringify({
        updatedAt: "2026-11-24T11:00:00.000Z",
        ciphers: [{ id: "c1", revisionDate: "2026-11-24T11:00:00.000Z", data: { blob: "remote" } }],
        folders: [],
        tombstones: [],
      } satisfies Snapshot),
      etag: "etag-s",
    });

    const remoteBody = fakeS3.objects.get(`${SNAPSHOT_PREFIX}remote-1.json`)!.body;
    const applied = await service.applySnapshot(userId, JSON.parse(remoteBody) as Snapshot);

    expect(applied).toBe(1);
  });

  it("holds this device's record and stores the cloud branch on a conflict", async () => {
    const fixture = remoteConflictFixture("local", "remote");
    const { service, fakeS3, state } = setup({
      "localVaultSync:baseSnapshot": fixture.base,
      "ciphers:ciphers": { c1: fixture.local.data },
    });
    await configure(service);
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "remote-1", updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-m",
    });
    fakeS3.objects.set(`${SNAPSHOT_PREFIX}remote-1.json`, {
      body: JSON.stringify({
        updatedAt: "2026-11-24T11:00:00.000Z",
        ciphers: [
          {
            id: "c1",
            revisionDate: "2026-11-24T11:00:00.000Z",
            data: { id: "c1", login: { username: "remote" } },
          },
        ],
        folders: [],
        tombstones: [],
      } satisfies Snapshot),
      etag: "etag-s",
    });

    const result = await service.pull(userId);

    expect(result.conflicts).toEqual([
      {
        id: "c1",
        localRevision: "2026-11-24T10:00:00.000Z",
        remoteRevision: "2026-11-24T11:00:00.000Z",
        winner: "local",
      },
    ]);
    expect(valueOf<Record<string, any>>(state, "ciphers:ciphers").c1.login.username).toBe("local");

    const pending = valueOf<any[]>(state, "localVaultSync:pendingConflicts");
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("cipher");
    expect(pending[0].remote.data.login.username).toBe("remote");
    // The keep-both copy id must be a UUID: non-UUID ids break SDK cipher decryption.
    expect(pending[0].copyId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(valueOf<{ pending: boolean }>(state, "localVaultSync:backupSyncState").pending).toBe(
      true,
    );
  });

  it("does not upload while a conflict needs a decision", async () => {
    const fixture = remoteConflictFixture("local", "remote");
    const copyId = "0b7a9f2e-3a6d-5b6f-8f0a-1c2d3e4f5a6b";
    const pending = [
      { id: "c1", kind: "cipher", local: fixture.local, remote: fixture.remote, copyId },
    ];
    const { service, fakeS3, state } = setup({
      "ciphers:ciphers": { c1: fixture.local.data },
    });
    await configure(service);
    state.get("localVaultSync:pendingConflicts")!.next(pending);

    const result = await service.sync(userId);

    expect(result.pushed.uploaded).toBe(false);
    expect(result.pulled.conflicts).toHaveLength(1);
    expect(fakeS3.objects.size).toBe(0);
    expect(valueOf<any[]>(state, "localVaultSync:pendingConflicts")).toHaveLength(1);
  });

  it("keeps this device's record when resolving with local", async () => {
    const fixture = remoteConflictFixture("local", "remote");
    const copyId = "0b7a9f2e-3a6d-5b6f-8f0a-1c2d3e4f5a6b";
    const pending = [
      { id: "c1", kind: "cipher", local: fixture.local, remote: fixture.remote, copyId },
    ];
    const { service, state } = setup({
      "ciphers:ciphers": { c1: fixture.local.data },
    });
    await configure(service);
    state.get("localVaultSync:pendingConflicts")!.next(pending);

    const result = await service.resolveConflicts(userId, { c1: "local" });

    expect(result.uploaded).toBe(true);
    expect(valueOf<Record<string, any>>(state, "ciphers:ciphers").c1.login.username).toBe("local");
    expect(valueOf<any[]>(state, "localVaultSync:pendingConflicts")).toHaveLength(0);
  });

  it("writes the cloud record when resolving with remote", async () => {
    const fixture = remoteConflictFixture("local", "remote");
    const copyId = "0b7a9f2e-3a6d-5b6f-8f0a-1c2d3e4f5a6b";
    const pending = [
      { id: "c1", kind: "cipher", local: fixture.local, remote: fixture.remote, copyId },
    ];
    const { service, state } = setup({
      "ciphers:ciphers": { c1: fixture.local.data },
    });
    await configure(service);
    state.get("localVaultSync:pendingConflicts")!.next(pending);

    const result = await service.resolveConflicts(userId, { c1: "remote" });

    expect(result.uploaded).toBe(true);
    expect(valueOf<Record<string, any>>(state, "ciphers:ciphers").c1.login.username).toBe("remote");
    expect(valueOf<any[]>(state, "localVaultSync:pendingConflicts")).toHaveLength(0);
  });

  it("adds the cloud branch as a stable copy when resolving with both", async () => {
    const fixture = remoteConflictFixture("local", "remote");
    const copyId = "0b7a9f2e-3a6d-5b6f-8f0a-1c2d3e4f5a6b";
    const pending = [
      { id: "c1", kind: "cipher", local: fixture.local, remote: fixture.remote, copyId },
    ];
    const { service, state } = setup({
      "ciphers:ciphers": { c1: fixture.local.data },
    });
    await configure(service);
    state.get("localVaultSync:pendingConflicts")!.next(pending);

    await service.resolveConflicts(userId, { c1: "both" });

    const ciphers = valueOf<Record<string, any>>(state, "ciphers:ciphers");
    expect(Object.keys(ciphers).sort()).toEqual([copyId, "c1"].sort());
    expect(ciphers.c1.login.username).toBe("local");
    expect(ciphers[copyId].login.username).toBe("remote");

    // A retry after a failed upload replays the same held conflict; the copy must not duplicate.
    state.get("localVaultSync:pendingConflicts")!.next(pending);
    await service.resolveConflicts(userId, { c1: "both" });
    expect(Object.keys(valueOf<Record<string, any>>(state, "ciphers:ciphers")).sort()).toEqual(
      [copyId, "c1"].sort(),
    );
  });

  it("retries on a manifest race instead of overwriting the other device", async () => {
    const { service, fakeS3 } = setup();
    await service.configure(userId, {
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "vault",
      accessKeyId: "AKIA",
      secretAccessKey: "s",
      forcePathStyle: false,
    });

    // Another device published a manifest after we read ours.
    fakeS3.objects.set(ACCOUNT_OBJECT, { body: JSON.stringify(account), etag: "etag-account" });
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "other", updatedAt: "2026-11-24T09:00:00.000Z" }),
      etag: "etag-other",
    });

    const result = await service.push(userId);

    expect(result.uploaded).toBe(true);
    const manifest = JSON.parse(fakeS3.objects.get(MANIFEST_OBJECT)!.body);
    expect(manifest.snapshot).not.toBe("other");
  });

  it("refuses to pull from a bucket that belongs to another vault", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    await service.applySnapshot(userId, {
      updatedAt: "2026-11-24T09:00:00.000Z",
      ciphers: [
        { id: "c1", revisionDate: "2026-11-24T09:00:00.000Z", deletedDate: null, data: {} },
      ],
      folders: [],
      tombstones: [],
    });
    fakeS3.objects.set(ACCOUNT_OBJECT, {
      body: JSON.stringify({ ...account, userId: otherUserId }),
      etag: "etag-foreign",
    });
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "foreign", updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-manifest",
    });
    fakeS3.objects.set(`${SNAPSHOT_PREFIX}foreign.json`, {
      body: JSON.stringify({
        updatedAt: "2026-11-24T11:00:00.000Z",
        ciphers: [{ id: "c2", revisionDate: "2026-11-24T11:00:00.000Z", data: { blob: "remote" } }],
        folders: [],
        tombstones: [],
      } satisfies Snapshot),
      etag: "etag-snapshot",
    });

    await expect(service.sync(userId)).rejects.toBeInstanceOf(RemoteVaultMismatchError);

    const local = await service.buildSnapshot(userId);
    expect(local.ciphers.map((record) => record.id)).toEqual(["c1"]);
  });

  it("refuses to write into a bucket that belongs to another vault", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    fakeS3.objects.set(ACCOUNT_OBJECT, {
      body: JSON.stringify({ ...account, userId: otherUserId }),
      etag: "etag-foreign",
    });

    await expect(service.push(userId)).rejects.toBeInstanceOf(RemoteVaultMismatchError);

    expect([...fakeS3.objects.keys()]).toEqual([ACCOUNT_OBJECT]);
    expect(JSON.parse(fakeS3.objects.get(ACCOUNT_OBJECT)!.body).userId).toBe(otherUserId);
  });

  it("refuses a bucket that has a manifest but no account file", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "s1", updatedAt: "2026-11-24T09:00:00.000Z" }),
      etag: "etag-manifest",
    });

    await expect(service.push(userId)).rejects.toBeInstanceOf(RemoteVaultMismatchError);

    expect([...fakeS3.objects.keys()].filter((key) => key.startsWith(SNAPSHOT_PREFIX))).toEqual([]);
  });

  it("does not write a snapshot when the account file cannot be read", async () => {
    const { service, fakeS3 } = setup({}, undefined, null);
    await configure(service);

    await expect(service.push(userId)).rejects.toThrow();

    expect([...fakeS3.objects.keys()].filter((key) => key.startsWith(SNAPSHOT_PREFIX))).toEqual([]);
  });

  it("advances the manifest generation on every push and adopts a remote one", async () => {
    const { service, fakeS3, state } = setup();
    await configure(service);

    await service.push(userId);
    const first = JSON.parse(fakeS3.objects.get(MANIFEST_OBJECT)!.body);
    expect(first.gen).toBe(1);
    expect(
      valueOf<{ generation: number }>(state, "localVaultSync:backupSyncState").generation,
    ).toBe(1);

    await service.push(userId);
    expect(JSON.parse(fakeS3.objects.get(MANIFEST_OBJECT)!.body).gen).toBe(2);

    // Another device advanced the bucket to gen 7; the retry must continue from there.
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({
        snapshot: "remote-7",
        updatedAt: "2026-11-24T09:00:00.000Z",
        gen: 7,
      }),
      etag: "etag-remote",
    });
    await service.push(userId);
    expect(JSON.parse(fakeS3.objects.get(MANIFEST_OBJECT)!.body).gen).toBe(8);
  });

  it("keeps only the newest snapshots after a push", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    const seeds = seededSnapshotIds(11);
    for (const id of seeds) {
      fakeS3.objects.set(`${SNAPSHOT_PREFIX}${id}.json`, { body: "{}", etag: `etag-${id}` });
    }

    await service.push(userId);

    const remaining = [...fakeS3.objects.keys()]
      .filter((key) => key.startsWith(SNAPSHOT_PREFIX))
      .sort();
    expect(remaining).toHaveLength(10);
    expect(remaining).toContain(`${SNAPSHOT_PREFIX}2026-11-24T10-00-00-000Z.json`);
    expect(remaining).not.toContain(`${SNAPSHOT_PREFIX}${seeds[0]}.json`);
    expect(remaining).not.toContain(`${SNAPSHOT_PREFIX}${seeds[1]}.json`);
  });

  it("writes every object into the bucket root, with no per-vault prefix", async () => {
    const fakeS3 = new FakeS3();
    const factory = jest.fn((_config: unknown) => fakeS3);
    const { service } = setup({}, factory);

    await configure(service);
    await service.sync(userId);

    expect(factory.mock.calls[0][0]).not.toHaveProperty("prefix");
    expect([...fakeS3.objects.keys()]).toEqual(
      expect.arrayContaining([ACCOUNT_OBJECT, MANIFEST_OBJECT]),
    );
  });

  it("rejects a pull when the manifest points at a missing snapshot", async () => {
    const { service, fakeS3 } = setup({
      "ciphers:ciphers": { c1: { revisionDate: "2026-11-24T09:00:00.000Z" } },
    });
    await configure(service);
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "gone", updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-m",
    });

    await expect(service.pull(userId)).rejects.toBeInstanceOf(RemoteSnapshotUnavailableError);

    // The local vault is untouched when the cloud copy cannot be read.
    expect((await service.buildSnapshot(userId)).ciphers.map((record) => record.id)).toEqual([
      "c1",
    ]);
  });

  it("rejects a pull when the manifest itself is not readable", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    fakeS3.objects.set(MANIFEST_OBJECT, { body: "<html>not json</html>", etag: "etag-m" });

    await expect(service.pull(userId)).rejects.toBeInstanceOf(RemoteSnapshotUnavailableError);
  });

  it("rejects a pull when the snapshot is not readable", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "broken", updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-m",
    });
    fakeS3.objects.set(`${SNAPSHOT_PREFIX}broken.json`, {
      body: "not json",
      etag: "etag-s",
    });

    await expect(service.pull(userId)).rejects.toBeInstanceOf(RemoteSnapshotUnavailableError);
  });

  it("rejects a pull when the snapshot parses but has the wrong shape", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "empty", updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-m",
    });
    fakeS3.objects.set(`${SNAPSHOT_PREFIX}empty.json`, {
      body: JSON.stringify({ updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-s",
    });

    await expect(service.pull(userId)).rejects.toBeInstanceOf(RemoteSnapshotUnavailableError);
  });

  it("propagates a damaged cloud copy out of sync instead of reporting success", async () => {
    const { service, fakeS3 } = setup();
    await configure(service);
    fakeS3.objects.set(ACCOUNT_OBJECT, { body: JSON.stringify(account), etag: "etag-account" });
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "gone", updatedAt: "2026-11-24T11:00:00.000Z" }),
      etag: "etag-m",
    });

    await expect(service.sync(userId)).rejects.toBeInstanceOf(RemoteSnapshotUnavailableError);
  });

  it("refuses to restore a snapshot of the wrong shape and leaves local state alone", async () => {
    const { service } = setup({
      "ciphers:ciphers": { c1: { revisionDate: "2026-11-24T09:00:00.000Z" } },
    });

    await expect(
      service.restoreSnapshot(userId, { updatedAt: "2026-11-24T11:00:00.000Z" } as Snapshot),
    ).rejects.toBeInstanceOf(RemoteSnapshotUnavailableError);

    expect((await service.buildSnapshot(userId)).ciphers.map((record) => record.id)).toEqual([
      "c1",
    ]);
  });
});
