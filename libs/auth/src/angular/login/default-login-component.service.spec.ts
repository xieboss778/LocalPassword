import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { SsoLoginServiceAbstraction } from "@localpass/common/auth/abstractions/sso-login.service.abstraction";
import { ClientType } from "@localpass/common/enums";
import {
  EnvironmentService,
  Environment,
} from "@localpass/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";
import { Utils } from "@localpass/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@localpass/generator-legacy";
// eslint-disable-next-line no-restricted-imports
import { CryptoFunctionService } from "@localpass/legacy-crypto";

import { DefaultLoginComponentService } from "./default-login-component.service";

jest.mock("@localpass/common/platform/abstractions/environment.service");
jest.mock("@localpass/common/platform/abstractions/platform-utils.service");
jest.mock("@localpass/common/auth/abstractions/sso-login.service.abstraction");
jest.mock("@localpass/generator-legacy");

describe("DefaultLoginComponentService", () => {
  let service: DefaultLoginComponentService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;

  beforeEach(() => {
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    platformUtilsService = mock<PlatformUtilsService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();

    environmentService.environment$ = of({
      getWebVaultUrl: () => "https://webvault.local.invalid",
      getRegion: () => "US",
      getUrls: () => ({}),
      isCloud: () => true,
      getApiUrl: () => "https://api.local.invalid",
    } as Environment);

    service = new DefaultLoginComponentService(
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      ssoLoginService,
    );
  });

  it("creates without error", () => {
    expect(service).toBeTruthy();
  });

  describe("isLoginWithPasskeySupported", () => {
    it("returns true when clientType is Web", () => {
      service["clientType"] = ClientType.Web;
      expect(service.isLoginWithPasskeySupported()).toBe(true);
    });

    it("returns false when clientType is not Web", () => {
      service["clientType"] = ClientType.Desktop;
      expect(service.isLoginWithPasskeySupported()).toBe(false);
    });
  });

  describe("redirectToSsoLogin", () => {
    it("sets the pre-SSO state", async () => {
      const email = "test@local.invalid";
      const state = "testState";
      const codeVerifier = "testCodeVerifier";
      const codeChallenge = "testCodeChallenge";

      passwordGenerationService.generatePassword.mockResolvedValueOnce(state);
      passwordGenerationService.generatePassword.mockResolvedValueOnce(codeVerifier);
      jest.spyOn(Utils, "fromBufferToUrlB64").mockReturnValue(codeChallenge);

      await service.redirectToSsoLogin(email);
      expect(ssoLoginService.setSsoEmail).toHaveBeenCalledWith(email);
      expect(ssoLoginService.setSsoState).toHaveBeenCalledWith(state);
      expect(ssoLoginService.setCodeVerifier).toHaveBeenCalledWith(codeVerifier);
    });
  });
});
