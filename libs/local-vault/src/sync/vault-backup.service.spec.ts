import { BehaviorSubject, of } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { StateProvider } from "@localpass/state";

import { LocalAccountService } from "../account/local-account.service";

import { MANIFEST_OBJECT, SNAPSHOT_PREFIX } from "./backup-layout";
import { LocalAccountObject } from "./local-account-object";
import { VaultBackupSyncService } from "./vault-backup-sync.service";
import { VaultBackupService } from "./vault-backup.service";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;
const now = new Date("2026-11-27T05:55:00.753Z");

const account: LocalAccountObject = {
  version: 2,
  userId,
  email: "owner@example.com",
  updatedAt: "2026-11-27T05:00:00.000Z",
  unlock: {
    salt: "owner@example.com",
    kdf: { kdfType: 0 },
    masterKeyWrappedUserKey: "wrapped-user-key",
  },
  wrappedPrivateKey: "wrapped-private-key",
};

/** A tiny fake S3 service: one bucket held in a Map, with conditional-PUT semantics. */
class FakeS3 {
  readonly objects = new Map<string, { body: string; etag: string }>();
  private version = 0;

  async getText(path: string) {
    const object = this.objects.get(path);
    return object == null ? null : { text: object.body, etag: object.etag };
  }

  async putObject(
    path: string,
    body: Uint8Array | string,
    options: { ifMatch?: string; ifNoneMatch?: string } = {},
  ) {
    const existing = this.objects.get(path);
    if (options.ifMatch != null && existing?.etag !== options.ifMatch) {
      throw new Error("stale");
    }
    if (options.ifNoneMatch === "*" && existing != null) {
      throw new Error("exists");
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

function setup(storedAccount: LocalAccountObject | null = account) {
  const state = new Map<string, BehaviorSubject<unknown>>();
  const bucket = (name: string, fallback: unknown) => {
    if (!state.has(name)) {
      state.set(name, new BehaviorSubject<unknown>(fallback));
    }
    return state.get(name)!;
  };

  const stateProvider = {
    getUser: (_userId: UserId, definition: { stateDefinition: { name: string }; key: string }) => {
      const name = `${definition.stateDefinition.name}:${definition.key}`;
      const subject = bucket(name, keyDefault(name));
      return {
        state$: subject.asObservable(),
        update: async (updater: (value: unknown) => unknown) => {
          subject.next(updater(subject.value));
        },
      };
    },
  } as unknown as StateProvider;

  const fakeS3 = new FakeS3();
  const encryptService = {
    encryptString: async (value: string) => ({ encryptedString: `wrapped:${value}` }),
    decryptString: async (value: { encryptedString: string }) =>
      value.encryptedString.replace("wrapped:", ""),
  };

  const sync = new VaultBackupSyncService(
    { isLocalAccount: async () => true } as unknown as LocalAccountService,
    stateProvider,
    { userKey$: () => of({}) } as any,
    encryptService as any,
    { info: jest.fn(), error: jest.fn() } as any,
    (() => fakeS3) as any,
    () => now,
    async () => storedAccount,
  );

  const service = new VaultBackupService(
    sync,
    async () => '{"encrypted":true}',
    stateProvider,
    { userKey$: () => of({}) } as any,
    encryptService as any,
    { info: jest.fn(), error: jest.fn() } as any,
    () => now,
  );

  return { service, sync, fakeS3 };
}

function keyDefault(name: string): unknown {
  if (name.includes("backupSyncState")) {
    return { manifestEtag: null, lastSyncedAt: null, pending: false };
  }
  if (name.includes("backupConfig") || name.includes("baseSnapshot")) {
    return null;
  }
  if (name.includes("backupSettings")) {
    return {
      backupFrequency: "daily",
      backupRetention: 10,
      wrappedBackupPassword: null,
      lastBackupAt: null,
    };
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

async function configure(sync: VaultBackupSyncService): Promise<void> {
  await sync.configure(userId, {
    endpoint: "https://acct.r2.cloudflarestorage.com",
    region: "auto",
    bucket: "vault",
    accessKeyId: "AKIA",
    secretAccessKey: "s",
    forcePathStyle: false,
  });
}

describe("VaultBackupService", () => {
  it("writes account.json even when the user only exports a backup", async () => {
    const { service, sync, fakeS3 } = setup();
    await configure(sync);

    await service.backupNow(userId);

    expect(fakeS3.objects.has("account.json")).toBe(true);
    expect([...fakeS3.objects.keys()]).toContain(
      "exports/2026-11-27/2026-11-27T05-55-00-753Z.json",
    );
  });

  it("does not upload an export when the account file cannot be written", async () => {
    const { service, sync, fakeS3 } = setup(null);
    await configure(sync);

    await expect(service.backupNow(userId)).rejects.toThrow();

    expect([...fakeS3.objects.keys()].filter((key) => key.startsWith("exports/"))).toEqual([]);
  });

  it("keeps the snapshot the manifest points at while pruning", async () => {
    const { service, sync, fakeS3 } = setup();
    await configure(sync);
    const seeds = seededSnapshotIds(11);
    for (const id of seeds) {
      fakeS3.objects.set(`${SNAPSHOT_PREFIX}${id}.json`, { body: "{}", etag: `etag-${id}` });
    }
    fakeS3.objects.set("account.json", { body: JSON.stringify(account), etag: "etag-account" });
    fakeS3.objects.set(MANIFEST_OBJECT, {
      body: JSON.stringify({ snapshot: seeds[0], updatedAt: "2026-11-20T00:00:00.000Z" }),
      etag: "etag-manifest",
    });

    await service.backupNow(userId);

    const remaining = [...fakeS3.objects.keys()]
      .filter((key) => key.startsWith(SNAPSHOT_PREFIX))
      .sort();
    expect(remaining).toHaveLength(10);
    expect(remaining).toContain(`${SNAPSHOT_PREFIX}${seeds[0]}.json`);
    expect(remaining).not.toContain(`${SNAPSHOT_PREFIX}${seeds[1]}.json`);
  });

  it("keeps only the newest exports after a backup", async () => {
    const { service, sync, fakeS3 } = setup();
    await configure(sync);
    const seeds = Array.from(
      { length: 11 },
      (_, index) =>
        `exports/2026-11-20/2026-11-20T00-00-00-${String(index + 1).padStart(2, "0")}Z.json`,
    );
    for (const key of seeds) {
      fakeS3.objects.set(key, { body: "{}", etag: `etag-${key}` });
    }

    await service.backupNow(userId);

    const remaining = [...fakeS3.objects.keys()].filter((key) => key.startsWith("exports/")).sort();
    expect(remaining).toHaveLength(10);
    expect(remaining).toContain("exports/2026-11-27/2026-11-27T05-55-00-753Z.json");
    expect(remaining).not.toContain(seeds[0]);
    expect(remaining).not.toContain(seeds[1]);
  });
});
