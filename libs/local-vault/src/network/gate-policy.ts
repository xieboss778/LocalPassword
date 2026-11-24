/**
 * Outbound request policy for a local-only vault.
 *
 * Everything is blocked except:
 *  - the configured storage endpoint (R2/S3) once the user has authorised it;
 *  - the breach-check endpoint, and only for a request the user explicitly triggered.
 *
 * The sentinel host used for placeholder environment URLs must never leave the device;
 * upstream would otherwise try to resolve `vault.local.invalid`.
 */

export const LOCAL_VAULT_SENTINEL_HOST = "vault.local.invalid";
export const BREACH_CHECK_HOST = "api.pwnedpasswords.com";

export interface GatePolicyConfig {
  /** Hosts allowed for sync, e.g. `abc123.r2.cloudflarestorage.com`. */
  readonly storageHosts: readonly string[];
  /** Whether the user has enabled the explicit "check for breach" action. */
  readonly breachCheckEnabled: boolean;
}

export type GateDecision =
  | { readonly action: "allow"; readonly reason: "storage" | "breach-check" }
  | { readonly action: "block"; readonly reason: string };

export interface GateRequest {
  readonly url: string;
  /** True only when the user clicked the action in this turn. */
  readonly userInitiated?: boolean;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

export class NetworkGatePolicy {
  constructor(private readonly config: GatePolicyConfig) {}

  evaluate(request: GateRequest): GateDecision {
    const host = hostOf(request.url);
    if (host === "") {
      return { action: "block", reason: "invalid-url" };
    }
    if (host === LOCAL_VAULT_SENTINEL_HOST) {
      return { action: "block", reason: "sentinel-host" };
    }
    if (this.config.storageHosts.some((allowed) => host === allowed.toLowerCase())) {
      return { action: "allow", reason: "storage" };
    }
    if (host === BREACH_CHECK_HOST) {
      return this.config.breachCheckEnabled && request.userInitiated === true
        ? { action: "allow", reason: "breach-check" }
        : { action: "block", reason: "breach-check-not-user-initiated" };
    }
    return { action: "block", reason: "not-allowlisted" };
  }
}
