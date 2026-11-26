import { firstValueFrom } from "rxjs";

import {
  InternalUserDecryptionOptionsServiceAbstraction,
  UserDecryptionOptions,
} from "@localpass/auth/common";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { TokenService } from "@localpass/common/auth/abstractions/token.service";
import { BillingAccountProfileStateService } from "@localpass/common/billing/abstractions/account/billing-account-profile-state.service";
import { AccountCryptographicStateService } from "@localpass/common/key-management/account-cryptography/account-cryptographic-state.service";
import { KeyConnectorService } from "@localpass/common/key-management/key-connector/abstractions/key-connector.service";
import { InternalMasterPasswordServiceAbstraction } from "@localpass/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@localpass/common/key-management/master-password/types/master-password.types";
import { VaultTimeoutSettingsService } from "@localpass/common/key-management/vault-timeout";
import { EnvironmentService } from "@localpass/common/platform/abstractions/environment.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { UserId } from "@localpass/common/types/guid";
import { newGuid } from "@localpass/guid";
import { KdfConfigService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  DEFAULT_KDF_CONFIG,
  EncString,
  EncryptService,
  KdfConfig,
  LegacyCompatKeyService,
} from "@localpass/legacy-crypto";
import type { WrappedAccountCryptographicState } from "@localpass/sdk-internal";
import { UnlockService } from "@localpass/unlock";

import { encryptedStringOf } from "./encrypted-string";
import { buildLocalAccessToken } from "./local-access-token";
import { LocalAccountService } from "./local-account.service";
import {
  DEFAULT_LOCAL_ACCOUNT_NAME,
  LOCAL_VAULT_REGION,
  LOCAL_VAULT_URLS,
} from "./local-vault-environment";

/** Everything needed to create a vault that lives only on this device. */
export type CreateLocalAccountRequest = {
  /** The identifier shown in the account switcher; also the KDF salt. */
  readonly email: string;
  /** Optional display name, defaults to the local part of the email. */
  readonly name?: string;
  /** The password that protects the vault. Never leaves the device. */
  readonly masterPassword: string;
  /** Defaults to PBKDF2-SHA256 with 600,000 iterations, the same as a new server account. */
  readonly kdfConfig?: KdfConfig;
};

/** Material read back from `account.json` in cloud storage. */
export type RestoreLocalAccountRequest = {
  readonly email: string;
  readonly name?: string;
  readonly masterPassword: string;
  readonly unlock: {
    readonly salt: string;
    readonly kdf: KdfConfig;
    readonly masterKeyWrappedUserKey: string;
  };
  readonly wrappedPrivateKey: string;
};

/**
 * Creates a vault that has no server behind it.
 *
 * A local account reuses the state a successful password login would have written, in the same
 * order as `LoginStrategy.saveAccountInformation`. Everything downstream — locking, unlocking,
 * PIN, auto-fill, the SDK's cipher decryption — therefore works untouched, and nothing in the
 * client needs to know that the account never came from a server.
 */
export class CreateLocalAccountService {
  constructor(
    private readonly accountService: AccountService,
    private readonly environmentService: EnvironmentService,
    private readonly tokenService: TokenService,
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private readonly billingAccountProfileStateService: BillingAccountProfileStateService,
    private readonly vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private readonly kdfConfigService: KdfConfigService,
    private readonly accountCryptographicStateService: AccountCryptographicStateService,
    private readonly unlockService: UnlockService,
    private readonly legacyCompatKeyService: LegacyCompatKeyService,
    private readonly localAccountService: LocalAccountService,
    private readonly keyConnectorService: KeyConnectorService,
    private readonly encryptService: EncryptService,
    private readonly logService: LogService,
  ) {}

  /**
   * Writes a complete local account and unlocks it.
   *
   * @returns The id of the created account.
   * @throws If the email or the master password is empty.
   */
  async createAccount(request: CreateLocalAccountRequest): Promise<UserId> {
    const email = request.email?.trim().toLowerCase();
    const masterPassword = request.masterPassword;

    if (!email) {
      throw new Error("An email is required to create a local vault.");
    }
    if (!masterPassword) {
      throw new Error("A master password is required to create a local vault.");
    }

    const name = request.name?.trim() || email.split("@")[0] || DEFAULT_LOCAL_ACCOUNT_NAME;
    const kdfConfig = request.kdfConfig ?? DEFAULT_KDF_CONFIG;
    const salt = this.masterPasswordService.emailToSalt(email);

    // Keys first: nothing is written until the whole key chain is known to be derivable.
    const masterKey = await this.legacyCompatKeyService.makeMasterKey(
      masterPassword,
      salt,
      kdfConfig,
    );
    const [userKey, masterKeyWrappedUserKey] =
      await this.legacyCompatKeyService.makeUserKey(masterKey);
    const [, wrappedPrivateKey] = await this.legacyCompatKeyService.makeKeyPair(userKey);

    const userId = newGuid() as UserId;

    return await this.writeAccount(
      userId,
      {
        name,
        email,
        salt,
        kdfConfig,
        wrappedUserKey: encryptedStringOf(masterKeyWrappedUserKey),
        wrappedPrivateKey: encryptedStringOf(wrappedPrivateKey),
      },
      masterPassword,
    );
  }

