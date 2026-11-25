import { BehaviorSubject, of } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { StateProvider } from "@localpass/state";

import { LocalAccountService } from "../account/local-account.service";
import { S3PreconditionFailedError } from "../s3/s3-client";

import { Snapshot } from "./snapshot-merge";
import {
  MANIFEST_OBJECT,
  SNAPSHOT_PREFIX,
  VaultBackupSyncService,
} from "./vault-backup-sync.service";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;

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
}

function setup(initial: Record<string, unknown> = {}) {
  const state = new Map<string, BehaviorSubject<unknown>>();
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
    { userKey$: () => of({} as any) } as any,
    {
      encryptString: async (value: string) => ({ encryptedString: `wrapped:${value}` }),
      decryptString: async (value: { encryptedString: string }) =>
        value.encryptedString.replace("wrapped:", ""),
    } as any,
    { info: jest.fn(), error: jest.fn() } as any,
    () => fakeS3 as any,
    () => new Date("2026-11-24T10:00:00Z"),
  );

  return { service, state, fakeS3 };
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

describe("VaultBackupSyncService", () => {
  it("wraps the storage secret before it reaches disk", async () => {
    const { service, state } = setup();

    await service.configure(userId, {
      provider: "r2",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "vault",
      accessKeyId: "AKIA",
      secretAccessKey: "top-secret",
      prefix: "localpass",
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

  it("pushes a snapshot and points the manifest at it", async () => {
    const initialCiphers = { c1: { revisionDate: "2026-11-24T09:00:00.000Z" } };
    const { service, fakeS3 } = setup({ "localVault:ciphers": initialCiphers });
    await service.configure(userId, {
      provider: "r2",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "vault",
      accessKeyId: "AKIA",
      secretAccessKey: "s",
      prefix: "lp",
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
      provider: "r2",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "vault",
      accessKeyId: "AKIA",
      secretAccessKey: "s",
      prefix: "lp",
      forcePathStyle: false,
    });

    // Another device published a manifest after we read ours.
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: "other", updatedAt: "2026-11-24T09:00:00.000Z" }),
      etag: "etag-other",
    });

    const result = await service.push(userId);

    expect(result.uploaded).toBe(true);
    const manifest = JSON.parse(fakeS3.objects.get(MANIFEST_OBJECT)!.body);
    expect(manifest.snapshot).not.toBe("other");
  });
});
