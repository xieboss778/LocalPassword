import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { LOCAL_VAULT_SENTINEL_URL } from "./local-vault-environment";

/** Claims written into the self-signed token, mirroring the server's identity token shape. */
export type LocalAccessTokenOptions = {
  /** The id of the account the token belongs to; must match the account record. */
  readonly userId: UserId;
  readonly email: string;
  readonly name: string;
  /** Defaults to "now"; only tests pass a value. */
  readonly issuedAt?: Date;
};

/**
 * Ten years, in seconds. A local account never re-authenticates, and the client logs the user out
 * once the access token expires, so the token has to outlive any realistic use of the vault.
 */
const TOKEN_LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60;

/**
 * Builds the self-signed access token a local account uses in place of a server-issued one.
 *
 * The token is never verified anywhere: the client only decodes the payload to read the user id,
 * the email and the name, so the signature segment stays empty. Keep this in sync with
 * `DecodedAccessToken` in `@bitwarden/common/auth/services/token.service`.
 */
export function buildLocalAccessToken(options: LocalAccessTokenOptions): string {
  const issuedAtSeconds = Math.floor((options.issuedAt ?? new Date()).getTime() / 1000);

  const header = { alg: "none", typ: "JWT" };
  const payload = {
    sub: options.userId,
    email: options.email,
    email_verified: true,
    name: options.name,
    premium: true,
    iss: LOCAL_VAULT_SENTINEL_URL,
    iat: issuedAtSeconds,
    nbf: issuedAtSeconds,
    exp: issuedAtSeconds + TOKEN_LIFETIME_SECONDS,
    amr: ["local"],
  };

  const encode = (value: unknown) => Utils.fromUtf8ToUrlB64(JSON.stringify(value));
  return `${encode(header)}.${encode(payload)}.`;
}
