import { DeepMockProxy, mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { Message, MessageListener } from "@localpass/common/platform/messaging";
import { TaskSchedulerService } from "@localpass/common/platform/scheduling";
import { GlobalStateProvider } from "@localpass/common/platform/state";

import {
  ClEAR_VIEW_CACHE_COMMAND,
  PopupViewCacheBackgroundService,
  RouteHistoryCacheState,
  SAVE_VIEW_CACHE_COMMAND,
  ViewCacheState,
} from "./popup-view-cache-background.service";

type ViewCache = Record<string, ViewCacheState> | null;

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

describe("PopupViewCacheBackgroundService", () => {
  let messages$: Subject<Message<Record<string, unknown>>>;
  let messageListener: MessageListener;
  let globalStateProvider: DeepMockProxy<GlobalStateProvider>;
  let viewState: ReturnType<typeof fakeState<ViewCache>>;
  let routeState: ReturnType<typeof fakeState<RouteHistoryCacheState[] | null>>;
  let tabActivatedListeners: Array<(info: chrome.tabs.TabActiveInfo) => void>;

  const createService = (initialViewState: ViewCache) => {
    viewState = fakeState<ViewCache>(initialViewState);
    routeState = fakeState<RouteHistoryCacheState[] | null>([]);
    globalStateProvider = mock<GlobalStateProvider>();
    globalStateProvider.get
      .mockReturnValueOnce(viewState as any)
      .mockReturnValueOnce(routeState as any);

    messageListener = new MessageListener(messages$.asObservable());
    const service = new PopupViewCacheBackgroundService(
      messageListener,
      globalStateProvider,
      mock<TaskSchedulerService>(),
    );
    service.startObservingMessages();
    return service;
  };

  const save = (key: string, value: string, options: ViewCacheState["options"] = {}) =>
    messages$.next({ command: SAVE_VIEW_CACHE_COMMAND.command, key, value, options });

  const clear = (routeChange: boolean) =>
    messages$.next({ command: ClEAR_VIEW_CACHE_COMMAND.command, routeChange });

  beforeEach(() => {
    messages$ = new Subject<Message<Record<string, unknown>>>();
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

  describe("save-view-cache", () => {
    it("writes a new snapshot", async () => {
      createService({});

      save("key", '{"a":1}');
      await flush();

      expect(viewState.value).toEqual({ key: { value: '{"a":1}', options: {} } });
      expect(viewState.writes).toBe(1);
    });

    it("skips the write when the snapshot is unchanged", async () => {
      createService({});

      save("key", '{"a":1}');
      await flush();
      save("key", '{"a":1}');
      await flush();

      expect(viewState.writes).toBe(1);
    });

    it("writes again when the snapshot changes", async () => {
      createService({});

      save("key", '{"a":1}');
      await flush();
      save("key", '{"a":2}');
      await flush();

      expect(viewState.value).toEqual({ key: { value: '{"a":2}', options: {} } });
      expect(viewState.writes).toBe(2);
    });
  });

  describe("clear-view-cache", () => {
    it("drops non-persistent keys on a route change", async () => {
      createService({
        keep: { value: "1", options: { persistNavigation: true } },
        drop: { value: "2" },
      });

      clear(true);
      await flush();

      expect(viewState.value).toEqual({
        keep: { value: "1", options: { persistNavigation: true } },
      });
      expect(viewState.writes).toBe(1);
    });

    it("does not write when a route change leaves only persistent keys", async () => {
      createService({ keep: { value: "1", options: { persistNavigation: true } } });

      clear(true);
      await flush();

      expect(viewState.writes).toBe(0);
    });

    it("clears everything when not triggered by a route change", async () => {
      createService({ keep: { value: "1", options: { persistNavigation: true } } });

      clear(false);
      await flush();

      expect(viewState.value).toBeNull();
      expect(viewState.writes).toBe(1);
    });
  });

  describe("tab change", () => {
    const activateTab = async () => {
      for (const listener of tabActivatedListeners) {
        listener({ tabId: 1, windowId: 1 });
      }
      await flush();
      await flush();
    };

    it("drops keys marked clearOnTabChange", async () => {
      createService({
        keep: { value: "1" },
        drop: { value: "2", options: { clearOnTabChange: true } },
      });

      await activateTab();

      expect(viewState.value).toEqual({ keep: { value: "1" } });
      expect(viewState.writes).toBe(1);
    });

    it("does not write when no key is marked clearOnTabChange", async () => {
      createService({ keep: { value: "1" } });

      await activateTab();

      expect(viewState.writes).toBe(0);
    });
  });
});
