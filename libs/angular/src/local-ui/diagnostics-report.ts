/**
 * What the diagnostic report is allowed to contain.
 *
 * The type is the guarantee: it has no field for item names, URLs, usernames, notes, passwords,
 * TOTP secrets, tokens or ciphertext, so none of those values can reach the clipboard by accident.
 * Only versions, platform labels, settings, aggregate counts and sync status belong here.
 */
export interface LocalDiagnosticsInput {
  readonly appVersion: string;
  readonly client: "desktop" | "extension";
  readonly device: string;
  readonly locale: string;
  readonly theme: string;
  readonly itemCount: number;
  readonly folderCount: number;
  readonly archiveCount?: number;
  readonly trashCount: number;
  readonly syncConfigured: boolean;
  readonly syncPending: boolean;
  readonly syncGeneration?: number | null;
  readonly conflictCount?: number;
  readonly nativeMessagingPermission?: boolean | null;
  readonly electronVersion?: string | null;
  readonly userAgent: string;
  readonly generatedAt: Date;
}

export interface LocalRuntimeVersions {
  readonly electron: string | null;
  readonly chromium: string | null;
}

const REPORT_FORMAT = "LocalPass diagnostics v1";

/** Pulls only the two runtime version numbers out of the user agent; the rest is not reported. */
export function parseRuntimeVersions(userAgent: string): LocalRuntimeVersions {
  return {
    electron: matchVersion(userAgent, /Electron\/([\d.]+)/),
    chromium: matchVersion(userAgent, /Chrome\/([\d.]+)/),
  };
}

/** Builds the zero-sensitive report shared by the desktop and extension About pages. */
export function buildDiagnosticReport(input: LocalDiagnosticsInput): string {
  const runtime = parseRuntimeVersions(input.userAgent);
  const electron = input.electronVersion ?? runtime.electron;
  const syncParts = [input.syncPending ? "pending changes" : "up to date"];
  if (input.syncGeneration != null) {
    syncParts.push(`gen #${input.syncGeneration}`);
  }
  if (input.conflictCount && input.conflictCount > 0) {
    syncParts.push(`${input.conflictCount} conflicts`);
  }
  const syncState = input.syncConfigured
    ? `configured (${syncParts.join(", ")})`
    : "not configured";
  const vaultParts = [
    `${input.itemCount} items`,
    `${input.folderCount} folders`,
    ...(input.archiveCount == null ? [] : [`${input.archiveCount} archived`]),
    `${input.trashCount} in trash`,
  ];

  return [
    REPORT_FORMAT,
    `app: LocalPass ${input.appVersion}`,
    `client: ${input.client}`,
    `device: ${input.device}`,
    ...(electron == null ? [] : [`electron: ${electron}`]),
    `chromium: ${runtime.chromium ?? "n/a"}`,
    `locale: ${input.locale}`,
    `theme: ${input.theme}`,
    `vault: ${vaultParts.join(", ")}`,
    `sync: ${syncState}`,
    ...(input.nativeMessagingPermission == null
      ? []
      : [
          `native messaging permission: ${input.nativeMessagingPermission ? "granted" : "not granted"}`,
        ]),
    `generated: ${input.generatedAt.toISOString()}`,
    "excluded: item names, URLs, usernames, notes, passwords, TOTP secrets, tokens, ciphertext",
  ].join("\n");
}

function matchVersion(userAgent: string, pattern: RegExp): string | null {
  return pattern.exec(userAgent)?.[1] ?? null;
}
