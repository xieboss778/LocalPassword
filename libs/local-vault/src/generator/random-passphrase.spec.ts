import { EFFLongWordList } from "@localpass/common/platform/misc/wordlist";

import {
  DEFAULT_PASSPHRASE_OPTIONS,
  generatePassphrase,
  generatePassphrases,
  PassphraseOptions,
} from "./random-passphrase";

const OPTIONS: PassphraseOptions = DEFAULT_PASSPHRASE_OPTIONS;

describe("generatePassphrase", () => {
  it("returns the requested number of words joined by the separator", () => {
    const phrase = generatePassphrase({ ...OPTIONS, words: 6, separator: " " });
    expect(phrase.split(" ")).toHaveLength(6);
  });

  it("only uses words from the bundled EFF word list", () => {
    const phrase = generatePassphrase({ ...OPTIONS, words: 7 });
    const known = new Set(EFFLongWordList);
    for (const word of phrase.split("-")) {
      expect(known.has(word)).toBe(true);
    }
  });

  it("capitalizes every word when asked", () => {
    const phrase = generatePassphrase({ ...OPTIONS, words: 4, capitalize: true });
    for (const word of phrase.split("-")) {
      expect(word[0]).toBe(word[0].toUpperCase());
    }
  });

  it("appends a single digit to exactly one word when includeNumber is on", () => {
    const phrase = generatePassphrase({
      ...OPTIONS,
      words: 5,
      capitalize: false,
      includeNumber: true,
    });
    const words = phrase.split("-");
    expect(words).toHaveLength(5);
    expect(words.filter((word) => /\d$/.test(word))).toHaveLength(1);
  });

  it("clamps the word count to the supported range", () => {
    expect(generatePassphrase({ ...OPTIONS, words: 1 }).split("-")).toHaveLength(3);
    expect(generatePassphrase({ ...OPTIONS, words: 99 }).split("-")).toHaveLength(12);
  });

  it("returns distinct candidates when asked for several", () => {
    const passphrases = generatePassphrases(4, { ...OPTIONS, words: 6 });
    expect(passphrases).toHaveLength(4);
    expect(new Set(passphrases).size).toBe(4);
  });
});
