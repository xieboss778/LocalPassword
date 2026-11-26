import { EFFLongWordList } from "@localpass/common/platform/misc/wordlist";

import {
  DEFAULT_USERNAME_OPTIONS,
  generateUsername,
  generateUsernames,
  UsernameOptions,
} from "./random-username";

const OPTIONS: UsernameOptions = DEFAULT_USERNAME_OPTIONS;

describe("generateUsername", () => {
  it("joins two bundled words and a two-digit number with the separator", () => {
    const username = generateUsername(OPTIONS);
    const parts = username.split("-");

    expect(parts).toHaveLength(3);
    expect(parts[2]).toMatch(/^\d{2}$/);
    const known = new Set(EFFLongWordList);
    expect(known.has(parts[0])).toBe(true);
    expect(known.has(parts[1])).toBe(true);
  });

  it("concatenates the parts when the separator is empty", () => {
    const username = generateUsername({ separator: "", includeNumber: false });

    expect(username).not.toContain("-");
    expect(username).toMatch(/^[a-z]+$/);
  });

  it("leaves the number out when asked", () => {
    const username = generateUsername({ ...OPTIONS, includeNumber: false });

    expect(username).not.toMatch(/\d/);
  });

  it("returns distinct candidates when asked for several", () => {
    const usernames = generateUsernames(4, OPTIONS);

    expect(usernames).toHaveLength(4);
    expect(new Set(usernames).size).toBe(4);
  });
});
