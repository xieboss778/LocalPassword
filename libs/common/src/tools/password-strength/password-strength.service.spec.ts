import { MAX_PASSWORD_STRENGTH_LENGTH, PasswordStrengthService } from "./password-strength.service";

describe("PasswordStrengthService", () => {
  test.each([
    ["password", "random@local.invalid", 0],
    ["password11", "random@local.invalid", 1],
    ["Weakpass2", "random@local.invalid", 2],
    ["GoodPass3!", "random@local.invalid", 3],
    ["VeryStrong123@#", "random@local.invalid", 4],
  ])("getPasswordStrength(%s, %s) should return %i", (password, email, expected) => {
    const service = new PasswordStrengthService();

    const result = service.getPasswordStrength(password, email);

    expect(result.score).toBe(expected);
  });

  it("getPasswordStrength should penalize passwords that contain the email address", () => {
    const service = new PasswordStrengthService();

    const resultWithoutEmail = service.getPasswordStrength("asdfjkhkjwer!", "random@local.invalid");
    expect(resultWithoutEmail.score).toBe(4);

    const result = service.getPasswordStrength("asdfjkhkjwer!", "asdfjkhkjwer@local.invalid");
    expect(result.score).toBe(1);
  });

  describe("oversized passwords", () => {
    // Build a deterministic, non-repeating high-entropy string (like a cert/key/JWT pasted into a
    // password field). A short repeating pattern would be detected by zxcvbn and score weak, which
    // is not what we want to exercise here.
    const buildHighEntropy = (length: number): string => {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      let value = "";
      let state = 12345;
      for (let i = 0; i < length; i++) {
        // Linear congruential generator — long period, so no short repeat for zxcvbn to catch.
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        value += alphabet[state % alphabet.length];
      }
      return value;
    };

    // Longer than the scored cap. zxcvbn is ~O(n²), so scoring the full length freezes the tab.
    const oversizedPassword = buildHighEntropy(MAX_PASSWORD_STRENGTH_LENGTH * 4);

    it("scores an oversized high-entropy password as strong without hanging", () => {
      const service = new PasswordStrengthService();

      const start = Date.now();
      const result = service.getPasswordStrength(oversizedPassword);
      const elapsedMs = Date.now() - start;

      expect(result.score).toBe(4);
      // Bounded work: full-length scoring took seconds in the bug report; the cap keeps it trivial.
      expect(elapsedMs).toBeLessThan(1000);
    });

    it("scores only the first MAX_PASSWORD_STRENGTH_LENGTH characters", () => {
      const service = new PasswordStrengthService();
      const prefix = oversizedPassword.substring(0, MAX_PASSWORD_STRENGTH_LENGTH);

      const oversizedResult = service.getPasswordStrength(oversizedPassword);
      const prefixResult = service.getPasswordStrength(prefix);

      // Truncation means appending more characters beyond the cap cannot change the result.
      expect(oversizedResult.score).toBe(prefixResult.score);
      expect(oversizedResult.guesses).toBe(prefixResult.guesses);
    });

    it("leaves passwords at or under the cap unchanged", () => {
      const service = new PasswordStrengthService();
      const atCap = buildHighEntropy(MAX_PASSWORD_STRENGTH_LENGTH); // exactly the cap length

      expect(atCap.length).toBe(MAX_PASSWORD_STRENGTH_LENGTH);
      // Weak short password still scores weak — the cap does not alter normal-length scoring.
      expect(service.getPasswordStrength("password").score).toBe(0);
      expect(service.getPasswordStrength(atCap).score).toBe(4);
    });
  });
});
