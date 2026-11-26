/** 用户名生成的纯逻辑：词表在本地，随机取样用 Web Crypto。 */

import { EFFLongWordList } from "@localpass/common/platform/misc/wordlist";

import { randomIndex } from "./random";

export interface UsernameOptions {
  /** 词与词、词与数字之间的分隔符；空字符串表示直接拼接。 */
  readonly separator: string;
  readonly includeNumber: boolean;
}

export const DEFAULT_USERNAME_OPTIONS: UsernameOptions = Object.freeze({
  separator: "-",
  includeNumber: true,
});

/** 两个词加一段可选的两位数字，全部取自本地词表，不探测邮箱域名。 */
export function generateUsername(options: UsernameOptions): string {
  const parts = [
    EFFLongWordList[randomIndex(EFFLongWordList.length)],
    EFFLongWordList[randomIndex(EFFLongWordList.length)],
  ];

  if (options.includeNumber) {
    parts.push(String(randomIndex(90) + 10));
  }

  return parts.join(options.separator);
}

export function generateUsernames(count: number, options: UsernameOptions): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let attempt = 0; attempt < count * 4 && out.length < count; attempt++) {
    const candidate = generateUsername(options);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}
