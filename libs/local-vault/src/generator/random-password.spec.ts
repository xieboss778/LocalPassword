import {
  DEFAULT_PASSWORD_OPTIONS,
  generatePassword,
  generatePasswords,
  PasswordOptions,
} from "./random-password";

const options = (over: Partial<PasswordOptions> = {}): PasswordOptions => ({
  ...DEFAULT_PASSWORD_OPTIONS,
  ...over,
});

describe("generatePassword", () => {
  it("honours the requested length", () => {
    for (const length of [4, 12, 20, 64, 128]) {
      expect(generatePassword(options({ length }))).toHaveLength(length);
    }
  });

  it("clamps silly lengths", () => {
    expect(generatePassword(options({ length: 1 }))).toHaveLength(4);
    expect(generatePassword(options({ length: 5000 }))).toHaveLength(128);
  });

  it("includes every enabled character class", () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword(options({ length: 12 }));
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("only uses the classes that are enabled", () => {
    const digitsOnly = generatePassword(
      options({ length: 16, upper: false, lower: false, symbols: false }),
    );

    expect(digitsOnly).toMatch(/^[0-9]+$/);
  });

  it("drops easily confused characters when asked", () => {
    for (let i = 0; i < 40; i++) {
      const password = generatePassword(
        options({ length: 32, symbols: false, avoidAmbiguous: true }),
      );
      expect(password).not.toMatch(/[O0Il1o]/);
    }
  });

  it("refuses to generate with no character class", () => {
    expect(() =>
      generatePassword(options({ upper: false, lower: false, digits: false, symbols: false })),
    ).toThrow();
  });
});

describe("generatePasswords", () => {
  it("returns the requested number of distinct passwords", () => {
    const list = generatePasswords(5, options({ length: 24 }));

    expect(list).toHaveLength(5);
    expect(new Set(list).size).toBe(5);
  });

  it("survives an impossible uniqueness request without hanging", () => {
    const list = generatePasswords(
      10,
      options({ length: 4, upper: false, lower: false, symbols: false }),
    );

    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(10);
  });
});
