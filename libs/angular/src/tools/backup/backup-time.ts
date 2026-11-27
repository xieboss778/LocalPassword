import { I18nService } from "@localpass/common/platform/abstractions/i18n.service";

/**
 * Renders a stored ISO timestamp for the backup pages: today shows「今天 HH:mm」，
 * other days show a compact `YYYY-MM-DD HH:mm`. Invalid values pass through untouched.
 */
export function formatBackupTimestamp(
  value: string | null,
  locale: string,
  i18n: I18nService,
): string {
  if (!value) {
    return i18n.t("never");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const time = date.toLocaleTimeString(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return `${i18n.t("recentlyActiveToday")} ${time}`;
  }

  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${time}`;
}

/**
 * Turns a snapshot object id (`2026-11-26T09-12-33-123Z`) into a local `YYYY-MM-DD HH:mm`.
 * Unknown ids pass through so a future format still renders something usable.
 */
export function formatSnapshotId(id: string, locale: string): string {
  const iso = id.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1T$2:$3:$4.$5Z",
  );
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return id;
  }

  const time = date.toLocaleTimeString(locale.startsWith("zh") ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${time}`;
}
