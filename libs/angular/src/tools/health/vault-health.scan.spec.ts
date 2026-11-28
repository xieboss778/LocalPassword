import { mock } from "jest-mock-extended";
import { ZXCVBNResult } from "zxcvbn";

import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { LoginView } from "@localpass/common/vault/models/view/login.view";

import { HealthIssueKind, scanVaultHealth } from "./vault-health.scan";

const NOW = new Date("2026-11-28T12:00:00Z");
const RECENT = new Date("2026-10-01T12:00:00Z");
const OLD = new Date("2025-09-01T12:00:00Z");
const STRONG = "correct-horse-battery-staple";

describe("scanVaultHealth", () => {
  const strength = mock<PasswordStrengthServiceAbstraction>();
  strength.getPasswordStrength.mockImplementation((password: string) => {
    const strong = password.length >= 20;
    return { score: strong ? 4 : 1 } as ZXCVBNResult;
  });

  function login(
    id: string,
    password: string,
    options: {
      name?: string;
      username?: string;
      totp?: string;
      changedAt?: Date;
      archived?: boolean;
      deleted?: boolean;
    } = {},
  ): CipherView {
    return Object.assign(new CipherView(), {
      id,
      name: options.name ?? id,
      type: CipherType.Login,
      revisionDate: options.changedAt ?? RECENT,
      archivedDate: options.archived ? RECENT : undefined,
      deletedDate: options.deleted ? RECENT : undefined,
      login: Object.assign(new LoginView(), {
        username: options.username ?? `${id}@example.com`,
        password,
        passwordRevisionDate: options.changedAt ?? RECENT,
        totp: options.totp,
      }),
    });
  }

  it("groups reused passwords once and still counts every strong login", () => {
    const report = scanVaultHealth(
      [
        login("a", STRONG, { name: "Alpha", totp: "totp-a" }),
        login("b", STRONG, { name: "Beta", totp: "totp-b" }),
        login("c", "another-strong-password-here", { name: "Gamma", totp: "totp-c" }),
      ],
      strength,
      NOW,
    );

    expect(report.totalLogins).toBe(3);
    expect(report.reusedGroups).toBe(1);
    expect(report.strongLogins).toBe(3);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({
      kind: HealthIssueKind.Reused,
      cipherId: "a",
      name: "Alpha",
      sharedWith: ["Beta"],
    });
  });

  it("lists weak, stale and missing-TOTP findings once per login", () => {
    const report = scanVaultHealth(
      [
        login("weak", "short", { name: "Weak", totp: "totp-weak" }),
        login("old", "another-strong-password-here", {
          name: "Old",
          totp: "totp-old",
          changedAt: OLD,
        }),
        login("no-totp", "third-strong-password-here", { name: "No TOTP" }),
        login("clean", "a-fourth-strong-password-here", { name: "Clean", totp: "totp-clean" }),
      ],
      strength,
      NOW,
    );

    expect(report.weakOrStaleLogins).toBe(2);
    expect(report.missingTotpLogins).toBe(1);
    expect(report.strongLogins).toBe(3);
    expect(report.issues.map((issue) => issue.kind)).toEqual([
      HealthIssueKind.Weak,
      HealthIssueKind.Stale,
      HealthIssueKind.MissingTotp,
    ]);
    expect(report.issues.map((issue) => issue.cipherId)).toEqual(["weak", "old", "no-totp"]);
  });

  it("ignores deleted, archived, passwordless and non-login items", () => {
    const note = Object.assign(new CipherView(), {
      id: "note",
      name: "Note",
      type: CipherType.SecureNote,
      revisionDate: RECENT,
    });

    const report = scanVaultHealth(
      [
        login("deleted", "short", { deleted: true }),
        login("archived", "short", { archived: true }),
        login("empty", ""),
        note,
      ],
      strength,
      NOW,
    );

    expect(report).toMatchObject({
      totalLogins: 0,
      issues: [],
      reusedGroups: 0,
      weakOrStaleLogins: 0,
      missingTotpLogins: 0,
      strongLogins: 0,
    });
  });

  it("does not list a weak login a second time when its password is also reused", () => {
    const report = scanVaultHealth(
      [login("a", "short", { name: "Alpha" }), login("b", "short", { name: "Beta" })],
      strength,
      NOW,
    );

    expect(report.reusedGroups).toBe(1);
    expect(report.weakOrStaleLogins).toBe(2);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].kind).toBe(HealthIssueKind.Reused);
  });
});
