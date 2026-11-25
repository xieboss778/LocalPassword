import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@localpass/common/abstractions/api.service";
import { PolicyService } from "@localpass/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@localpass/common/auth/abstractions/account.service";
import { TokenService } from "@localpass/common/auth/abstractions/token.service";
import { TwoFactorProviderType } from "@localpass/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@localpass/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@localpass/common/auth/models/domain/force-set-password-reason";
import { PasswordTokenRequest } from "@localpass/common/auth/models/request/identity-token/password-token.request";
import { TokenTwoFactorRequest } from "@localpass/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityDeviceVerificationResponse } from "@localpass/common/auth/models/response/identity-device-verification.response";
import { IdentityTwoFactorResponse } from "@localpass/common/auth/models/response/identity-two-factor.response";
import {
  PasswordPreloginData,
  PasswordPreloginService,
} from "@localpass/common/auth/password-prelogin";
import { TwoFactorService } from "@localpass/common/auth/two-factor";
import { BillingAccountProfileStateService } from "@localpass/common/billing/abstractions/account/billing-account-profile-state.service";
import { AccountCryptographicStateService } from "@localpass/common/key-management/account-cryptography/account-cryptographic-state.service";
import { FakeMasterPasswordService } from "@localpass/common/key-management/master-password/services/fake-master-password.service";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@localpass/common/key-management/master-password/types/master-password.types";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@localpass/common/key-management/vault-timeout";
import { AppIdService } from "@localpass/common/platform/abstractions/app-id.service";
import { ConfigService } from "@localpass/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@localpass/common/platform/abstractions/environment.service";
import { LogService } from "@localpass/common/platform/abstractions/log.service";
import { MessagingService } from "@localpass/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { Utils } from "@localpass/common/platform/misc/utils";
import { FakeAccountService, makeEncString, mockAccountServiceWith } from "@localpass/common/spec";
import {
  PasswordStrengthServiceAbstraction,
  PasswordStrengthService,
} from "@localpass/common/tools/password-strength";
import { UserId } from "@localpass/common/types/guid";
import { MasterKey } from "@localpass/common/types/key";
import { KdfConfigService, KeyService } from "@localpass/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, LegacyCompatKeyService, PBKDF2KdfConfig } from "@localpass/legacy-crypto";
import { UnlockService } from "@localpass/unlock";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { PasswordLoginCredentials } from "../models";
import { UserDecryptionOptions } from "../models/domain/user-decryption-options";

import {
  accessToken,
  email,
  encryptedUserKey,
  identityTokenResponseFactory,
  kdfIterations,
  refreshToken,
} from "./login.strategy.spec-util";
import { PasswordLoginStrategy, PasswordLoginStrategyData } from "./password-login.strategy";

const masterPassword = "password";

const deviceId = Utils.newGuid();
const userId = Utils.newGuid() as UserId;
const masterPasswordHash = "MASTER_PASSWORD_HASH";
const name = "NAME";

const decodedToken = {
  sub: userId,
  name: name,
  email: email,
  premium: false,
};

const twoFactorProviderType = TwoFactorProviderType.Authenticator;
const twoFactorToken = "TWO_FACTOR_TOKEN";
const twoFactorRemember = true;

