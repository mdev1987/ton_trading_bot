import { describe, expect, test } from "bun:test";
import { quoteUsesOnlyPool } from "../src/execution.js";
import type { DedustRouterQuote } from "../src/dedust-router.js";

function makeQuote(
  pools: Array<Array<string>>,
): DedustRouterQuote {
  return {
    inAmount: 1n,
    outAmount: 1n,
    swapIsPossible: true,
    priceImpact: null,
    estimatedNetworkFee: 0n,
    routes: pools.map((route) =>
      route.map((poolAddress) => ({
        poolAddress,
      })),
    ),
    raw: {},
  };
}

describe("DeDust execution pool binding", () => {
  test("accepts a quote using exactly the expected pool", () => {
    const quote = makeQuote([["POOL-A"]]);
    expect(quoteUsesOnlyPool(quote, "POOL-A")).toBe(true);
  });

  test("rejects a quote routed through a different pool", () => {
    const quote = makeQuote([["POOL-B"]]);
    expect(quoteUsesOnlyPool(quote, "POOL-A")).toBe(false);
  });

  test("rejects a split/multi-step route containing another pool", () => {
    const quote = makeQuote([["POOL-A", "POOL-A"], ["POOL-A", "POOL-B"]]);
    expect(quoteUsesOnlyPool(quote, "POOL-A")).toBe(false);
  });

  test("rejects route data that does not identify a pool", () => {
    const quote = makeQuote([[]]);
    expect(quoteUsesOnlyPool(quote, "POOL-A")).toBe(false);
  });
});
