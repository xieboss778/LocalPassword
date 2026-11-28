/// SDK/WASM code relies on TextEncoder/TextDecoder being available globally
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextDecoder, TextEncoder });

// Polyfill Symbol.dispose for explicit resource management (used by SDK client)
if (!(Symbol as any).dispose) {
  (Symbol as any).dispose = Symbol("Symbol.dispose");
}

import { firstValueFrom } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { Algorithm, Type } from "@localpass/generator-core";

import { FakeStateProvider, awaitAsync, mockAccountServiceWith } from "../../../../../common/spec";

import { GENERATOR_HISTORY_MEMORY } from "./key-definitions";
import { LocalGeneratorHistoryService } from "./local-generator-history.service";

const SomeUser = "SomeUser" as UserId;
const AnotherUser = "AnotherUser" as UserId;

describe("LocalGeneratorHistoryService", () => {
  describe("credential$", () => {
    it("returns an empty list when no credentials are stored", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      const result = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toEqual([]);
    });
  });

  describe("track", () => {
    it("stores a password", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toMatchObject({ credential: "example", category: Type.password });
    });

    it("writes to the in-memory state instead of the encrypted disk store", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();

      const memoryState = stateProvider.singleUser.getFake(SomeUser, GENERATOR_HISTORY_MEMORY);
      expect(memoryState.keyDefinition.stateDefinition.defaultStorageLocation).toBe("memory");
      expect(await firstValueFrom(memoryState.state$)).toHaveLength(1);
      expect(stateProvider.singleUser.states.size).toBe(1);
      expect(GENERATOR_HISTORY_MEMORY.clearOn).toEqual(expect.arrayContaining(["lock", "logout"]));
    });

    it("keeps only the 20 most recent credentials by default", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      for (let i = 0; i < 21; i++) {
        await history.track(SomeUser, `example-${i}`, Type.password);
      }
      await awaitAsync();
      const result = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toHaveLength(20);
      expect(result[0].credential).toBe("example-20");
      expect(result.at(-1)?.credential).toBe("example-1");
    });

    it("stores a passphrase", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toMatchObject({ credential: "example", category: Type.password });
    });

    it("stores the algorithm when provided", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      await history.track(SomeUser, "example", Type.password, undefined, Algorithm.passphrase);
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toMatchObject({
        credential: "example",
        category: Type.password,
        algorithm: Algorithm.passphrase,
      });
    });

    it("stores a specific date when one is provided", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      await history.track(SomeUser, "example", Type.password, new Date(100));
      await awaitAsync();
      const [result] = await firstValueFrom(history.credentials$(SomeUser));

      expect(result).toEqual({
        credential: "example",
        category: Type.password,
        generationDate: new Date(100),
      });
    });

    it("skips storing a credential when it's already stored (ignores category)", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      await history.track(SomeUser, "example", Type.password);
      await history.track(SomeUser, "example", Type.password);
      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "example", category: Type.password });
      expect(secondResult).toBeUndefined();
    });

    it("stores multiple credentials when the credential value is different", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      await history.track(SomeUser, "secondResult", Type.password);
      await history.track(SomeUser, "firstResult", Type.password);
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "firstResult", category: Type.password });
      expect(secondResult).toMatchObject({ credential: "secondResult", category: Type.password });
    });

    it("removes history items exceeding maxTotal configuration", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider, { maxTotal: 1 });

      await history.track(SomeUser, "removed result", Type.password);
      await history.track(SomeUser, "example", Type.password);
      await awaitAsync();
      const [firstResult, secondResult] = await firstValueFrom(history.credentials$(SomeUser));

      expect(firstResult).toMatchObject({ credential: "example", category: Type.password });
      expect(secondResult).toBeUndefined();
    });

    it("stores history items in per-user collections", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider, { maxTotal: 1 });

      await history.track(SomeUser, "some user example", Type.password);
      await history.track(AnotherUser, "another user example", Type.password);
      await awaitAsync();
      const [someFirstResult, someSecondResult] = await firstValueFrom(
        history.credentials$(SomeUser),
      );
      const [anotherFirstResult, anotherSecondResult] = await firstValueFrom(
        history.credentials$(AnotherUser),
      );

      expect(someFirstResult).toMatchObject({
        credential: "some user example",
        category: Type.password,
      });
      expect(someSecondResult).toBeUndefined();
      expect(anotherFirstResult).toMatchObject({
        credential: "another user example",
        category: Type.password,
      });
      expect(anotherSecondResult).toBeUndefined();
    });
  });

  describe("take", () => {
    it("returns null when there are no credentials stored", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);

      const result = await history.take(SomeUser, "example");

      expect(result).toBeNull();
    });

    it("returns null when the credential wasn't found", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);
      await history.track(SomeUser, "example", Type.password);

      const result = await history.take(SomeUser, "not found");

      expect(result).toBeNull();
    });

    it("returns a matching credential", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);
      await history.track(SomeUser, "example", Type.password);

      const result = await history.take(SomeUser, "example");

      expect(result).toMatchObject({
        credential: "example",
        category: Type.password,
      });
    });

    it("removes a matching credential", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);
      await history.track(SomeUser, "example", Type.password);

      await history.take(SomeUser, "example");
      await awaitAsync();
      const results = await firstValueFrom(history.credentials$(SomeUser));

      expect(results).toEqual([]);
    });
  });

  describe("clear", () => {
    it("removes all credentials for a user", async () => {
      const stateProvider = new FakeStateProvider(mockAccountServiceWith(SomeUser));
      const history = new LocalGeneratorHistoryService(stateProvider);
      await history.track(SomeUser, "example", Type.password);

      await history.clear(SomeUser);
      await awaitAsync();
      const remaining = await firstValueFrom(history.credentials$(SomeUser));

      expect(remaining).toEqual([]);
    });
  });
});
