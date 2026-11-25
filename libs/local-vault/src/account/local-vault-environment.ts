import { Region, Urls } from "@localpass/common/platform/abstractions/environment.service";

/**
 * Every server URL of a local-only account points at this host. The network gate refuses to let
 * a request to it leave the device, so the placeholder can never resolve to a real server.
 */
export const LOCAL_VAULT_SENTINEL_URL = "https://vault.local.invalid";

/**
 * Notifications are switched off by pointing the client at a URL no WebSocket can connect to.
 * This is the same switch upstream ships for self-hosted installs without a notifications service.
 */
export const LOCAL_VAULT_NOTIFICATIONS_URL = "http://-";

/** The full URL set written for a local account. Everything except notifications is the sentinel. */
export const LOCAL_VAULT_URLS: Urls = Object.freeze({
  base: LOCAL_VAULT_SENTINEL_URL,
  webVault: LOCAL_VAULT_SENTINEL_URL,
  api: LOCAL_VAULT_SENTINEL_URL,
  identity: LOCAL_VAULT_SENTINEL_URL,
  icons: LOCAL_VAULT_SENTINEL_URL,
  notifications: LOCAL_VAULT_NOTIFICATIONS_URL,
  events: LOCAL_VAULT_SENTINEL_URL,
  keyConnector: LOCAL_VAULT_SENTINEL_URL,
  scim: LOCAL_VAULT_SENTINEL_URL,
  send: LOCAL_VAULT_SENTINEL_URL,
});

/**
 * A local vault is "self-hosted" as far as the client is concerned: the URLs are user-defined and
 * nothing may be inferred from a cloud region.
 */
export const LOCAL_VAULT_REGION: Region = Region.SelfHosted;

/** Default display name for the account record when the user does not type one. */
export const DEFAULT_LOCAL_ACCOUNT_NAME = "LocalPass";