  /**
   * Re-creates a local account from the material stored in `account.json`, so a second device can
   * open the same vault. The user key is unwrapped here purely to prove the master password is the
   * right one; the state then holds the same wrapped values the first device pushed.
   *
   * @throws If the password does not open the wrapped user key.
   */
  async restoreAccount(request: RestoreLocalAccountRequest): Promise<UserId> {
    const email = request.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("An email is required to restore a local vault.");
    }
    if (!request.masterPassword) {
      throw new Error("A master password is required to restore a local vault.");
    }

    const masterKey = await this.legacyCompatKeyService.makeMasterKey(
      request.masterPassword,
      request.unlock.salt as MasterPasswordSalt,
      request.unlock.kdf,
    );

    // Throws when the password is wrong; this is the same proof a server login would do.
    await this.encryptService.unwrapSymmetricKey(
      new EncString(request.unlock.masterKeyWrappedUserKey),
      masterKey,
    );

    const name = request.name?.trim() || email.split("@")[0] || DEFAULT_LOCAL_ACCOUNT_NAME;

    return await this.writeAccount(
      newGuid() as UserId,
      {
        name,
        email,
        salt: request.unlock.salt as MasterPasswordSalt,
        kdfConfig: request.unlock.kdf,
        wrappedUserKey: request.unlock.masterKeyWrappedUserKey,
        wrappedPrivateKey: request.wrappedPrivateKey,
      },
      request.masterPassword,
    );
  }

  /** Writes the state a successful login would have written, then unlocks. */
  private async writeAccount(
    userId: UserId,
    account: {
      name: string;
      email: string;
      salt: MasterPasswordSalt;
      kdfConfig: KdfConfig;
      wrappedUserKey: string;
      wrappedPrivateKey: string;
    },
    masterPassword: string,
  ): Promise<UserId> {
    // The environment has to be in place before the account is seeded from it, otherwise the
    // account would inherit a cloud region.
    // 上游的 setEnvironment 会原地改写传入的 urls（formatUrl 赋值回 base 等字段），
    // 直接把 freeze 过的常量交进去会报 “Cannot assign to read only property 'base'”。
    // 常量保持冻结，每次交一份可写副本。
    await this.environmentService.setEnvironment(LOCAL_VAULT_REGION, { ...LOCAL_VAULT_URLS });
    await this.accountService.addAccount(userId, {
      name: account.name,
      email: account.email,
      emailVerified: true,
      creationDate: new Date(),
    });
    await this.environmentService.seedUserEnvironment(userId);
    await this.accountService.switchAccount(userId);

    // Decryption options decide whether the client offers a master password unlock at all; without
    // `hasMasterPassword` the next lock would become a logout.
    const decryptionOptions = new UserDecryptionOptions();
    decryptionOptions.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptionsById(userId, decryptionOptions);

    // SDK 只接受 EncString 的序列化字符串；把对象传进去会报
    // “Failed to deserialize JsValue ... expected a valid string”。先归一再检查，
    // 不让一个空值话到 SDK 里变成难懂的错误。
    const wrappedUserKey = encryptedStringOf(account.wrappedUserKey);
    if (wrappedUserKey === "") {
      throw new Error("Local vault: the wrapped user key is missing.");
    }

    await this.masterPasswordService.setMasterPasswordUnlockData(
      new MasterPasswordUnlockData(
        account.salt,
        account.kdfConfig,
        wrappedUserKey as unknown as MasterKeyWrappedUserKey,
      ),
      userId,
    );

    const vaultTimeoutAction = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(userId),
    );
    const vaultTimeout = await firstValueFrom(
      this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(userId),
    );

    await this.tokenService.setTokens(
      buildLocalAccessToken({ userId, email: account.email, name: account.name }),
      vaultTimeoutAction,
      vaultTimeout,
    );

    await this.kdfConfigService.setKdfConfig(userId, account.kdfConfig);

    // Every paid feature — TOTP, attachments, security keys — is unlocked by this.
    await this.billingAccountProfileStateService.setHasPremium(true, false, userId);

    // V1 account: the private key is wrapped with the user key, exactly like a server account.
    await this.accountCryptographicStateService.setAccountCryptographicState(
      {
        V1: { private_key: account.wrappedPrivateKey },
      } as unknown as WrappedAccountCryptographicState,
      userId,
    );

    await this.localAccountService.markAsLocalAccount(userId, true);

    // 服务器账号在首次同步时写入这个状态；本地账号永远不同步，而
    // `KeyConnectorService.convertAccountRequired$` 会一直等到它不为 null 才发射。
    // 不写的话，`authGuard` 里的 firstValueFrom 永远不返回，建库后导航会卡死。
    await this.keyConnectorService.setUsesKeyConnector(false, userId);

    await this.unlockService.unlockWithMasterPassword(userId, masterPassword);

    this.logService.info("Opened local vault", { userId });
    return userId;
  }
}
