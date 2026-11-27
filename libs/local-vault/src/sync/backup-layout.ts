/** The object layout. The bucket is the vault boundary, so everything sits at its root. */
export const ACCOUNT_OBJECT = "account.json";
export const MANIFEST_OBJECT = "manifest.json";
export const SNAPSHOT_PREFIX = "snapshots/";
export const EXPORT_PREFIX = "exports/";

/** `exports/<YYYY-MM-DD>/<timestamp>.json` — the day folder keeps the bucket browsable. */
export function exportKey(date: Date): string {
  const iso = date.toISOString();
  return `${EXPORT_PREFIX}${iso.slice(0, 10)}/${iso.replace(/[:.]/g, "-")}.json`;
}
