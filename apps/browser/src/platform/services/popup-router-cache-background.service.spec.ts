import { DeepMockProxy, mock } from "jest-mock-extended";

import { GlobalStateProvider } from "@localpass/common/platform/state";

import { PopupRouterCacheBackgroundService } from "./popup-router-cache-background.service";
import {
  POPUP_ROUTE_HISTORY_KEY,
  RouteHistoryCacheState,
} from "./popup-view-cache-background.service";

type RouteHistory = RouteHistoryCacheState[] | null;

type UpdateOptions<T> = { shouldUpdate?: (state: T) => boolean };

/** Mirrors `StateBase.update`: the reducer only runs when `shouldUpdate` passes. */
function fakeState<T>(initial: T) {
  let current = initial;
  let writes = 0;
  const update = jest.fn(
    async (configure: (state: T) => T, options?: UpdateOptions<T>): Promise<T> => {
      if (options?.shouldUpdate && !options.shouldUpdate(current)) {
        return current;
      }
      current = configure(current);
      writes++;
      return current;
    },
  );
  return {
    update,
    get value() {
      return current;
    },
    get writes() {
      return writes;
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("PopupRouterCacheBackgroundService", () => {
  let historyState: ReturnType<typeof fakeState<RouteHistory>>;
  let tabActivatedListeners: Array<(info: chrome.tabs.TabActiveInfo) => void>;

  const createService = (initialHistory: RouteHistory) => {
    historyState = fakeState<RouteHistory>(initialHistory);
    const globalStateProvider = mock<GlobalStateProvider>() as DeepMockProxy<GlobalStateProvider>;
    globalStateProvider.get.mockImplementation((key) =>
      key === POPUP_ROUTE_HISTORY_KEY ? (historyState as any) : (null as any),
    );

    new PopupRouterCacheBackgroundService(globalStateProvider).init();
  };

  const activateTab = async () => {
    for (const listener of tabActivatedListeners) {
      listener({ tabId: 1, windowId: 1 });
    }
    await flush();
    await flush();
  };

  beforeEach(() => {
    tabActivatedListeners = [];
    (chrome.tabs.onActivated.addListener as jest.Mock).mockImplementation(
      (callback: (info: chrome.tabs.TabActiveInfo) => void) => tabActivatedListeners.push(callback),
    );
    (chrome.tabs.get as jest.Mock).mockImplementation(
      (
        _tabId: number,
        callback?: (tab: chrome.tabs.Tab) => void,
      ): Promise<chrome.tabs.Tab> | void => {
        const tab = { id: 1, url: "https://example.com" } as chrome.tabs.Tab;
        if (callback) {
          callback(tab);
          return;
        }
        return Promise.resolve(tab);
      },
    );
  });

  it("resets the history when the last route asks for a reset on tab change", async () => {
    createService([{ url: "/vault", options: { resetRouterCacheOnTabChange: true } }]);

    await activateTab();

    expect(historyState.value).toEqual([]);
    expect(historyState.writes).toBe(1);
  });

  it("leaves the history untouched when the last route does not ask for a reset", async () => {
    createService([{ url: "/vault" }]);

    await activateTab();

    expect(historyState.value).toEqual([{ url: "/vault" }]);
    expect(historyState.writes).toBe(0);
  });

  it("does not write an empty history", async () => {
    createService([]);

    await activateTab();

    expect(historyState.writes).toBe(0);
  });
});