// TODO: add tests for latest changes to base class for TDE
describe("LoginStrategy", () => {
  let cache: PasswordLoginStrategyData;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;
  let unlockService: MockProxy<UnlockService>;

  let passwordPreloginService: MockProxy<PasswordPreloginService>;
  let keyService: MockProxy<KeyService>;
  let legacyCompatKeyService: MockProxy<LegacyCompatKeyService>;
  let encryptService: MockProxy<EncryptService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let policyService: MockProxy<PolicyService>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let environmentService: MockProxy<EnvironmentService>;
  let configService: MockProxy<ConfigService>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;

  let passwordLoginStrategy: PasswordLoginStrategy;
  let credentials: PasswordLoginCredentials;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();
    unlockService = mock<UnlockService>();

    passwordPreloginService = mock<PasswordPreloginService>();
    keyService = mock<KeyService>();
    legacyCompatKeyService = mock<LegacyCompatKeyService>();
    encryptService = mock<EncryptService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    twoFactorService = mock<TwoFactorService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    kdfConfigService = mock<KdfConfigService>();
    policyService = mock<PolicyService>();
    passwordStrengthService = mock<PasswordStrengthService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    environmentService = mock<EnvironmentService>();
    configService = mock<ConfigService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();

    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.calledWith(accessToken).mockResolvedValue(decodedToken);

    passwordPreloginService.getPreloginData$.mockReturnValue(
      of(
        new PasswordPreloginData(
          PBKDF2KdfConfig.createDefault(),
          "prelogin-salt" as MasterPasswordSalt,
        ),
      ),
    );
    legacyCompatKeyService.makeMasterKey.mockResolvedValue({} as any);

    // The base class is abstract so we test it via PasswordLoginStrategy
    passwordLoginStrategy = new PasswordLoginStrategy(
      cache,
      passwordStrengthService,
      policyService,
      passwordPreloginService,
      unlockService,
      legacyCompatKeyService,
      accountService as unknown as AccountService,
      masterPasswordService,
      keyService,
      encryptService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      twoFactorService,
      userDecryptionOptionsService,
      billingAccountProfileStateService,
      vaultTimeoutSettingsService,
      kdfConfigService,
      environmentService,
      configService,
      accountCryptographicStateService,
    );
    credentials = new PasswordLoginCredentials(email, masterPassword);
  });

  describe("base class", () => {
    beforeEach(() => {
      const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
      const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
        mockVaultTimeoutAction,
      );
      vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
        mockVaultTimeoutActionBSub.asObservable(),
      );

      const mockVaultTimeout = 1000;

      const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
      vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
        mockVaultTimeoutBSub.asObservable(),
      );
    });

    it("sets the local environment after a successful login with master password", async () => {
      const idTokenResponse = identityTokenResponseFactory();
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

      const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
      const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
        mockVaultTimeoutAction,
      );
      vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
        mockVaultTimeoutActionBSub.asObservable(),
      );

      const mockVaultTimeout = 1000;

      const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
      vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
        mockVaultTimeoutBSub.asObservable(),
      );

      await passwordLoginStrategy.logIn(credentials);

      expect(tokenService.setTokens).toHaveBeenCalledWith(
        accessToken,
        mockVaultTimeoutAction,
        mockVaultTimeout,
        refreshToken,
      );

      expect(environmentService.seedUserEnvironment).toHaveBeenCalled();

      expect(userDecryptionOptionsService.setUserDecryptionOptionsById).toHaveBeenCalledWith(
        userId,
        UserDecryptionOptions.fromIdentityTokenResponse(idTokenResponse),
      );
      expect(masterPasswordService.mock.setMasterPasswordUnlockData).toHaveBeenCalledWith(
        new MasterPasswordUnlockData(
          email as MasterPasswordSalt,
          new PBKDF2KdfConfig(kdfIterations),
          encryptedUserKey as MasterKeyWrappedUserKey,
        ),
        userId,
      );
      expect(messagingService.send).toHaveBeenCalledWith("loggedIn");
    });

    it("throws if new account isn't active after being initialized", async () => {
      const idTokenResponse = identityTokenResponseFactory();
      apiService.postIdentityToken.mockResolvedValue(idTokenResponse);

      const mockVaultTimeoutAction = VaultTimeoutAction.Lock;

      const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
        mockVaultTimeoutAction,
      );
      vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
        mockVaultTimeoutActionBSub.asObservable(),
      );

      const mockVaultTimeout = 1000;

      const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
      vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
        mockVaultTimeoutBSub.asObservable(),
      );

      accountService.switchAccount = jest.fn(); // block internal switch to new account
      accountService.activeAccountSubject.next(null); // simulate no active account

      await expect(async () => await passwordLoginStrategy.logIn(credentials)).rejects.toThrow();
    });

    it("builds AuthResult", async () => {
      const tokenResponse = identityTokenResponseFactory();
      tokenResponse.forcePasswordReset = true;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      const expected = new AuthResult();
      expected.masterPassword = "password";
      expected.userId = userId;
      expect(result).toEqual(expected);
    });

    it("processes a forcePasswordReset response properly", async () => {
      const tokenResponse = identityTokenResponseFactory();
      tokenResponse.forcePasswordReset = true;

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      const expected = new AuthResult();
      expected.masterPassword = "password";
      expected.userId = userId;
      expect(result).toEqual(expected);

      expect(masterPasswordService.mock.setForceSetPasswordReason).toHaveBeenCalledWith(
        ForceSetPasswordReason.AdminForcePasswordReset,
        userId,
      );
    });

    it("sets account cryptographic state when accountKeysResponseModel is present", async () => {
      const accountKeysData = {
        publicKeyEncryptionKeyPair: {
          publicKey: "testPublicKey",
          wrappedPrivateKey: "testPrivateKey",
        },
      };

      const tokenResponse = identityTokenResponseFactory();
      tokenResponse.key = makeEncString("mockEncryptedUserKey");
      // Add accountKeysResponseModel to the response
      (tokenResponse as any).accountKeysResponseModel = {
        publicKeyEncryptionKeyPair: accountKeysData.publicKeyEncryptionKeyPair,
        toWrappedAccountCryptographicState: jest.fn().mockReturnValue({
          V1: {
            private_key: "testPrivateKey",
          },
        }),
      };

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      await passwordLoginStrategy.logIn(credentials);

      expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledTimes(
        1,
      );
      expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
        {
          V1: {
            private_key: "testPrivateKey",
          },
        },
        userId,
      );
    });
  });

  describe("Two-factor authentication", () => {
    beforeEach(() => {
      const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
      const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
        mockVaultTimeoutAction,
      );
      vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
        mockVaultTimeoutActionBSub.asObservable(),
      );

      const mockVaultTimeout = 1000;
      const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
      vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
        mockVaultTimeoutBSub.asObservable(),
      );
    });

    it("rejects login if 2FA is required", async () => {
      // Sample response where TOTP 2FA required
      const tokenResponse = new IdentityTwoFactorResponse({
        TwoFactorProviders: ["0"],
        TwoFactorProviders2: { 0: null },
        error: "invalid_grant",
        error_description: "Two factor required.",
        // only sent for emailed 2FA
        email: undefined,
        ssoEmail2faSessionToken: undefined,
      });

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(environmentService.seedUserEnvironment).not.toHaveBeenCalled();
      expect(accountService.mock.switchAccount).not.toHaveBeenCalled();
      expect(messagingService.send).not.toHaveBeenCalled();
      expect(tokenService.clearTwoFactorToken).toHaveBeenCalled();

      const expected = new AuthResult();
      expected.twoFactorProviders = { 0: null } as unknown as Partial<
        Record<TwoFactorProviderType, Record<string, string>>
      >;
      expected.email = "";
      expected.ssoEmail2FaSessionToken = undefined;
      expect(result).toEqual(expected);
    });

    it("rejects login if 2FA via email is required + maps required information", async () => {
      // Sample response where Email 2FA required

      const userEmail = "kyle@local.invalid";
      const ssoEmail2FaSessionToken =
        "BwSsoEmail2FaSessionToken_CfDJ8AMrVzKqBFpKqzzsahUx8ubIi9AhHm6aLHDLpCUYc3QV3qC14iuSVkNg57Q7-kGQUn1z87bGY1WP58jFMNJ6ndaurIgQWNfPNN4DG-dBhvzarOAZ0RKY5oKT5futWm6_k9NMMGd8PcGGHg5Pq1_koOIwRtiXO3IpD-bemB7m8oEvbj__JTQP3Mcz-UediFlCbYBKU3wyIiBL_tF8hW5D4RAUa5ZzXIuauJiiCdDS7QOzBcqcusVAPGFfKjfIdAwFfKSOYd5KmYrhK7Y7ymjweP_igPYKB5aMfcVaYr5ux-fdffeJTGqtJorwNjLUYNv7KA";

      const tokenResponse = new IdentityTwoFactorResponse({
        TwoFactorProviders: ["1"],
        TwoFactorProviders2: { "1": { Email: "k***@local.invalid" } },
        error: "invalid_grant",
        error_description: "Two factor required.",
        // only sent for emailed 2FA
        email: userEmail,
        ssoEmail2faSessionToken: ssoEmail2FaSessionToken,
      });

      apiService.postIdentityToken.mockResolvedValue(tokenResponse);

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(environmentService.seedUserEnvironment).not.toHaveBeenCalled();
      expect(messagingService.send).not.toHaveBeenCalled();

      const expected = new AuthResult();
      expected.twoFactorProviders = {
        [TwoFactorProviderType.Email]: { Email: "k***@local.invalid" },
      };
      expected.email = userEmail;
      expected.ssoEmail2FaSessionToken = ssoEmail2FaSessionToken;

      expect(result).toEqual(expected);
    });

    it("sends stored 2FA token to server", async () => {
      tokenService.getTwoFactorToken.mockResolvedValue(twoFactorToken);
      apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());

      await passwordLoginStrategy.logIn(credentials);

      expect(apiService.postIdentityToken).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactor: {
            provider: TwoFactorProviderType.Remember,
            token: twoFactorToken,
            remember: false,
          } as TokenTwoFactorRequest,
        }),
      );
    });

    it("sends 2FA token provided by user to server (single step)", async () => {
      // This occurs if the user enters the 2FA code as an argument in the CLI
      apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());
      credentials.twoFactor = new TokenTwoFactorRequest(
        twoFactorProviderType,
        twoFactorToken,
        twoFactorRemember,
      );

      await passwordLoginStrategy.logIn(credentials);

      expect(apiService.postIdentityToken).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactor: {
            provider: twoFactorProviderType,
            token: twoFactorToken,
            remember: twoFactorRemember,
          } as TokenTwoFactorRequest,
        }),
      );
    });

    it("sends 2FA token provided by user to server (two-step)", async () => {
      // Simulate a partially completed login
      cache = new PasswordLoginStrategyData({
        tokenRequest: new PasswordTokenRequest(
          email,
          masterPasswordHash,
          new TokenTwoFactorRequest(),
        ),
        userEnteredEmail: email,
        masterKey: {} as MasterKey,
        masterPassword,
        forcePasswordResetReason: ForceSetPasswordReason.None,
      });

      passwordLoginStrategy = new PasswordLoginStrategy(
        cache,
        passwordStrengthService,
        policyService,
        passwordPreloginService,
        unlockService,
        legacyCompatKeyService,
        accountService as AccountService,
        masterPasswordService,
        keyService,
        encryptService,
        apiService,
        tokenService,
        appIdService,
        platformUtilsService,
        messagingService,
        logService,
        twoFactorService,
        userDecryptionOptionsService,
        billingAccountProfileStateService,
        vaultTimeoutSettingsService,
        kdfConfigService,
        environmentService,
        configService,
        accountCryptographicStateService,
      );

      apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());

      await passwordLoginStrategy.logInTwoFactor(
        new TokenTwoFactorRequest(twoFactorProviderType, twoFactorToken, twoFactorRemember),
      );

      expect(apiService.postIdentityToken).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactor: {
            provider: twoFactorProviderType,
            token: twoFactorToken,
            remember: twoFactorRemember,
          } as TokenTwoFactorRequest,
        }),
      );
    });
  });

  describe("Device verification", () => {
    it("processes device verification response", async () => {
      const deviceVerificationResponse = new IdentityDeviceVerificationResponse({
        error: "invalid_grant",
        error_description: "Device verification required.",
        email: "test@local.invalid",
        deviceVerificationRequest: true,
      });

      apiService.postIdentityToken.mockResolvedValue(deviceVerificationResponse);

      cache = new PasswordLoginStrategyData({
        tokenRequest: new PasswordTokenRequest(
          email,
          masterPasswordHash,
          new TokenTwoFactorRequest(),
        ),
        userEnteredEmail: email,
        masterKey: {} as MasterKey,
        masterPassword,
        forcePasswordResetReason: ForceSetPasswordReason.None,
      });

      passwordLoginStrategy = new PasswordLoginStrategy(
        cache,
        passwordStrengthService,
        policyService,
        passwordPreloginService,
        unlockService,
        legacyCompatKeyService,
        accountService as AccountService,
        masterPasswordService,
        keyService,
        encryptService,
        apiService,
        tokenService,
        appIdService,
        platformUtilsService,
        messagingService,
        logService,
        twoFactorService,
        userDecryptionOptionsService,
        billingAccountProfileStateService,
        vaultTimeoutSettingsService,
        kdfConfigService,
        environmentService,
        configService,
        accountCryptographicStateService,
      );

      const result = await passwordLoginStrategy.logIn(credentials);

      expect(result.requiresDeviceVerification).toBe(true);
    });
  });

  describe("given no login in progress", () => {
    it("rejects a two-factor attempt without sending a token request", async () => {
      passwordLoginStrategy = new PasswordLoginStrategy(
        undefined,
        passwordStrengthService,
        policyService,
        passwordPreloginService,
        unlockService,
        legacyCompatKeyService,
        accountService as AccountService,
        masterPasswordService,
        keyService,
        encryptService,
        apiService,
        tokenService,
        appIdService,
        platformUtilsService,
        messagingService,
        logService,
        twoFactorService,
        userDecryptionOptionsService,
        billingAccountProfileStateService,
        vaultTimeoutSettingsService,
        kdfConfigService,
        environmentService,
        configService,
        accountCryptographicStateService,
      );

      await expect(
        passwordLoginStrategy.logInTwoFactor(
          new TokenTwoFactorRequest(TwoFactorProviderType.Authenticator, "TOKEN", false),
        ),
      ).rejects.toThrow("No login is in progress.");

      expect(apiService.postIdentityToken).not.toHaveBeenCalled();
    });
  });
});
