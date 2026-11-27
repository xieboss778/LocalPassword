import { Observable, map } from "rxjs";

import {
  GlobalState,
  EXTENSION_INITIAL_INSTALL_DISK,
  KeyDefinition,
  StateProvider,
} from "@localpass/common/platform/state";

const EXTENSION_INSTALLED = new KeyDefinition<boolean>(
  EXTENSION_INITIAL_INSTALL_DISK,
  "extensionInstalled",
  {
    deserializer: (obj) => obj,
  },
);

/**
 * Tracks whether the extension has already applied its first-install defaults, so a repeated
 * install event in the same profile does not reset them.
 */
export default class BrowserInitialInstallService {
  private extensionInstalled: GlobalState<boolean> =
    this.stateProvider.getGlobal(EXTENSION_INSTALLED);

  readonly extensionInstalled$: Observable<boolean> = this.extensionInstalled.state$.pipe(
    map((x) => x ?? false),
  );

  constructor(private stateProvider: StateProvider) {}

  async setExtensionInstalled(value: boolean) {
    await this.extensionInstalled.update(() => value);
  }
}
