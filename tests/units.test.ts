import { describe, expect, test } from "bun:test";
import { formatUnits, parseUnits } from "../src/jetton.js";

describe("Token units", () => {
  test("formats raw units exactly", () => {
    expect(formatUnits(107773058152660n, 9)).toBe("107773.05815266");
  });

  test("parses decimal strings exactly", () => {
    expect(parseUnits("107773.05815266", 9)).toBe(107773058152660n);
  });
});
