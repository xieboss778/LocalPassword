import { GENERATOR_HISTORY_MASK, splitPasswordSyntax } from "./lp-password-syntax.component";

describe("GENERATOR_HISTORY_MASK", () => {
  it("uses sixteen bullets so the mask does not reveal the value length", () => {
    expect([...GENERATOR_HISTORY_MASK]).toHaveLength(16);
    expect(GENERATOR_HISTORY_MASK).toMatch(/^•+$/);
  });
});

describe("splitPasswordSyntax", () => {
  it("classifies digits, symbols and letters without changing order", () => {
    expect(splitPasswordSyntax("a1!B").map((segment) => segment.kind)).toEqual([
      "plain",
      "digit",
      "symbol",
      "plain",
    ]);
    expect(
      splitPasswordSyntax("a1!B")
        .map((segment) => segment.char)
        .join(""),
    ).toBe("a1!B");
  });

  it("treats spaces and punctuation as symbols", () => {
    expect(splitPasswordSyntax("a b-").map((segment) => segment.kind)).toEqual([
      "plain",
      "symbol",
      "plain",
      "symbol",
    ]);
  });

  it("handles an empty value", () => {
    expect(splitPasswordSyntax("")).toEqual([]);
  });
});
