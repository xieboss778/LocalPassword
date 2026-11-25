import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account } from "@localpass/common/auth/abstractions/account.service";
import { Utils } from "@localpass/common/platform/misc/utils";
import { UserId } from "@localpass/common/types/guid";
import { GeneratedCredential } from "@localpass/generator-core";
import { GeneratorHistoryService } from "@localpass/generator-history";

import { trackGeneratedCredential } from "./credential-history-utils";

describe("trackGeneratedCredential", () => {
  const mockUserId = Utils.newGuid() as UserId;
  const mockAccount: Account = {
    id: mockUserId,
    email: "test@local.invalid",
    emailVerified: true,
    name: undefined,
    creationDate: undefined,
  };
  const mockCredential = new GeneratedCredential(
    "test-password",
    "password",
    new Date("2024-01-01"),
  );

  let historyService: ReturnType<typeof mock<GeneratorHistoryService>>;

  beforeEach(() => {
    historyService = mock<GeneratorHistoryService>();
    historyService.track.mockResolvedValue(null);
  });

  it("tracks the credential when an active user is present", async () => {
    await trackGeneratedCredential(historyService, of(mockAccount), mockCredential);

    expect(historyService.track).toHaveBeenCalledWith(
      mockUserId,
      mockCredential.credential,
      mockCredential.category,
      mockCredential.generationDate,
    );
  });

  it("does nothing when there is no active user", async () => {
    await trackGeneratedCredential(historyService, of(null), mockCredential);

    expect(historyService.track).not.toHaveBeenCalled();
  });
});
