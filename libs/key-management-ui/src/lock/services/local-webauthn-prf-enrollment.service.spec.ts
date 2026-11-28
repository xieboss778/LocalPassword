import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { WebAuthnLoginPrfKeyServiceAbstraction } from "@localpass/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { RotateableKeySetService } from "@localpass/common/key-management/keys/services/abstractions/rotateable-key-set.service";
import { WEBAUTHN_PRF_OPTIONS } from "@localpass/common/key-management/state-definitions";
import { UserId } from "@localpass/common/types/guid";
import { KeyService } from "@localpass/key-management";
import { LogService } from "@localpass/logging";
import type { WebAuthnPrfUnlockData, WebAuthnPrfUnlockOption } from "@localpass/sdk-internal";
import { StateProvider } from "@localpass/state";

import { LocalWebAuthnPrfEnrollmentService } from "./local-webauthn-prf-enrollment.service";

describe("LocalWebAuthnPrfEnrollmentService", () => {
  let service: LocalWebAuthnPrfEnrollmentService;
  let stateProvider: MockProxy<StateProvider>;

  const userId = "synthetic-user-id" as UserId;
  const credentialIdA = "synthetic-credential-id-a";
  const credentialIdB = "synthetic-credential-id-b";

  // Synthetic strings only: the service must pass stored options through untouched.
  const optionA = {
    credentialId: credentialIdA,
    encryptedPrivateKey: "synthetic-private-key-a",
    encryptedUserKey: "synthetic-user-key-a",
    transports: ["usb"],
  } as unknown as WebAuthnPrfUnlockOption;
  const optionB = {
    credentialId: credentialIdB,
    encryptedPrivateKey: "synthetic-private-key-b",
    encryptedUserKey: "synthetic-user-key-b",
    transports: ["internal"],
  } as unknown as WebAuthnPrfUnlockOption;

  const storedOptions = (
    options: WebAuthnPrfUnlockOption[] | null,
  ): WebAuthnPrfUnlockData | null => (options == null ? null : { options });

  beforeEach(() => {
    stateProvider = mock<StateProvider>();

    service = new LocalWebAuthnPrfEnrollmentService(
      mock<WebAuthnLoginPrfKeyServiceAbstraction>(),
      mock<RotateableKeySetService>(),
      mock<KeyService>(),
      stateProvider,
      mock<LogService>(),
      {} as Window,
    );
  });

  describe("list", () => {
    it("returns the stored options as a fresh array", async () => {
      const options = [optionA, optionB];
      stateProvider.getUserState$.mockReturnValue(of(storedOptions(options)));

      const result = await service.list(userId);

      expect(result).toEqual([optionA, optionB]);
      expect(result).not.toBe(options);
      expect(stateProvider.getUserState$).toHaveBeenCalledWith(WEBAUTHN_PRF_OPTIONS, userId);
    });

    it("returns an empty array when nothing is registered", async () => {
      stateProvider.getUserState$.mockReturnValue(of(null));

      await expect(service.list(userId)).resolves.toEqual([]);
    });
  });

  describe("removeOne", () => {
    it("persists only the remaining options for the same state and user", async () => {
      const options = [optionA, optionB];
      stateProvider.getUserState$.mockReturnValue(of(storedOptions(options)));

      await service.removeOne(userId, credentialIdA);

      expect(stateProvider.setUserState).toHaveBeenCalledTimes(1);
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        WEBAUTHN_PRF_OPTIONS,
        { options: [optionB] },
        userId,
      );
      expect(options).toEqual([optionA, optionB]);
    });

    it("persists an unchanged copy when the credential id is unknown", async () => {
      const options = [optionA, optionB];
      stateProvider.getUserState$.mockReturnValue(of(storedOptions(options)));

      await service.removeOne(userId, "synthetic-unknown-credential-id");

      const persisted = stateProvider.setUserState.mock.calls[0][1] as WebAuthnPrfUnlockData;
      expect(persisted.options).toEqual([optionA, optionB]);
      expect(persisted.options).not.toBe(options);
      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        WEBAUTHN_PRF_OPTIONS,
        { options: [optionA, optionB] },
        userId,
      );
    });
  });

  describe("count", () => {
    it("reflects the number of listed options", async () => {
      stateProvider.getUserState$.mockReturnValue(of(storedOptions([optionA, optionB])));

      await expect(service.count(userId)).resolves.toBe(2);
    });

    it("is zero when nothing is registered", async () => {
      stateProvider.getUserState$.mockReturnValue(of(null));

      await expect(service.count(userId)).resolves.toBe(0);
    });
  });

  describe("removeAll", () => {
    it("persists an empty option list", async () => {
      await service.removeAll(userId);

      expect(stateProvider.setUserState).toHaveBeenCalledWith(
        WEBAUTHN_PRF_OPTIONS,
        { options: [] },
        userId,
      );
    });
  });
});
