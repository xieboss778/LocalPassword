// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { map } from "rxjs";

import { SingleUserState, StateProvider } from "@localpass/common/platform/state";
import { UserId } from "@localpass/common/types/guid";
import { CredentialType } from "@localpass/generator-core";

import { GeneratedCredential } from "./generated-credential";
import { GeneratorHistoryService } from "./generator-history.abstraction";
import { GENERATOR_HISTORY_MEMORY } from "./key-definitions";
import { HistoryServiceOptions } from "./options";

/** Tracks the history of password generations local to an unlock session.
 *  {@link GeneratorHistoryService}
 *
 *  History is intentionally memory-only: values never touch disk and are cleared
 *  automatically when the vault locks or the user logs out.
 */
export class LocalGeneratorHistoryService extends GeneratorHistoryService {
  constructor(
    private readonly stateProvider: StateProvider,
    private readonly options: HistoryServiceOptions = { maxTotal: 20 },
  ) {
    super();
  }

  private _credentialStates = new Map<UserId, SingleUserState<GeneratedCredential[]>>();

  /** {@link GeneratorHistoryService.track} */
  track = async (
    userId: UserId,
    credential: string,
    category: CredentialType,
    date?: Date,
    algorithm?: string,
  ) => {
    const state = this.getCredentialState(userId);
    let result: GeneratedCredential = null;

    await state.update(
      (credentials) => {
        credentials = credentials ?? [];

        // add the result
        result = new GeneratedCredential(credential, category, date ?? Date.now(), algorithm);
        credentials.unshift(result);

        // trim history
        const removeAt = Math.max(0, this.options.maxTotal);
        credentials.splice(removeAt, Infinity);

        return credentials;
      },
      {
        shouldUpdate: (credentials) =>
          !(credentials?.some((f) => f.credential === credential) ?? false),
      },
    );

    return result;
  };

  /** {@link GeneratorHistoryService.take} */
  take = async (userId: UserId, credential: string) => {
    const state = this.getCredentialState(userId);
    let credentialIndex: number;
    let result: GeneratedCredential = null;

    await state.update(
      (credentials) => {
        credentials = credentials ?? [];

        [result] = credentials.splice(credentialIndex, 1);
        return credentials;
      },
      {
        shouldUpdate: (credentials) => {
          credentialIndex = credentials?.findIndex((f) => f.credential === credential) ?? -1;
          return credentialIndex >= 0;
        },
      },
    );

    return result;
  };

  /** {@link GeneratorHistoryService.take} */
  clear = async (userId: UserId) => {
    const state = this.getCredentialState(userId);
    const result = (await state.update(() => null)) ?? [];
    return result;
  };

  /** {@link GeneratorHistoryService.credentials$} */
  credentials$ = (userId: UserId) => {
    return this.getCredentialState(userId).state$.pipe(map((credentials) => credentials ?? []));
  };

  private getCredentialState(userId: UserId) {
    let state = this._credentialStates.get(userId);

    if (!state) {
      state = this.stateProvider.getUser(userId, GENERATOR_HISTORY_MEMORY);
      this._credentialStates.set(userId, state);
    }

    return state;
  }
}
