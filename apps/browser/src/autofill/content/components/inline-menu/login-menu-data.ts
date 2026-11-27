import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";

export type InlineMenuAccountMethod = "passkey" | "password";
export type InlineMenuMethod = InlineMenuAccountMethod | "totp";

export type InlineMenuAccountRowData = {
  cipher: InlineMenuCipherData;
  method: InlineMenuAccountMethod;
  username: string;
  label: string;
  hasTotp: boolean;
  rowKey: string;
};

export type InlineMenuGroupData = {
  key: InlineMenuAccountMethod;
  rows: InlineMenuAccountRowData[];
};

export type InlineMenuLoginGroups = {
  groups: InlineMenuGroupData[];
  matchedAccounts: number;
  totalAccounts: number;
  currentAccountId: string | null;
  lastUsedAccountId: string | null;
};

export type InlineMenuTotpRowData = {
  cipher: InlineMenuCipherData;
  username: string;
  label: string;
  code: string;
  period: number;
  rowKey: string;
};

export function getCipherUsername(cipher: InlineMenuCipherData): string {
  return cipher.login?.username || cipher.login?.passkey?.userName || "";
}

export function getCipherLabel(cipher: InlineMenuCipherData): string {
  // The vault item name doubles as the account label on the row's secondary line, e.g.
  // "Personal account · Password + verification code".
  return cipher.name;
}

export function getAccountKey(cipher: InlineMenuCipherData): string {
  return cipher.id;
}

export function cipherHasPasskey(cipher: InlineMenuCipherData): boolean {
  return !!cipher.login?.passkey;
}

export function cipherHasPassword(cipher: InlineMenuCipherData): boolean {
  // Derived from the decrypted password in the background. It is set on every entry of a cipher,
  // including a passkey entry for an account that also stores a password.
  return !!cipher.login?.hasPassword;
}

export function cipherHasTotp(cipher: InlineMenuCipherData): boolean {
  return !!cipher.login?.totp;
}

export function accountMatchesQuery(cipher: InlineMenuCipherData, query: string): boolean {
  const value = query.trim().toLowerCase();
  if (!value) {
    return true;
  }

  return `${getCipherUsername(cipher)} ${getCipherLabel(cipher)}`.toLowerCase().includes(value);
}

export function countUniqueAccounts(ciphers: InlineMenuCipherData[]): number {
  return new Set(ciphers.map(getAccountKey)).size;
}

export function getAccountRowKey(cipher: InlineMenuCipherData, method: InlineMenuMethod): string {
  return `${method}:${cipher.id}`;
}

/**
 * Returns one password entry per account. A cipher that also has a passkey is emitted twice with
 * the same account key, so prefer the entry without a passkey: that is the one the menu fills a
 * password from, while the passkey entry belongs to the passkey group.
 */
function getPasswordEntries(accounts: InlineMenuCipherData[]): InlineMenuCipherData[] {
  const entries = new Map<string, InlineMenuCipherData>();

  for (const cipher of accounts) {
    if (!cipherHasPassword(cipher)) {
      continue;
    }

    const key = getAccountKey(cipher);
    const existing = entries.get(key);
    if (!existing || (cipherHasPasskey(existing) && !cipherHasPasskey(cipher))) {
      entries.set(key, cipher);
    }
  }

  return Array.from(entries.values());
}

/**
 * Builds the account-first groups for the login inline menu.
 *
 * The same account is intentionally allowed to show once in each method group, because selecting
 * a passkey and selecting a password are different user intents.
 */
export function getLoginGroups(
  ciphers: InlineMenuCipherData[],
  query: string,
): InlineMenuLoginGroups {
  const totalAccounts = countUniqueAccounts(ciphers);
  const accounts = ciphers.filter((cipher) => !!cipher.login && accountMatchesQuery(cipher, query));
  const matchedAccounts = countUniqueAccounts(accounts);
  const currentAccountId = findCurrentAccountId(accounts, query);
  const lastUsedAccountId = currentAccountId ?? accounts[0]?.id ?? null;

  const passkeyRows = accounts
    .filter(cipherHasPasskey)
    .map((cipher) => buildAccountRow(cipher, "passkey"));
  const passwordRows = getPasswordEntries(accounts).map((cipher) =>
    buildAccountRow(cipher, "password"),
  );

  const groups = [
    {
      key: "passkey" as const,
      rows: prioritizeCurrent(passkeyRows, currentAccountId, (row) => row.cipher.id),
    },
    {
      key: "password" as const,
      rows: prioritizeCurrent(passwordRows, currentAccountId, (row) => row.cipher.id),
    },
  ].filter((group) => group.rows.length > 0);

  return {
    groups,
    matchedAccounts,
    totalAccounts,
    currentAccountId,
    lastUsedAccountId,
  };
}

/**
 * Builds the live-code rows shown on TOTP fields. Only accounts with a TOTP secret appear.
 */
export function getTotpRows(
  ciphers: InlineMenuCipherData[],
  query: string,
  selectedAccountId: string | null,
): InlineMenuTotpRowData[] {
  const accounts = ciphers.filter(
    (cipher) => cipherHasTotp(cipher) && accountMatchesQuery(cipher, query),
  );
  const seenAccountIds = new Set<string>();
  const uniqueAccounts = accounts.filter((cipher) => {
    if (seenAccountIds.has(cipher.id)) {
      return false;
    }
    seenAccountIds.add(cipher.id);
    return true;
  });
  const currentAccountId =
    uniqueAccounts.find((cipher) => cipher.id === selectedAccountId)?.id ??
    uniqueAccounts[0]?.id ??
    null;

  return prioritizeCurrent(uniqueAccounts, currentAccountId, (cipher) => cipher.id).map(
    (cipher) => ({
      cipher,
      username: getCipherUsername(cipher),
      label: getCipherLabel(cipher),
      code: cipher.login?.totp ?? "",
      period: cipher.login?.totpCodeTimeInterval ?? 30,
      rowKey: getAccountRowKey(cipher, "totp"),
    }),
  );
}

function buildAccountRow(
  cipher: InlineMenuCipherData,
  method: InlineMenuAccountMethod,
): InlineMenuAccountRowData {
  return {
    cipher,
    method,
    username: getCipherUsername(cipher),
    label: getCipherLabel(cipher),
    hasTotp: cipherHasTotp(cipher),
    rowKey: getAccountRowKey(cipher, method),
  };
}

function findCurrentAccountId(ciphers: InlineMenuCipherData[], query: string): string | null {
  const value = query.trim().toLowerCase();
  if (!value) {
    return null;
  }

  return ciphers.find((cipher) => getCipherUsername(cipher).toLowerCase() === value)?.id ?? null;
}

function prioritizeCurrent<T>(
  items: T[],
  currentAccountId: string | null,
  getCipherId: (item: T) => string,
): T[] {
  if (!currentAccountId) {
    return items;
  }

  const currentItems = items.filter((item) => getCipherId(item) === currentAccountId);
  if (!currentItems.length) {
    return items;
  }

  return [...currentItems, ...items.filter((item) => getCipherId(item) !== currentAccountId)];
}
