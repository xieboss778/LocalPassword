import { mock } from "jest-mock-extended";

import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";

import {
  clearClipboardIfStillHolding,
  clipboardClearSeconds,
  clipboardDelayOptionValue,
} from "./clipboard";

describe("clipboardClearSeconds", () => {
  it.each([
    [ClearClipboardDelay.TenSeconds, 10],
    [ClearClipboardDelay.TwentySeconds, 20],
    [ClearClipboardDelay.ThirtySeconds, 30],
    [ClearClipboardDelay.OneMinute, 60],
    [ClearClipboardDelay.TwoMinutes, 120],
    [ClearClipboardDelay.FiveMinutes, 300],
    [ClearClipboardDelay.Never, 0],
  ])("maps %s to %i seconds", (setting, seconds) => {
    expect(clipboardClearSeconds(setting)).toBe(seconds);
  });

  it("treats an unknown setting as never clearing on its own", () => {
    expect(clipboardClearSeconds("forever" as never)).toBe(0);
  });
});

describe("clipboardDelayOptionValue", () => {
  it("maps the stored step to the seconds the settings select uses", () => {
    expect(clipboardDelayOptionValue(ClearClipboardDelay.TenSeconds)).toBe("10");
    expect(clipboardDelayOptionValue(ClearClipboardDelay.ThirtySeconds)).toBe("30");
    expect(clipboardDelayOptionValue(ClearClipboardDelay.FiveMinutes)).toBe("300");
  });

  it("falls back to the never option for a missing or unknown setting", () => {
    expect(clipboardDelayOptionValue(null)).toBe("never");
    expect(clipboardDelayOptionValue(undefined)).toBe("never");
    expect(clipboardDelayOptionValue(ClearClipboardDelay.Never)).toBe("never");
    expect(clipboardDelayOptionValue("forever" as never)).toBe("never");
  });
});

describe("clearClipboardIfStillHolding", () => {
  const platformUtilsService = mock<PlatformUtilsService>();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("clears the clipboard while it still holds the copied value", async () => {
    platformUtilsService.readFromClipboard.mockResolvedValue("hunter2");

    await clearClipboardIfStillHolding(platformUtilsService, "hunter2");

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("", { clearing: true });
  });

  it("keeps a newer clipboard value untouched", async () => {
    platformUtilsService.readFromClipboard.mockResolvedValue("something the user copied later");

    await clearClipboardIfStillHolding(platformUtilsService, "hunter2");

    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("clears anyway when the clipboard cannot be read", async () => {
    platformUtilsService.readFromClipboard.mockRejectedValue(new Error("denied"));

    await clearClipboardIfStillHolding(platformUtilsService, "hunter2");

    expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("", { clearing: true });
  });
});
