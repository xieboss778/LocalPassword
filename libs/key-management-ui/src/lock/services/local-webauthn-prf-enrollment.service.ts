import { firstValueFrom } from "rxjs";

import { WebAuthnLoginPrfKeyServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login-prf-key.service.abstraction";
import { RotateableKeySetService } from "@bitwarden/common/key-management/keys/services/abstractions/rotateable-key-set.service";
import { WEBAUTHN_PRF_OPTIONS } from "@bitwarden/common/key-management/state-definitions";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import type { WebAuthnPrfUnlockOption } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

/**
 * Registers a security key (or a passkey) as an unlock method for a local vault.
 *
 * The client can only ask the browser for a PRF result, so the enrollment builds the WebAuthn
 * options itself: RP ID is the page's own host (the extension id in the extension), and the PRF
 * salt is the same constant the unlock path uses, which is what makes the two sides agree.
 */
export class LocalWebAuthnPrfEnrollmentService {
  constructor(
    private readonly prfKeyService: WebAuthnLoginPrfKeyServiceAbstraction,
    private readonly rotateableKeySetService: RotateableKeySetService,
    private readonly keyService: KeyService,
    private readonly stateProvider: StateProvider,
    private readonly logService: LogService,
    private readonly window: Window = globalThis.window,
  ) {}

  /** True when the current page can create a credential with a PRF extension. */
  isSupported(): boolean {
    const credentials = this.window?.navigator?.credentials;
    return credentials != null && typeof credentials.create === "function";
  }

  /**
   * Creates a credential, derives the PRF key from it and stores the resulting unlock option.
   *
   * @throws If the vault is locked, the user cancels the browser prompt, or the key returns no PRF
   *   output (a key without the PRF extension cannot unlock a vault).
   */
  async enroll(userId: UserId, accountName: string, displayName: string): Promise<void> {
    if (!this.isSupported()) {
      throw new Error("This browser cannot register a security key for unlocking.");
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("Unlock the vault before registering a security key.");
    }

    const salt = await this.prfKeyService.getLoginWithPrfSalt();
    const rpId = this.window.location.hostname;
    const challenge = randomChallenge();

    const credential = (await this.window.navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { id: rpId, name: "LocalPassword" },
        user: {
          id: new TextEncoder().encode(userId),
          name: accountName,
          displayName: displayName || accountName,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
        extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;

    if (credential == null) {
      throw new Error("The security key was not created.");
    }

    const prfKey = await this.prfKeyService.createSymmetricKeyFromPrf(prfOutputOf(credential));
    const keySet = await this.rotateableKeySetService.createKeySet(prfKey, userKey);

    const option = {
      credentialId: Utils.fromArrayToUrlB64(new Uint8Array(credential.rawId)),
      // The downstream key (the user key) travels wrapped by the credential's public key.
      encryptedUserKey: keySet.encapsulatedDownstreamKey.encryptedString,
      encryptedPrivateKey: keySet.encryptedPrivateKey?.encryptedString ?? "",
      transports: transportsOf(credential),
    } as unknown as WebAuthnPrfUnlockOption;

    const existing = await firstValueFrom(
      this.stateProvider.getUserState$(WEBAUTHN_PRF_OPTIONS, userId),
    );
    const options = [...(existing?.options ?? []), option];
    await this.stateProvider.setUserState(WEBAUTHN_PRF_OPTIONS, { options }, userId);

    this.logService.info("Registered a security key for unlock", { userId });
  }

  /** How many security keys are registered for the user. */
  async count(userId: UserId): Promise<number> {
    const existing = await firstValueFrom(
      this.stateProvider.getUserState$(WEBAUTHN_PRF_OPTIONS, userId),
    );
    return existing?.options?.length ?? 0;
  }

  /** Removes every registered security key, e.g. when the user loses one. */
  async removeAll(userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(WEBAUTHN_PRF_OPTIONS, { options: [] }, userId);
  }
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  const challenge = new Uint8Array(32);
  globalThis.crypto.getRandomValues(challenge);
  return challenge;
}

function prfOutputOf(credential: PublicKeyCredential): ArrayBuffer {
  const extensions = credential.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer | null } };
  };
  const output = extensions.prf?.results?.first;
  if (output == null) {
    throw new Error("This security key does not support the PRF extension.");
  }
  return output;
}

function transportsOf(credential: PublicKeyCredential): string[] {
  const response = credential.response as AuthenticatorAttestationResponse;
  return typeof response.getTransports === "function" ? response.getTransports() : [];
}
