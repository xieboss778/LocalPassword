import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { LogoutReason } from "@bitwarden/common/auth/logout";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ApiService, HttpOperations } from "@bitwarden/common/services/api.service";

import { GateDecision, NetworkGatePolicy } from "./gate-policy";

/** Thrown instead of ever letting a blocked request reach the network. */
export class NetworkGateBlockedError extends Error {
  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super(`Network access to ${url} is blocked: ${reason}`);
    this.name = "NetworkGateBlockedError";
  }
}

/**
 * Holds the allowlist the network gate enforces.
 *
 * It starts closed: a local vault talks to nothing. The storage endpoint is added once the user
 * authorises R2/S3 in settings, and the breach-check endpoint only after the user enables it.
 */
export class LocalVaultNetworkGate {
  private storageHosts: string[] = [];
  private breachCheckEnabled = false;

  setStorageHosts(hosts: string[]): void {
    this.storageHosts = [...hosts];
  }

  getStorageHosts(): string[] {
    return [...this.storageHosts];
  }

  setBreachCheckEnabled(enabled: boolean): void {
    this.breachCheckEnabled = enabled;
  }

  evaluate(url: string, userInitiated = false): GateDecision {
    const policy = new NetworkGatePolicy({
      storageHosts: this.storageHosts,
      breachCheckEnabled: this.breachCheckEnabled,
    });
    return policy.evaluate({ url, userInitiated });
  }

  assertAllowed(url: string): void {
    const decision = this.evaluate(url);
    if (decision.action === "block") {
      throw new NetworkGateBlockedError(url, decision.reason);
    }
  }
}

/**
 * The `ApiService` a local vault runs on.
 *
 * Every transport method passes through the network gate before anything leaves the device. A
 * blocked request throws `NetworkGateBlockedError` rather than returning a 401/403, because the
 * client treats those as a server rejection and logs the user out.
 */
export class LocalPasswordApiService extends ApiService {
  constructor(
    tokenService: TokenService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    appIdService: AppIdService,
    refreshAccessTokenErrorCallback: () => void,
    logService: LogService,
    logoutCallback: (logoutReason: LogoutReason) => Promise<void>,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    accountService: AccountService,
    httpOperations: HttpOperations,
    /** Shared with the settings page so the allowlist can change at runtime. */
    private readonly gate: LocalVaultNetworkGate = new LocalVaultNetworkGate(),
    customUserAgent: string = null,
  ) {
    super(
      tokenService,
      platformUtilsService,
      environmentService,
      appIdService,
      refreshAccessTokenErrorCallback,
      logService,
      logoutCallback,
      vaultTimeoutSettingsService,
      accountService,
      httpOperations,
      customUserAgent,
    );
  }

  networkGate(): LocalVaultNetworkGate {
    return this.gate;
  }

  override nativeFetch(request: Request): Promise<Response> {
    this.gate.assertAllowed(request.url);
    return super.nativeFetch(request);
  }

  override nativeXMLHttpRequest(
    request: Request,
    onProgress: (percentage: number) => void,
  ): Promise<Response> {
    this.gate.assertAllowed(request.url);
    return super.nativeXMLHttpRequest(request, onProgress);
  }
}
