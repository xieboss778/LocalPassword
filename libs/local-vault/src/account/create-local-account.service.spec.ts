import { of } from "rxjs";

import { UserDecryptionOptions } from "@localpass/auth/common";
import { VaultTimeoutAction } from "@localpass/common/key-management/vault-timeout";
import { Utils } from "@localpass/common/platform/misc/utils";
// eslint-disable-next-line no-restricted-imports
import { DEFAULT_KDF_CONFIG } from "@localpass/legacy-crypto";

import { CreateLocalAccountService } from "./create-local-account.service";
import { LocalAccountService } from "./local-account.service";
import { LOCAL_VAULT_REGION, LOCAL_VAULT_URLS } from "./local-vault-environment";

const fakeWrappedUserKey = "wrapped-user-key" as any;
const fakeWrappedPrivateKey = "wrapped-private-key" as any;

function decodeTokenPayload(token: string): Record<string, any> {
  const parts = token.split(".");
  expect(parts).toHaveLength(3);
  return JSON.parse(Utils.fromUrlB64ToUtf8(parts[1]));
}

function createService() {
  const addAccount = jest.fn().mockResolvedValue(undefined);
  const switchAccount = jest.fn().mockResolvedValue(undefined);
  const setEnvironment = jest.fn().mockResolvedValue(LOCAL_VAULT_URLS);
  const seedUserEnvironment = jest.fn().mockResolvedValue(undefined);
  const setTokens = jest.fn().mockResolvedValue(undefined);
  const setMasterPasswordUnlockData = jest.fn().mockResolvedValue(undefined);
  const setUserDecryptionOptions = jest.fn().mockResolvedValue(undefined);
  const setHasPremium = jest.fn().mockResolvedValue(undefined);
  const setKdfConfig = jest.fn().mockResolvedValue(undefined);
  const setAccountCryptographicState = jest.fn().mockResolvedValue(undefined);
  const unlockWithMasterPassword = jest.fn().mockResolvedValue(undefined);
  const markAsLocalAccount = jest.fn().mockResolvedValue(undefined);
  const info = jest.fn();

  const makeMasterKey = jest.fn().mockResolvedValue("master-key");
  // 真实的 makeUserKey / makeKeyPair 返回 EncString 对象而不是纯字符串；
  // fake 也必须这样，否则测试会把「把对象当字符串传给 SDK」这类 bug 盖住。
  const makeUserKey = jest
    .fn()
    .mockResolvedValue(["user-key", { encryptedString: fakeWrappedUserKey }]);
  const makeKeyPair = jest
    .fn()
    .mockResolvedValue(["public-key", { encryptedString: fakeWrappedPrivateKey }]);

  const service = new CreateLocalAccountService(
    { addAccount, switchAccount } as any,
    { setEnvironment, seedUserEnvironment } as any,
    { setTokens } as any,
    { emailToSalt: (email: string) => email, setMasterPasswordUnlockData } as any,
    { setUserDecryptionOptionsById: setUserDecryptionOptions } as any,
    { setHasPremium } as any,
    {
      getVaultTimeoutActionByUserId$: () => of(VaultTimeoutAction.Lock),
      getVaultTimeoutByUserId$: () => of(30),
    } as any,
    { setKdfConfig } as any,
    { setAccountCryptographicState } as any,
    { unlockWithMasterPassword } as any,
    { makeMasterKey, makeUserKey, makeKeyPair } as any,
    { markAsLocalAccount } as unknown as LocalAccountService,
    { unwrapSymmetricKey: jest.fn() } as any,
    { info } as any,
  );

  return {
    service,
    mocks: {
      addAccount,
      switchAccount,
      setEnvironment,
      seedUserEnvironment,
      setTokens,
      setMasterPasswordUnlockData,
      setUserDecryptionOptions,
      setHasPremium,
      setKdfConfig,
      setAccountCryptographicState,
      unlockWithMasterPassword,
      markAsLocalAccount,
      makeMasterKey,
      makeUserKey,
      makeKeyPair,
    },
  };
}

