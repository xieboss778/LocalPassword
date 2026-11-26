/** 密码短语生成的纯逻辑：词表在本地，随机取样用 Web Crypto。 */

import { EFFLongWordList } from "@localpass/common/platform/misc/wordlist";

import { randomIndex } from "./random";

export interface PassphraseOptions {
  /** 词数，界面允许 3–12。 */
  readonly words: number;
  /** 词与词之间的分隔符。 */
  readonly separator: string;
  readonly capitalize: boolean;
  readonly includeNumber: boolean;
}

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = Object.freeze({
  words: 5,
  separator: "-",
  capitalize: false,
  includeNumber: false,
});

const MIN_WORDS = 3;
const MAX_WORDS = 12;

/** 生成一条密码短语；每个词都来自 EFF 长词表，按选项拼接。 */
export function generatePassphrase(options: PassphraseOptions): string {
  const count = Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(options.words)));
  const words = Array.from(
    { length: count },
    () => EFFLongWordList[randomIndex(EFFLongWordList.length)],
  );

  if (options.capitalize) {
    for (let i = 0; i < words.length; i++) {
      words[i] = words[i][0].toUpperCase() + words[i].slice(1);
    }
  }

  if (options.includeNumber) {
    const target = randomIndex(words.length);
    words[target] = `${words[target]}${randomIndex(10)}`;
  }

  return words.join(options.separator);
}

export function generatePassphrases(count: number, options: PassphraseOptions): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let attempt = 0; attempt < count * 4 && out.length < count; attempt++) {
    const candidate = generatePassphrase(options);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}
