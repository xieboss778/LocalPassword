import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { createAutofillOverlayCipherDataMock } from "../../../../spec/autofill-mocks";
import {
  accountMatchesQuery,
  cipherHasPassword,
  countUniqueAccounts,
  getLoginGroups,
  getTotpRows,
} from "../login-menu-data";

describe("inline menu login data", () => {
  const passwordCipher = createAutofillOverlayCipherDataMock(1, {
    id: "account-1",
    name: "Example",
    login: { username: "alice@example.com", hasPassword: true, passkey: null },
  });
  const passkeyCipher = createAutofillOverlayCipherDataMock(2, {
    id: "account-1",
    name: "Example",
    login: {
      username: "alice@example.com",
      // The same vault cipher also has a password, so both methods offer it.
      hasPassword: true,
      passkey: { rpName: "Example", userName: "alice@example.com" },
    },
  });
  const passkeyOnlyCipher = createAutofillOverlayCipherDataMock(3, {
    id: "account-2",
    name: "Passkey only",
    login: {
      username: "passkey-only@example.com",
      hasPassword: false,
      passkey: { rpName: "Example", userName: "passkey-only@example.com" },
    },
  });
  const secondPasswordCipher = createAutofillOverlayCipherDataMock(4, {
    id: "account-3",
    name: "alice@example.com backup",
    login: { username: "bob@example.com", hasPassword: true, passkey: null },
  });

  it("counts duplicated method entries as a single account", () => {
    expect(countUniqueAccounts([passwordCipher, passkeyCipher, secondPasswordCipher])).toBe(2);
  });

  it.each([
    ["alice@example.com", true],
    ["EXAMPLE", true],
    ["bob", false],
    ["", true],
  ])("matches the account query %s", (query, expected) => {
    expect(accountMatchesQuery(passwordCipher, query as string)).toBe(expected);
  });

  it("only treats a passkey entry as a password source when the cipher stores a password", () => {
    expect(cipherHasPassword(passkeyOnlyCipher)).toBe(false);
    expect(cipherHasPassword(passkeyCipher)).toBe(true);
    expect(cipherHasPassword(passwordCipher)).toBe(true);
  });

  it("shows the same account once per method group", () => {
    const groups = getLoginGroups([passkeyCipher, passwordCipher, secondPasswordCipher], "");

    expect(groups.groups.map((group) => group.key)).toEqual(["passkey", "password"]);
    expect(groups.groups[0].rows.map((row) => row.method)).toEqual(["passkey"]);
    expect(groups.groups[1].rows.map((row) => row.method)).toEqual(["password", "password"]);
    expect(groups.groups[1].rows.map((row) => row.username)).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    expect(groups.matchedAccounts).toBe(2);
    expect(groups.totalAccounts).toBe(2);
    expect(groups.groups[0].rows[0].rowKey).toBe("passkey:account-1");
    expect(groups.groups[1].rows[0].rowKey).toBe("password:account-1");
    expect(groups.groups[1].rows[0].cipher.login?.passkey).toBeNull();
  });

  it("does not create a password group for a passkey-only account", () => {
    const groups = getLoginGroups([passkeyOnlyCipher], "");

    expect(groups.groups.map((group) => group.key)).toEqual(["passkey"]);
    expect(groups.groups[0].rows[0].rowKey).toBe("passkey:account-2");
  });

  it("filters accounts while keeping the unfiltered total", () => {
    const groups = getLoginGroups([passkeyCipher, passwordCipher, secondPasswordCipher], "bob");

    expect(groups.matchedAccounts).toBe(1);
    expect(groups.totalAccounts).toBe(2);
    expect(groups.groups).toHaveLength(1);
    expect(groups.groups[0].rows[0].username).toBe("bob@example.com");
  });

  it("marks and prioritizes the account matching the typed username", () => {
    const groups = getLoginGroups(
      [secondPasswordCipher, passkeyCipher, passwordCipher],
      "ALICE@example.com",
    );

    expect(groups.currentAccountId).toBe("account-1");
    expect(groups.groups[1].rows.map((row) => row.username)).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    expect(groups.groups[0].rows[0].cipher.id).toBe("account-1");
  });

  it("builds TOTP rows only for accounts with a verification code", () => {
    const totpCipher = createAutofillOverlayCipherDataMock(4, {
      id: "account-3",
      login: {
        username: "carol@example.com",
        totp: "123456",
        totpField: true,
        totpCodeTimeInterval: 60,
        passkey: null,
      },
    });

    const rows = getTotpRows([passwordCipher, totpCipher], "", null);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      username: "carol@example.com",
      code: "123456",
      period: 60,
      rowKey: "totp:account-3",
    });
  });

  it("deduplicates TOTP rows and prioritizes the selected account", () => {
    const totpCipher = createAutofillOverlayCipherDataMock(4, {
      id: "account-3",
      login: {
        username: "carol@example.com",
        totp: "123456",
        totpField: true,
        totpCodeTimeInterval: 30,
        passkey: null,
      },
    });
    const duplicateTotpCipher: InlineMenuCipherData = {
      ...totpCipher,
      login: {
        ...totpCipher.login,
        passkey: { rpName: "Example", userName: "carol@example.com" },
      },
    };
    const otherTotpCipher = createAutofillOverlayCipherDataMock(5, {
      id: "account-4",
      login: {
        username: "dave@example.com",
        totp: "654321",
        totpField: true,
        totpCodeTimeInterval: 30,
        passkey: null,
      },
    });

    const rows = getTotpRows([otherTotpCipher, totpCipher, duplicateTotpCipher], "", "account-3");

    expect(rows.map((row) => row.cipher.id)).toEqual(["account-3", "account-4"]);
    expect(rows[0].cipher.id).toBe("account-3");
  });
});
