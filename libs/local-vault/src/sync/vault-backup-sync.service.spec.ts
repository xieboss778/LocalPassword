import { BehaviorSubject, of } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { StateProvider } from "@localpass/state";

import { LocalAccountService } from "../account/local-account.service";
import { S3PreconditionFailedError } from "../s3/s3-client";

import { ACCOUNT_OBJECT, MANIFEST_OBJECT, SNAPSHOT_PREFIX } from "./backup-layout";
import { LocalAccountObject } from "./local-account-object";
import { Snapshot } from "./snapshot-merge";
import { RemoteVaultMismatchError, VaultBackupSyncService } from "./vault-backup-sync.service";

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
    return { manifestEtag: null, lastSyncedAt: null, pending: false };
  }
  if (name.includes("baseSnapshot")) {
    return null;
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
    const { service, fakeS3 } = setup({ "localVault:ciphers": initialCiphers });
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
});
