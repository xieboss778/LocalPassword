import { PasswordStrengthServiceAbstraction } from "@localpass/common/tools/password-strength";
import { CipherType } from "@localpass/common/vault/enums/cipher-type";
import { CipherView } from "@localpass/common/vault/models/view/cipher.view";
import { ItemKind, kindOf } from "@localpass/local-vault";

/** 密码强度低于 3 的登录条目按弱密码处理，与库内既有的口令强度口径一致。 */
const WEAK_PASSWORD_MAX_SCORE = 3;

const DAYS_BEFORE_STALE = 365;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export const HealthIssueKind = {
  Reused: "reused",
  Weak: "weak",
  Stale: "stale",
  MissingTotp: "missingTotp",
} as const;
export type HealthIssueKind = (typeof HealthIssueKind)[keyof typeof HealthIssueKind];

/**
 * 一条待处理项。只带列表需要的非敏感字段：密码本身、验证码密钥都不会进入这里。
 * 复用密码按组生成一条，`sharedWith` 是同一密码的其它条目名称。
 */
export interface VaultHealthIssue {
  readonly key: string;
  readonly kind: HealthIssueKind;
  readonly cipherId: string;
  readonly name: string;
  readonly username: string;
  readonly sharedWith: readonly string[];
  readonly passwordLength: number;
  readonly changedAt: Date | null;
}

export interface VaultHealthReport {
  readonly totalLogins: number;
  readonly issues: readonly VaultHealthIssue[];
  /** 共用同一密码的组数（与原型「重复使用密码」统计口径一致）。 */
  readonly reusedGroups: number;
  /** 弱密码或超过 365 天未更换的登录条目数，按条目去重。 */
  readonly weakOrStaleLogins: number;
  readonly missingTotpLogins: number;
  /** zxcvbn 得分不低于 3 的登录条目数。 */
  readonly strongLogins: number;
}

interface CheckedLogin {
  readonly id: string;
  readonly cipher: CipherView;
  readonly password: string;
  readonly score: number;
  readonly weak: boolean;
  readonly stale: boolean;
  readonly changedAt: Date | null;
}

const EMPTY_REPORT: VaultHealthReport = Object.freeze({
  totalLogins: 0,
  issues: [],
  reusedGroups: 0,
  weakOrStaleLogins: 0,
  missingTotpLogins: 0,
  strongLogins: 0,
});

/**
 * 在本机对未删除、未归档且带密码的登录条目做四项检查：重复密码、弱密码、
 * 365 天未更换、缺少验证码（TOTP）。所有判断都在内存完成，不联网、不记录密码。
 *
 * 列表按影响排序并保证同一条目只出现一次：重复密码组优先，其次是弱密码，
 * 再次是超期，最后是仅缺验证码的条目；被前一项覆盖的条目不会再次列出，
 * 但各统计卡仍按规则独立计数，所以卡片数字可能大于列表行数。
 */
export function scanVaultHealth(
  ciphers: readonly CipherView[],
  passwordStrengthService: PasswordStrengthServiceAbstraction,
  now: Date = new Date(),
): VaultHealthReport {
  const checked = checkLogins(ciphers, passwordStrengthService, now);
  if (checked.length === 0) {
    return EMPTY_REPORT;
  }

  const duplicateGroups = groupByPassword(checked);
  const issues = collectIssues(duplicateGroups, checked);

  return {
    totalLogins: checked.length,
    issues,
    reusedGroups: duplicateGroups.length,
    weakOrStaleLogins: checked.filter((entry) => entry.weak || entry.stale).length,
    missingTotpLogins: checked.filter((entry) => !entry.cipher.login?.totp).length,
    strongLogins: checked.filter((entry) => !entry.weak).length,
  };
}