describe("CreateLocalAccountService", () => {
  it("把可写的 urls 副本交给环境服务（上游会原地改写它）", async () => {
    const { service, mocks } = createService();

    await service.createAccount({ email: "owner@example.com", masterPassword: "pw" });

    const urls = mocks.setEnvironment.mock.calls[0][1] as Record<string, string>;
    // 上游 setEnvironment 会执行 urls.base = formatUrl(urls.base)；freeze 过的对象在这里会抛错。
    expect(() => {
      urls.base = String(urls.base);
    }).not.toThrow();
    expect(urls).not.toBe(LOCAL_VAULT_URLS);
    expect(urls).toEqual(LOCAL_VAULT_URLS);
  });

  it("writes a complete unlocked account", async () => {
    const { service, mocks } = createService();

    const userId = await service.createAccount({
      email: "  Owner@Example.COM ",
      masterPassword: "correct horse battery staple",
    });

    expect(userId).toEqual(expect.any(String));
    expect(mocks.addAccount).toHaveBeenCalledWith(userId, {
      name: "owner",
      email: "owner@example.com",
      emailVerified: true,
      creationDate: expect.any(Date),
    });
    expect(mocks.setEnvironment).toHaveBeenCalledWith(LOCAL_VAULT_REGION, LOCAL_VAULT_URLS);
    expect(mocks.seedUserEnvironment).toHaveBeenCalledWith(userId);
    expect(mocks.switchAccount).toHaveBeenCalledWith(userId);

    const decryptionOptionsCall = mocks.setUserDecryptionOptions.mock.calls[0];
    const decryptionOptions = decryptionOptionsCall[1] as UserDecryptionOptions;
    expect(decryptionOptions.hasMasterPassword).toBe(true);

    const unlockData = mocks.setMasterPasswordUnlockData.mock.calls[0][0];
    expect(unlockData.salt).toBe("owner@example.com");
    expect(unlockData.kdf).toEqual(DEFAULT_KDF_CONFIG);
    expect(unlockData.masterKeyWrappedUserKey).toBe(fakeWrappedUserKey);
    // SDK 侧只接受字符串；把 EncString 对象传进去会报
    // "Failed to deserialize JsValue ... expected a valid string"。
    expect(typeof unlockData.masterKeyWrappedUserKey).toBe("string");

    expect(mocks.setTokens).toHaveBeenCalledWith(expect.any(String), VaultTimeoutAction.Lock, 30);
    expect(mocks.setKdfConfig).toHaveBeenCalledWith(userId, DEFAULT_KDF_CONFIG);
    expect(mocks.setHasPremium).toHaveBeenCalledWith(true, false, userId);
    expect(mocks.setAccountCryptographicState).toHaveBeenCalledWith(
      { V1: { private_key: fakeWrappedPrivateKey } },
      userId,
    );
    expect(mocks.markAsLocalAccount).toHaveBeenCalledWith(userId, true);
    expect(mocks.unlockWithMasterPassword).toHaveBeenCalledWith(
      userId,
      "correct horse battery staple",
    );
  });

  it("keeps the master password out of the access token", async () => {
    const { service, mocks } = createService();

    const userId = await service.createAccount({
      email: "owner@example.com",
      masterPassword: "correct horse battery staple",
    });

    const token = mocks.setTokens.mock.calls[0][0] as string;
    const payload = decodeTokenPayload(token);

    expect(payload.sub).toBe(userId);
    expect(payload.premium).toBe(true);
    expect(token).not.toContain("correct horse");
  });

  it("derives the keys before writing any state", async () => {
    const { service, mocks } = createService();

    await service.createAccount({ email: "owner@example.com", masterPassword: "pw" });

    expect(mocks.makeMasterKey.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.addAccount.mock.invocationCallOrder[0],
    );
    expect(mocks.makeKeyPair.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setAccountCryptographicState.mock.invocationCallOrder[0],
    );
    expect(mocks.setEnvironment.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.seedUserEnvironment.mock.invocationCallOrder[0],
    );
  });

  it("rejects an empty email", async () => {
    const { service, mocks } = createService();

    await expect(service.createAccount({ email: "  ", masterPassword: "pw" })).rejects.toThrow();
    expect(mocks.addAccount).not.toHaveBeenCalled();
  });

  it("rejects an empty master password", async () => {
    const { service, mocks } = createService();

    await expect(
      service.createAccount({ email: "owner@example.com", masterPassword: "" }),
    ).rejects.toThrow();
    expect(mocks.addAccount).not.toHaveBeenCalled();
  });
});
