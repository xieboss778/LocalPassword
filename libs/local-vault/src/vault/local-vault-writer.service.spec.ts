import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";
import { CipherEncryptionService } from "@localpass/common/vault/abstractions/cipher-encryption.service";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { FolderData } from "@localpass/common/vault/models/data/folder.data";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";
import { PasswordHistoryView } from "@localpass/common/vault/models/view/password-history.view";

import { LocalAccountService } from "../account/local-account.service";
import { ItemKind, setKind } from "../items/item-kind";

import { CipherVersion } from "./cipher-version-history";
import { DefaultLocalVaultWriter } from "./local-vault-writer.service";

describe("DefaultLocalVaultWriter", () => {
  const userId = "user-id" as UserId;
  const localAccountService = mock<LocalAccountService>();
  const cipherEncryptionService = mock<CipherEncryptionService>();
  const logService = mock<LogService>();

  let state: Record<string, CipherData>;
  let folders: Record<string, FolderData>;
  let versions: Record<string, CipherVersion[]>;

  const createWriter = () => {
    const updates = {
      ciphers: jest.fn(
        async (
          updater: (current: Record<string, CipherData> | null) => Record<string, CipherData>,
        ) => {
          state = updater(state);
        },
      ),
      folders: jest.fn(
        async (
          updater: (current: Record<string, FolderData> | null) => Record<string, FolderData>,
        ) => {
          folders = updater(folders);
        },
      ),
      cipherVersionHistory: jest.fn(
        async (
          updater: (
            current: Record<string, CipherVersion[]> | null,
          ) => Record<string, CipherVersion[]>,
        ) => {
          versions = updater(versions);
        },
      ),
    };
    const stateProvider = {
      getUser: (_userId: unknown, definition: { key: string }) => {
        switch (definition.key) {
          case "folders":
            return { state$: of(folders), update: updates.folders };
          case "cipherVersionHistory":
            return { state$: of(versions), update: updates.cipherVersionHistory };
          default:
            return { state$: of(state), update: updates.ciphers };
        }
      },
    };

    return new DefaultLocalVaultWriter(
      localAccountService,
      cipherEncryptionService,
      stateProvider as any,
      logService,
    );
  };

  beforeEach(() => {
    jest.resetAllMocks();
    state = {};
    folders = {};
    versions = {};
    localAccountService.isLocalAccount.mockResolvedValue(true);
  });

  it("gives a new cipher a generated id instead of storing it under an empty key", async () => {
    const cipher = new Cipher();
    cipherEncryptionService.encrypt.mockResolvedValue({ cipher } as any);
    cipherEncryptionService.decrypt.mockImplementation(async (encrypted) =>
      Object.assign(new CipherView(), { id: encrypted.id }),
    );
    const writer = createWriter();

    const result = await writer.createCipher(new CipherView(), userId);

    // `CipherView.id` 的初始值是空字符串；用 `??` 会保留它，条目就会存到 "" 下面，
    // SDK 读回来没有 id，列表可以看到但详情永远选不中。
    expect(cipher.id).not.toBe("");
    expect(cipher.id).toHaveLength(36);
    expect(Object.keys(state)).toEqual([cipher.id]);
    expect(result?.id).toBe(cipher.id);
  });

  const login = (password: string) => {
    const view = new CipherView();
    view.type = CipherType.Login;
    view.login = new LoginView();
    view.login.password = password;
    return view;
  };

  it("records the previous login password before saving a changed one", async () => {
    const id = "cipher-id";
    state[id] = { id, creationDate: new Date().toISOString() } as CipherData;
    const writer = createWriter();

    const previous = login("old-password");
    previous.id = id;
    let encryptedView: CipherView | undefined;
    cipherEncryptionService.encrypt.mockImplementation(async (view) => {
      encryptedView = view;
      return { cipher: new Cipher() } as any;
    });
    const saved = login("new-password");
    cipherEncryptionService.decrypt.mockResolvedValueOnce(previous).mockResolvedValueOnce(saved);

    const next = login("new-password");
    next.id = id;
    const result = await writer.updateCipher(next, userId);

    expect(result).toBe(saved);
    expect(encryptedView?.passwordHistory).toHaveLength(1);
    expect(encryptedView?.passwordHistory[0].password).toBe("old-password");
    expect(encryptedView?.login.passwordRevisionDate).toBeInstanceOf(Date);
  });

  it("does not add history when the login password did not change", async () => {
    const id = "cipher-id";
    state[id] = { id, creationDate: new Date().toISOString() } as CipherData;
    const writer = createWriter();

    const previous = login("same-password");
    previous.id = id;
    let encryptedView: CipherView | undefined;
    cipherEncryptionService.encrypt.mockImplementation(async (view) => {
      encryptedView = view;
      return { cipher: new Cipher() } as any;
    });
    cipherEncryptionService.decrypt
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce(login("same-password"));

    const next = login("same-password");
    next.id = id;
    await writer.updateCipher(next, userId);

    expect(encryptedView?.passwordHistory).toEqual([]);
  });

  it("does not append passwordHistory for non-login kinds stored on CipherType.Login", async () => {
    const id = "token-id";
    state[id] = { id, creationDate: new Date().toISOString() } as CipherData;
    const writer = createWriter();

    const previous = login("old-api-token");
    previous.id = id;
    setKind(previous, ItemKind.Token);

    let encryptedView: CipherView | undefined;
    cipherEncryptionService.encrypt.mockImplementation(async (view) => {
      encryptedView = view;
      return { cipher: new Cipher() } as any;
    });
    const saved = login("new-api-token");
    setKind(saved, ItemKind.Token);
    cipherEncryptionService.decrypt.mockResolvedValueOnce(previous).mockResolvedValueOnce(saved);

    const next = login("new-api-token");
    next.id = id;
    setKind(next, ItemKind.Token);
    await writer.updateCipher(next, userId);

    expect(encryptedView?.passwordHistory).toEqual([]);
    expect(encryptedView?.login.passwordRevisionDate).toBeUndefined();
  });

  const card = (number: string) => {
    const view = new CipherView();
    view.type = CipherType.Card;
    view.name = "Card";
    view.card.number = number;
    return view;
  };

  it("stores the previous encrypted revision for a changed item of any kind", async () => {
    const id = "card-id";
    const revisionDate = "2026-01-01T00:00:00.000Z";
    state[id] = {
      id,
      type: CipherType.Card,
      creationDate: revisionDate,
      revisionDate,
      card: { number: "encrypted-old-number" },
    } as CipherData;
    const writer = createWriter();

    const previous = card("4111111111111111");
    previous.id = id;
    const next = card("4222222222222222");
    next.id = id;
    cipherEncryptionService.encrypt.mockResolvedValue({ cipher: new Cipher() } as any);
    cipherEncryptionService.decrypt.mockResolvedValueOnce(previous).mockResolvedValueOnce(next);

    await writer.updateCipher(next, userId);

    expect(versions[id]).toHaveLength(1);
    expect(versions[id][0].revisionDate).toBe(revisionDate);
    expect(versions[id][0].data.card?.number).toBe("encrypted-old-number");
  });

  it("does not grow the version stack when a save changed nothing", async () => {
    const id = "card-id";
    state[id] = {
      id,
      type: CipherType.Card,
      creationDate: "2026-01-01T00:00:00.000Z",
      revisionDate: "2026-01-01T00:00:00.000Z",
    } as CipherData;
    const writer = createWriter();

    const previous = card("4111111111111111");
    previous.id = id;
    const next = card("4111111111111111");
    next.id = id;
    cipherEncryptionService.encrypt.mockResolvedValue({ cipher: new Cipher() } as any);
    cipherEncryptionService.decrypt.mockResolvedValueOnce(previous).mockResolvedValueOnce(next);

    await writer.updateCipher(next, userId);

    expect(versions[id]).toBeUndefined();
  });

  it("keeps only ten versions and drops them when the item is permanently removed", async () => {
    const id = "card-id";
    state[id] = {
      id,
      type: CipherType.Card,
      creationDate: "2026-01-01T00:00:00.000Z",
      revisionDate: "2026-01-11T00:00:00.000Z",
    } as CipherData;
    versions[id] = Array.from({ length: 10 }, (_, index) => ({
      revisionDate: `2026-01-0${index + 1}T00:00:00.000Z`,
      data: new CipherData(),
    }));
    const writer = createWriter();

    const previous = card("4111111111111111");
    previous.id = id;
    const next = card("4222222222222222");
    next.id = id;
    cipherEncryptionService.encrypt.mockResolvedValue({ cipher: new Cipher() } as any);
    cipherEncryptionService.decrypt.mockResolvedValueOnce(previous).mockResolvedValueOnce(next);

    await writer.updateCipher(next, userId);

    expect(versions[id]).toHaveLength(10);
    expect(versions[id][0].revisionDate).toBe("2026-01-11T00:00:00.000Z");
    expect(versions[id].at(-1)?.revisionDate).toBe("2026-01-09T00:00:00.000Z");

    await writer.deleteManyCiphers([id], userId);
    expect(versions[id]).toBeUndefined();
  });

  it("moves a deleted folder's items to no folder", async () => {
    state = {
      kept: Object.assign(new CipherData(), { id: "kept", folderId: "folder-2" }),
      moved: Object.assign(new CipherData(), { id: "moved", folderId: "folder-1" }),
    };
    folders = { "folder-1": new FolderData({ id: "folder-1" }) };
    const writer = createWriter();

    await writer.deleteFolder(["folder-1"], userId);

    expect(folders["folder-1"]).toBeUndefined();
    expect(state["moved"].folderId).toBeUndefined();
    expect(state["kept"].folderId).toBe("folder-2");
  });

  it("keeps only the ten most recent password history entries", async () => {
    const id = "cipher-id";
    state[id] = { id, creationDate: new Date().toISOString() } as CipherData;
    const writer = createWriter();

    const previous = login("oldest-current");
    previous.id = id;
    const existingHistory = Array.from({ length: 10 }, (_, index) => {
      const entry = new PasswordHistoryView();
      entry.password = `history-${index}`;
      entry.lastUsedDate = new Date(2026, 0, index + 1);
      return entry;
    });
    let encryptedView: CipherView | undefined;
    cipherEncryptionService.encrypt.mockImplementation(async (view) => {
      encryptedView = view;
      return { cipher: new Cipher() } as any;
    });
    cipherEncryptionService.decrypt
      .mockResolvedValueOnce(previous)
      .mockResolvedValueOnce(login("new-password"));

    const next = login("new-password");
    next.id = id;
    next.passwordHistory = existingHistory;
    await writer.updateCipher(next, userId);

    expect(encryptedView?.passwordHistory).toHaveLength(10);
    expect(encryptedView?.passwordHistory.map((entry) => entry.password)).toEqual([
      "oldest-current",
      "history-0",
      "history-1",
      "history-2",
      "history-3",
      "history-4",
      "history-5",
      "history-6",
      "history-7",
      "history-8",
    ]);
  });
});
