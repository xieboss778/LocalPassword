import { mock } from "jest-mock-extended";
import { render } from "lit";

import { ThemeTypes } from "@localpass/common/platform/enums";

import { NotificationCipherData } from "../content/components/cipher/types";
import {
  ChangeNotificationNewEntryTarget,
  NotificationChangeContainer,
} from "../content/components/notification/change/container";
import { postWindowMessage } from "../spec/testing-utils";

import { NotificationBarWindowMessage } from "./abstractions/notification-bar";
import {
  getChangeNotificationCiphers,
  getChangeNotificationExistingEntryCount,
  getI18n,
  hasChangeNotificationCipherIds,
  initNotificationBar,
} from "./bar";

jest.mock("lit", () => ({ render: jest.fn() }));
jest.mock("@lit-labs/signals", () => ({
  signal: jest.fn((testValue) => ({ get: (): typeof testValue => testValue })),
}));
jest.mock("../content/components/notification/container", () => ({
  NotificationContainer: jest.fn(),
}));
jest.mock("../content/components/notification/change/container", () => ({
  ...jest.requireActual("../content/components/notification/change/container"),
  NotificationChangeContainer: jest.fn(),
}));

describe("NotificationBar iframe handleWindowMessage security", () => {
  const trustedOrigin = "http://localhost";
  const maliciousOrigin = "https://malicious.com";

  const createMessage = (
    overrides: Partial<NotificationBarWindowMessage> = {},
  ): NotificationBarWindowMessage => ({
    command: "initNotificationBar",
    ...overrides,
  });

  beforeEach(() => {
    Object.defineProperty(globalThis, "location", {
      value: { search: `?parentOrigin=${encodeURIComponent(trustedOrigin)}` },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "parent", {
      value: mock<Window>(),
      writable: true,
      configurable: true,
    });
    globalThis.dispatchEvent(new Event("load"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    {
      description: "not from parent window",
      message: () => createMessage(),
      origin: trustedOrigin,
      source: () => mock<Window>(),
    },
    {
      description: "with mismatched origin",
      message: () => createMessage(),
      origin: maliciousOrigin,
      source: () => globalThis.parent,
    },
    {
      description: "without command field",
      message: () => ({}),
      origin: trustedOrigin,
      source: () => globalThis.parent,
    },
    {
      description: "initNotificationBar with mismatched parentOrigin",
      message: () => createMessage({ parentOrigin: maliciousOrigin }),
      origin: trustedOrigin,
      source: () => globalThis.parent,
    },
    {
      description: "when windowMessageOrigin is not set",
      message: () => createMessage(),
      origin: "different-origin",
      source: () => globalThis.parent,
      resetOrigin: true,
    },
    {
      description: "with null source",
      message: () => createMessage(),
      origin: trustedOrigin,
      source: (): null => null,
    },
    {
      description: "with unknown command",
      message: () => createMessage({ command: "unknownCommand" }),
      origin: trustedOrigin,
      source: () => globalThis.parent,
    },
  ])("should reject messages $description", ({ message, origin, source, resetOrigin }) => {
    if (resetOrigin) {
      Object.defineProperty(globalThis, "location", {
        value: { search: "" },
        writable: true,
        configurable: true,
      });
    }
    const spy = jest.spyOn(globalThis.parent, "postMessage").mockImplementation();
    postWindowMessage(message(), origin, source());
    expect(spy).not.toHaveBeenCalled();
  });

  it("should accept and handle valid trusted messages", () => {
    const spy = jest.spyOn(globalThis.parent, "postMessage").mockImplementation();
    spy.mockClear();

    const validMessage = createMessage({
      parentOrigin: trustedOrigin,
      initData: {
        type: "change",
        isVaultLocked: false,
        removeIndividualVault: false,
        importType: null,
        launchTimestamp: Date.now(),
      },
    });
    postWindowMessage(validMessage, trustedOrigin, globalThis.parent);
    expect(validMessage.command).toBe("initNotificationBar");
    expect(validMessage.parentOrigin).toBe(trustedOrigin);
    expect(validMessage.initData).toBeDefined();
  });
});

describe("getChangeNotificationCiphers", () => {
  const alex = mock<NotificationCipherData>({ id: "cipher-alex", name: "Northwind Alex" });
  const ops = mock<NotificationCipherData>({ id: "cipher-ops", name: "Northwind Ops" });

  it("keeps only the queued candidates, in queue order", () => {
    expect(getChangeNotificationCiphers([alex, ops], ["cipher-ops"])).toEqual([ops]);
    expect(getChangeNotificationCiphers([alex, ops], ["cipher-ops", "cipher-alex"])).toEqual([
      ops,
      alex,
    ]);
  });

  it("drops queued ids that the URL cipher list no longer contains", () => {
    expect(getChangeNotificationCiphers([alex, ops], ["cipher-ops", "deleted"])).toEqual([ops]);
  });
});

describe("getChangeNotificationExistingEntryCount", () => {
  it("reads a whole, non-negative entry count from the queued params", () => {
    expect(getChangeNotificationExistingEntryCount({ existingEntryCount: 3 })).toBe(3);
  });

  it("ignores missing, malformed, or negative counts", () => {
    expect(getChangeNotificationExistingEntryCount(undefined)).toBeUndefined();
    expect(getChangeNotificationExistingEntryCount({})).toBeUndefined();
    expect(getChangeNotificationExistingEntryCount({ existingEntryCount: "3" })).toBeUndefined();
    expect(getChangeNotificationExistingEntryCount({ existingEntryCount: -1 })).toBeUndefined();
    expect(
      getChangeNotificationExistingEntryCount({ existingEntryCount: Number.NaN }),
    ).toBeUndefined();
  });
});

describe("hasChangeNotificationCipherIds", () => {
  it("accepts an empty candidate list as a supplied list", () => {
    expect(hasChangeNotificationCipherIds({ cipherIds: [] })).toBe(true);
  });

  it("accepts a populated candidate list", () => {
    expect(hasChangeNotificationCipherIds({ cipherIds: ["cipher-ops"] })).toBe(true);
  });

  it("rejects params without an array of cipher ids", () => {
    expect(hasChangeNotificationCipherIds(undefined)).toBe(false);
    expect(hasChangeNotificationCipherIds({})).toBe(false);
    expect(hasChangeNotificationCipherIds({ cipherIds: "cipher-ops" })).toBe(false);
  });
});

describe("change notification with an empty candidate list", () => {
  afterEach(() => {
    jest.mocked(render).mockClear();
    jest.mocked(NotificationChangeContainer).mockClear();
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
  });

  it("renders the change picker with the new-entry target selected", async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      (message: { command: string }, callback: (response: unknown) => void) => {
        const responses: Record<string, unknown> = {
          bgGetOrgData: [],
          bgGetFolderData: [],
          bgGetDecryptedCiphers: [],
          bgGetCollectionData: [],
        };
        callback(responses[message.command]);
      },
    );

    await initNotificationBar({
      command: "initNotificationBar",
      initData: {
        type: "change",
        isVaultLocked: false,
        removeIndividualVault: false,
        theme: ThemeTypes.Light,
        params: { cipherIds: [], existingEntryCount: 3, domain: "northwind.io" },
      },
    });

    expect(NotificationChangeContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        ciphers: [],
        domain: "northwind.io",
        existingEntryCount: 3,
        expanded: false,
        selectedTarget: ChangeNotificationNewEntryTarget,
      }),
    );
  });
});

describe("getI18n", () => {
  it("localizes the change card's switch and ignore actions", () => {
    (chrome.i18n.getMessage as jest.Mock).mockImplementation((key: string) => `msg:${key}`);

    const i18n = getI18n();

    expect(i18n.notificationChangeToggle).toEqual("msg:notificationChangeToggle");
    expect(i18n.notificationChangeIgnore).toEqual("msg:notificationChangeIgnore");

    (chrome.i18n.getMessage as jest.Mock).mockReset();
  });
});
