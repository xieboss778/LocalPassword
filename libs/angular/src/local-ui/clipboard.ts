import { ClearClipboardDelay } from "@localpass/common/autofill/constants";
import { ClearClipboardDelaySetting } from "@localpass/common/autofill/types";
import { PlatformUtilsService } from "@localpass/common/platform/abstractions/platform-utils.service";

/**
 * The clipboard-clear setting stores a readable step; a copy receipt needs seconds.
 * `Never` (and an unknown value) returns 0, meaning the receipt must not clear on its own.
 */
export function clipboardClearSeconds(setting: ClearClipboardDelaySetting): number {
  switch (setting) {
    case ClearClipboardDelay.TenSeconds:
      return 10;
    case ClearClipboardDelay.TwentySeconds:
      return 20;
    case ClearClipboardDelay.ThirtySeconds:
      return 30;
    case ClearClipboardDelay.OneMinute:
      return 60;
    case ClearClipboardDelay.TwoMinutes:
      return 120;
    case ClearClipboardDelay.FiveMinutes:
      return 300;
    case ClearClipboardDelay.Never:
    default:
      return 0;
  }
}

/**
 * The value a settings select shows for the stored delay.
 *
 * Select options are keyed by the seconds ("10", "30"), while the setting is a named step
 * ("tenSeconds"); mapping through {@link clipboardClearSeconds} keeps the select on the
 * step the user actually saved instead of silently falling back to another option.
 */
export function clipboardDelayOptionValue(
  setting: ClearClipboardDelaySetting | null | undefined,
): string {
  const seconds = clipboardClearSeconds(setting ?? ClearClipboardDelay.Never);
  return seconds > 0 ? String(seconds) : "never";
}

/**
 * Clears the clipboard only while it still holds the value this receipt copied.
 *
 * The platform's own setting-driven clear does the same check; the receipt's countdown can
 * fire independently, so without the check it would wipe whatever the user copied in the
 * meantime. When the clipboard cannot be read (permission, unfocused popup), secrecy wins:
 * clear anyway rather than leave a copied secret behind.
 */
export async function clearClipboardIfStillHolding(
  platformUtilsService: PlatformUtilsService,
  value: string,
): Promise<void> {
  try {
    const current = await platformUtilsService.readFromClipboard();
    if (current !== value) {
      return;
    }
  } catch {
    // Fall through: an unreadable clipboard is treated as still holding our value.
  }
  platformUtilsService.copyToClipboard("", { clearing: true });
}
