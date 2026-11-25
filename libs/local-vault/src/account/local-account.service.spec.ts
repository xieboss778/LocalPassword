import { BehaviorSubject } from "rxjs";

import { UserId } from "@localpass/common/types/guid";
import { StateProvider } from "@localpass/state";

import { IS_LOCAL_ACCOUNT, LocalAccountService } from "./local-account.service";

const userId = "11111111-1111-1111-1111-111111111111" as UserId;

function serviceWith(value: boolean | null) {
  const subject = new BehaviorSubject<boolean | null>(value);
  const update = jest.fn(async (fn: (existing: boolean | null) => boolean) => {
    subject.next(fn(subject.value));
  });
  const provider = {
    getUser: jest.fn(() => ({ state$: subject, update })),
  } as unknown as StateProvider;
  return { service: new LocalAccountService(provider), subject, update, provider };
}

describe("LocalAccountService", () => {
  it("treats a missing flag as not local", async () => {
    const { service } = serviceWith(null);
    await expect(service.isLocalAccount(userId)).resolves.toBe(false);
  });

  it("reads the stored flag", async () => {
    const { service } = serviceWith(true);
    await expect(service.isLocalAccount(userId)).resolves.toBe(true);
  });

  it("writes the flag through the key definition", async () => {
    const { service, update, provider } = serviceWith(null);
    await service.markAsLocalAccount(userId);

    expect(provider.getUser).toHaveBeenCalledWith(userId, IS_LOCAL_ACCOUNT);
    expect(update).toHaveBeenCalledTimes(1);
    await expect(service.isLocalAccount(userId)).resolves.toBe(true);
  });

  it("clears the flag", async () => {
    const { service } = serviceWith(true);
    await service.clear(userId);
    await expect(service.isLocalAccount(userId)).resolves.toBe(false);
  });
});