function checkLogins(
  ciphers: readonly CipherView[],
  passwordStrengthService: PasswordStrengthServiceAbstraction,
  now: Date,
): CheckedLogin[] {
  const checked: CheckedLogin[] = [];

  for (const cipher of ciphers) {
    const login = cipher.login;
    const password = login?.password ?? "";
    if (
      cipher.type !== CipherType.Login ||
      kindOf(cipher) !== ItemKind.Login ||
      cipher.isDeleted ||
      cipher.isArchived ||
      !cipher.id ||
      password === ""
    ) {
      continue;
    }

    const result = passwordStrengthService.getPasswordStrength(
      password,
      login?.username ?? undefined,
      [cipher.name],
    );
    const score = result?.score ?? 0;
    const changedAt = login?.passwordRevisionDate ?? cipher.revisionDate ?? null;
    checked.push({
      id: cipher.id,
      cipher,
      password,
      score,
      weak: score < WEAK_PASSWORD_MAX_SCORE,
      stale: changedAt != null && extraDays(now, changedAt) > DAYS_BEFORE_STALE,
      changedAt,
    });
  }

  return checked;
}

function extraDays(now: Date, since: Date): number {
  const elapsed = now.getTime() - since.getTime();
  if (!Number.isFinite(elapsed)) {
    return 0;
  }
  return Math.max(0, Math.floor(elapsed / MILLISECONDS_PER_DAY));
}

function groupByPassword(checked: readonly CheckedLogin[]): CheckedLogin[][] {
  const groups = new Map<string, CheckedLogin[]>();
  for (const entry of checked) {
    const group = groups.get(entry.password);
    if (group) {
      group.push(entry);
    } else {
      groups.set(entry.password, [entry]);
    }
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => a.cipher.name.localeCompare(b.cipher.name)))
    .sort(
      (a, b) =>
        b.length - a.length || (a[0]?.cipher.name ?? "").localeCompare(b[0]?.cipher.name ?? ""),
    );
}

function collectIssues(
  duplicateGroups: readonly CheckedLogin[][],
  checked: readonly CheckedLogin[],
): VaultHealthIssue[] {
  const issues: VaultHealthIssue[] = [];
  const covered = new Set<string>();

  for (const group of duplicateGroups) {
    const [first, ...others] = group;
    if (!first) {
      continue;
    }
    issues.push(
      toIssue(
        first,
        HealthIssueKind.Reused,
        others.map((entry) => entry.cipher.name),
      ),
    );
    group.forEach((entry) => covered.add(entry.id));
  }

  for (const entry of checked
    .filter((entry) => !covered.has(entry.id) && entry.weak)
    .sort(byWeakness)) {
    issues.push(toIssue(entry, HealthIssueKind.Weak));
    covered.add(entry.id);
  }

  for (const entry of checked
    .filter((entry) => !covered.has(entry.id) && entry.stale)
    .sort((a, b) => (a.changedAt?.getTime() ?? 0) - (b.changedAt?.getTime() ?? 0))) {
    issues.push(toIssue(entry, HealthIssueKind.Stale));
    covered.add(entry.id);
  }

  for (const entry of checked
    .filter((entry) => !covered.has(entry.id) && !entry.cipher.login?.totp)
    .sort((a, b) => a.cipher.name.localeCompare(b.cipher.name))) {
    issues.push(toIssue(entry, HealthIssueKind.MissingTotp));
  }

  return issues;
}

function byWeakness(a: CheckedLogin, b: CheckedLogin): number {
  return a.score - b.score || a.cipher.name.localeCompare(b.cipher.name);
}

function toIssue(
  entry: CheckedLogin,
  kind: HealthIssueKind,
  sharedWith: readonly string[] = [],
): VaultHealthIssue {
  return {
    key: `${kind}:${entry.id}`,
    kind,
    cipherId: entry.id,
    name: entry.cipher.name,
    username: entry.cipher.login?.username ?? "",
    sharedWith,
    passwordLength: entry.password.length,
    changedAt: entry.changedAt,
  };
}
