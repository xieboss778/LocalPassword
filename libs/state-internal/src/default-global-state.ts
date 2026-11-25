import { LogService } from "@localpass/logging";
import { GlobalState, KeyDefinition } from "@localpass/state";
import { AbstractStorageService, ObservableStorageService } from "@localpass/storage-core";

import { StateBase } from "./state-base";
import { globalKeyBuilder } from "./util";

export class DefaultGlobalState<T>
  extends StateBase<T, KeyDefinition<T>>
  implements GlobalState<T>
{
  constructor(
    keyDefinition: KeyDefinition<T>,
    chosenLocation: AbstractStorageService & ObservableStorageService,
    logService: LogService,
  ) {
    super(globalKeyBuilder(keyDefinition), chosenLocation, keyDefinition, logService);
  }
}
