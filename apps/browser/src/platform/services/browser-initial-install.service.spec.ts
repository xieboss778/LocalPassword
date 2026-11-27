import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { GlobalState, StateProvider } from "@localpass/common/platform/state";

import BrowserInitialInstallService from "./browser-initial-install.service";

function createService(stored: boolean | null): {
  service: BrowserInitialInstallService;
  globalState: MockProxy<GlobalState<boolean>>;
} {
  const stateProvider = mock<StateProvider>();
  const globalState = mock<GlobalState<boolean>>();
  Object.defineProperty(globalState, "state$", { value: of(stored) });
  stateProvider.getGlobal.mockReturnValue(globalState);

  return { service: new BrowserInitialInstallService(stateProvider), globalState };
}

describe("BrowserInitialInstallService", () => {
  it("reports false while no install has been recorded", async () => {
    const { service } = createService(null);

    await expect(firstValueFrom(service.extensionInstalled$)).resolves.toBe(false);
  });

  it("reports a recorded install", async () => {
    const { service } = createService(true);

    await expect(firstValueFrom(service.extensionInstalled$)).resolves.toBe(true);
  });

  it("records a completed install", async () => {
    const { service, globalState } = createService(null);

    await service.setExtensionInstalled(true);

    expect(globalState.update).toHaveBeenCalledTimes(1);
    const updater = globalState.update.mock.calls[0][0];
    expect(updater(false)).toBe(true);
  });
});
