import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";
import { CipherEncryptionService } from "@localpass/common/vault/abstractions/cipher-encryption.service";
import { CipherData } from "@localpass/common/vault/models/data/cipher.data";
import { Cipher } from "@localpass/common/vault/models/domain/cipher";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";

import { LocalAccountService } from "../account/local-account.service";

import { DefaultLocalVaultWriter } from "./local-vault-writer.service";

describe("DefaultLocalVaultWriter", () => {
  const userId = "user-id" as UserId;
  const localAccountService = mock<LocalAccountService>();
  const cipherEncryptionService = mock<CipherEncryptionService>();
  const logService = mock<LogService>();

  let state: Record<string, CipherData>;
  let update: jest.Mock;

  const createWriter = () => {
    update = jest.fn(
      async (
        updater: (current: Record<string, CipherData> | null) => Record<string, CipherData>,
      ) => {
        state = updater(state);
      },
    );
    const stateProvider = {
      getUser: () => ({ state$: of(state), update }),
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
});
