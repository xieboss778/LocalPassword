/** 密码生成的纯逻辑：不碰 DOM、不碰服务，方便单测。 */

import { randomIndex } from "./random";

export interface PasswordOptions {
  readonly length: number;
  readonly upper: boolean;
  readonly lower: boolean;
  readonly digits: boolean;
  readonly symbols: boolean;
  /** 去掉容易看错的字符：O 0 I l 1 | o */
  readonly avoidAmbiguous: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = Object.freeze({
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
});

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?";
const AMBIGUOUS = new Set(["O", "0", "I", "l", "1", "|", "o"]);

const MIN_LENGTH = 4;
const MAX_LENGTH = 128;

/**
 * 生成一个密码。
 *
 * 规则：先从每个启用的字符集各取一个（保证每类都出现），剩下的位从合集里随机取，
 * 最后整体打乱——这样「包含大写」这类开关不是概率游戏。
 */
export function generatePassword(options: PasswordOptions): string {
  const sets = enabledSets(options);
  if (sets.length === 0) {
    throw new Error("generatePassword: 至少要启用一个字符集");
  }

  const length = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(options.length)));
  const pool = sets.join("");
  const chars: string[] = sets.map((set) => pick(set));

  while (chars.length < length) {
    chars.push(pick(pool));
  }

  return shuffle(chars).slice(0, length).join("");
}

export function generatePasswords(count: number, options: PasswordOptions): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  // 极端设置（长度 4、只有数字）会有重复，允许有限重试但绝不无限循环。
  for (let attempt = 0; attempt < count * 4 && out.length < count; attempt++) {
    const candidate = generatePassword(options);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}

function enabledSets(options: PasswordOptions): string[] {
  const filter = (chars: string) =>
    options.avoidAmbiguous ? [...chars].filter((char) => !AMBIGUOUS.has(char)).join("") : chars;

  const sets: string[] = [];
  if (options.upper) {
    sets.push(filter(UPPER));
  }
  if (options.lower) {
    sets.push(filter(LOWER));
  }
  if (options.digits) {
    sets.push(filter(DIGITS));
  }
  if (options.symbols) {
    sets.push(filter(SYMBOLS));
  }
  return sets.filter((set) => set.length > 0);
}

function pick(chars: string): string {
  return chars[randomIndex(chars.length)];
}

function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}
