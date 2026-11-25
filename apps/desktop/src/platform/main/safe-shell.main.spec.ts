import { shell } from "electron";

import { SafeUrls, UrlType } from "@localpass/common/platform/misc/safe-urls";
import { LogService } from "@localpass/logging";

import { SafeShell } from "./safe-shell.main";

jest.mock("electron", () => ({
  shell: {
    openExternal: jest.fn(),
  },
}));

jest.mock("@localpass/common/platform/misc/safe-urls");

describe("SafeShell", () => {
  let mockLogService: jest.Mocked<LogService>;

  beforeEach(() => {
    mockLogService = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    } as unknown as jest.Mocked<LogService>;

    jest.clearAllMocks();
  });

  describe("openExternal", () => {
    let safeShell: SafeShell;

    beforeEach(() => {
      safeShell = new SafeShell(mockLogService);
    });

    it("opens the url when canLaunch returns true", () => {
      jest.mocked(SafeUrls.canLaunch).mockReturnValue(true);

      safeShell.openExternal("https://local.invalid", UrlType.WebUrl);

      expect(shell.openExternal).toHaveBeenCalledWith("https://local.invalid", undefined);
      expect(mockLogService.warning).not.toHaveBeenCalled();
    });

    it("blocks the url and logs a warning when canLaunch returns false", () => {
      jest.mocked(SafeUrls.canLaunch).mockReturnValue(false);

      safeShell.openExternal("javascript:alert(1)", UrlType.WebUrl);

      expect(shell.openExternal).not.toHaveBeenCalled();
      expect(mockLogService.warning).toHaveBeenCalledWith(
        "Blocked attempt to open unsafe external url: javascript:alert(1)",
      );
    });
  });
});
