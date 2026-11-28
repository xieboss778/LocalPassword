import { mock } from "jest-mock-extended";
import { firstValueFrom, Observable } from "rxjs";

import { Fido2CredentialView } from "../../../vault/models/view/fido2-credential.view";
import { Fido2ActiveRequestEvents } from "../../abstractions/fido2/fido2-active-request-manager.abstraction";

import { Fido2ActiveRequestManager } from "./fido2-active-request-manager";

// Duplicated from `apps/browser/src/autofill/spec/testing-utils.ts`.
const scheduler = typeof setImmediate === "function" ? setImmediate : setTimeout;
function flushPromises() {
  return new Promise(function (resolve) {
    scheduler(resolve);
  });
}

jest.mock("rxjs", () => {
  const rxjs = jest.requireActual("rxjs");
  const { firstValueFrom } = rxjs;
  return {
    ...rxjs,
    firstValueFrom: jest.fn(firstValueFrom),
  };
});

describe("Fido2ActiveRequestManager", () => {
  const credentialId = "123";
  const tabId = 1;
  let requestManager: Fido2ActiveRequestManager;

  beforeEach(() => {
    requestManager = new Fido2ActiveRequestManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new active request", async () => {
    const fido2CredentialView = mock<Fido2CredentialView>({
      credentialId,
    });
    const credentials = [fido2CredentialView];
    const abortController = new AbortController();
    (firstValueFrom as jest.Mock).mockResolvedValue(credentialId);

    const result = await requestManager.newActiveRequest(tabId, credentials, abortController);
    await flushPromises();

    expect(result).toBe(credentialId);
  });

  it("aborts a pending request when its abort controller is aborted", async () => {
    const abortController = new AbortController();
    (firstValueFrom as jest.Mock).mockImplementation(jest.requireActual("rxjs").firstValueFrom);

    const pending = requestManager.newActiveRequest(tabId, [], abortController);
    await flushPromises();
    abortController.abort();

    await expect(pending).resolves.toEqual({ type: Fido2ActiveRequestEvents.Abort });
  });

  it("rejects a request that starts with an already-aborted controller", async () => {
    const abortController = new AbortController();
    abortController.abort();
    (firstValueFrom as jest.Mock).mockImplementation(jest.requireActual("rxjs").firstValueFrom);

    await expect(requestManager.newActiveRequest(tabId, [], abortController)).rejects.toMatchObject(
      { name: "AbortError" },
    );
  });

  it("gets the observable stream of active requests", async () => {
    (firstValueFrom as jest.Mock).mockResolvedValue(credentialId);
    await requestManager.newActiveRequest(tabId, [], new AbortController());

    const result = requestManager.getActiveRequest$(tabId);

    expect(result).toBeInstanceOf(Observable);

    result.subscribe((activeRequest) => {
      expect(activeRequest).toBeDefined();
    });
  });

  it("returns the active request associated with a given tab id", async () => {
    const fido2CredentialView = mock<Fido2CredentialView>({
      credentialId,
    });
    const credentials = [fido2CredentialView];
    (firstValueFrom as jest.Mock).mockResolvedValue(credentialId);
    await requestManager.newActiveRequest(tabId, credentials, new AbortController());

    const result = requestManager.getActiveRequest(tabId);

    expect(result).toEqual({
      credentials: credentials,
      subject: expect.any(Object),
    });
  });

  it("removes the active request associated with a given tab id", async () => {
    const fido2CredentialView = mock<Fido2CredentialView>({
      credentialId,
    });
    const credentials = [fido2CredentialView];
    (firstValueFrom as jest.Mock).mockResolvedValue(credentialId);
    await requestManager.newActiveRequest(tabId, credentials, new AbortController());

    requestManager.removeActiveRequest(tabId);

    const result = requestManager.getActiveRequest(tabId);

    expect(result).toBeUndefined();
  });
});
