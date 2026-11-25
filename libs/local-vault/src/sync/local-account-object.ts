import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  AccountCryptographicStateService,
} from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import {
  InternalMasterPasswordServiceAbstraction,
} from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * The material another device needs to open this vault: the KDF settings, the master-key-wrapped
 * user key and the user-key-wrapped private key. It is written to `account.json` beside the
 * snapshots and is as sensitive as the vault itself — the whole file is encrypted material.
 */
export interface LocalAccountObject {
  readonly version: 1;
  readonly email: string;
  readonly updatedAt: string;
  readonly unlock: {
    /** Email-derived salt, stored so the restore path does not have to re-derive it. */
    readonly salt: string;
    readonly kdf: unknown;
    readonly masterKeyWrappedUserKey: string;
  };
  /** V1 account: the RSA private key, wrapped with the user key. */
  readonly wrappedPrivateKey: string;
}

/** Builds `account.json` from the state a logged-in local account already holds. */
export class LocalAccountObjectReader {
  constructor(
    private readonly accountService: AccountService,
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly accountCryptographicStateService: AccountCryptographicStateService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async read(userId: UserId): Promise<LocalAccountObject | null> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    const email = accounts?.[userId]?.email;
    if (email == null) {
      return null;
    }

    const unlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );
    if (unlockData == null) {
      return null;
    }

    const cryptoState = await firstValueFrom(
      this.accountCryptographicStateService.accountCryptographicState$(userId),
    );
    const wrappedPrivateKey = privateKeyOf(cryptoState);
    if (wrappedPrivateKey == null) {
      return null;
    }

    return {
      version: 1,
      email,
      updatedAt: this.clock().toISOString(),
      unlock: {
        salt: unlockData.salt,
        kdf: JSON.parse(JSON.stringify(unlockData.kdf)),
        masterKeyWrappedUserKey: unlockData.masterKeyWrappedUserKey as unknown as string,
      },
      wrappedPrivateKey,
    };
  }
}

/** The V1 private key, either already a string or an `EncString`-shaped object. */
function privateKeyOf(state: unknown): string | null {
  const v1 = (state as { V1?: { private_key?: unknown } } | null)?.V1;
  const key = v1?.private_key;
  if (key == null) {
    return null;
  }
  if (typeof key === "string") {
    return key;
  }
  const encryptedString = (key as { encryptedString?: string }).encryptedString;
  return encryptedString ?? null;
}
