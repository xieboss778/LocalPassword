import { Observable, firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { UserId } from "@localpass/common/types/guid";
import { LOCAL_VAULT_DISK, StateProvider, UserKeyDefinition } from "@localpass/state";

/**
 * Marks a vault as local-only: created on this device, never backed by a LocalPass server.
 *
 * The flag lives in user state, so removing the account removes it. Callers gate the login,
 * sync and billing UI on it instead of trying to detect the sentinel environment URL.
 */
export const IS_LOCAL_ACCOUNT = new UserKeyDefinition<boolean>(LOCAL_VAULT_DISK, "isLocalAccount", {
  deserializer: (value: Jsonify<boolean>) => value as boolean,
  clearOn: ["logout"],
});

export class LocalAccountService {
  constructor(private readonly stateProvider: StateProvider) {}

  /** Emits for the given user; false when the flag was never written. */
  isLocalAccount$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, IS_LOCAL_ACCOUNT)
      .state$.pipe(map((value) => value === true));
  }

  async isLocalAccount(userId: UserId): Promise<boolean> {
    return await firstValueFrom(this.isLocalAccount$(userId));
  }

  async markAsLocalAccount(userId: UserId, isLocal = true): Promise<void> {
    await this.stateProvider.getUser(userId, IS_LOCAL_ACCOUNT).update(() => isLocal);
  }

  /** Used by the "delete local vault" flow before the account record is removed. */
  async clear(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, IS_LOCAL_ACCOUNT).update(() => false);
  }
}
