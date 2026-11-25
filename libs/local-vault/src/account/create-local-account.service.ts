import { firstValueFrom } from "rxjs";

import {
  InternalUserDecryptionOptionsServiceAbstraction,
  UserDecryptionOptions,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { KdfConfigService } from "@bitwarden/key-management";
import { DEFAULT_KDF_CONFIG, KdfConfig, LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import type { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";

import { LocalAccountService } from "./local-account.service";
import { buildLocalAccessToken } from "./local-access-token";
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

    // The environment has to be in place before the account is seeded from it, otherwise the
    // account would inherit a cloud region.
    await this.environmentService.setEnvironment(LOCAL_VAULT_REGION, LOCAL_VAULT_URLS);
    await this.accountService.addAccount(userId, {
      name,
      email,
      emailVerified: true,
      creationDate: new Date().toISOString(),
    });
    await this.environmentService.seedUserEnvironment(userId);
    await this.accountService.switchAccount(userId);

    // Decryption options decide whether the client offers a master password unlock at all; without
    // `hasMasterPassword` the next lock would become a logout.
    const decryptionOptions = new UserDecryptionOptions();
    decryptionOptions.hasMasterPassword = true;
    await this.userDecryptionOptionsService.setUserDecryptionOptionsById(userId, decryptionOptions);

    await this.masterPasswordService.setMasterPasswordUnlockData(
      new MasterPasswordUnlockData(
        salt,
        kdfConfig,
        masterKeyWrappedUserKey as MasterKeyWrappedUserKey,
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
      buildLocalAccessToken({ userId, email, name }),
      vaultTimeoutAction,
      vaultTimeout,
    );

    await this.kdfConfigService.setKdfConfig(userId, kdfConfig);

    // Every paid feature — TOTP, attachments, security keys — is unlocked by this.
    await this.billingAccountProfileStateService.setHasPremium(true, false, userId);

    // V1 account: the private key is wrapped with the user key, exactly like a server account.
    await this.accountCryptographicStateService.setAccountCryptographicState(
      {
        V1: { private_key: wrappedPrivateKey },
      } as unknown as WrappedAccountCryptographicState,
      userId,
    );

    await this.localAccountService.markAsLocalAccount(userId, true);

    await this.unlockService.unlockWithMasterPassword(userId, masterPassword);

    this.logService.info("Created local vault", { userId });
    return userId;
  }
}
