import { firstValueFrom } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { UserId } from "../../types/guid";

import { DefaultSharedUnlockSettingsService } from "./default-shared-unlock-settings.service";

describe("DefaultSharedUnlockSettingsService", () => {
  const userId = "userId" as UserId;

  let accountService: FakeAccountService;
  let service: DefaultSharedUnlockSettingsService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    service = new DefaultSharedUnlockSettingsService(new FakeStateProvider(accountService));
  });

  it("shares unlock state with the desktop by default", async () => {
    await expect(firstValueFrom(service.allowSharingUnlockStateWithDesktop$(userId))).resolves.toBe(
      true,
    );
  });

  it("keeps an explicit opt-out", async () => {
    await service.setAllowSharingUnlockStateWithDesktop(false, userId);

    await expect(firstValueFrom(service.allowSharingUnlockStateWithDesktop$(userId))).resolves.toBe(
      false,
    );
  });
});
