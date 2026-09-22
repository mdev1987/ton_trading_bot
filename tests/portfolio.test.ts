import { describe, expect, test } from "bun:test";
import { PaperPortfolio } from "../src/portfolio.js";
import { createPosition, applyVirtualSell, updatePosition } from "../src/position.js";

function makePosition(id: string, cost = 10) {
  return createPosition({
    id,
    discoveryPoolAddress: `DISCOVERY-${id}`,
    pairAddress: `PAIR-${id}`,
    tokenAddress: `TOKEN-${id}`,
    tokenDecimals: 9,
    baseSymbol: "TEST",
    quoteSymbol: "GRAM",
    referenceEntryPrice: 1,
    executionEntryPrice: 1,
    quoteAmount: cost,
    receivedQuantity: cost,
    receivedQuantityRaw: BigInt(Math.round(cost * 1e9)),
    takeProfits: [
      { profitPercent: 30, sellPercent: 25, triggered: false },
    ],
    hardStopLossPercent: 15,
    trailingActivationPercent: 40,
    trailingDistancePercent: 15,
  });
}

describe("Paper portfolio", () => {
  test("reserves cash on open and returns it on close", () => {
    const portfolio = new PaperPortfolio(100);
    const position = makePosition("one", 10);

    portfolio.openPosition(position);
    expect(portfolio.getCashBalance()).toBeCloseTo(90, 10);
    expect(portfolio.getStats().openPositions).toBe(1);

    updatePosition(position, 2);
    applyVirtualSell(position, {
      quantityRaw: position.remainingQuantityRaw,
      grossProceeds: 20,
      networkFee: 0,
      exitPrice: 2,
      reason: "take_profit",
      close: true,
    });

    portfolio.creditSale(20, 0);

    expect(portfolio.getCashBalance()).toBeCloseTo(110, 10);
    expect(portfolio.getStats().closedPositions).toBe(1);
    expect(portfolio.getStats().wins).toBe(1);
    expect(portfolio.getStats().winrate).toBe(100);
  });

  test("rejects an over-sized position", () => {
    const portfolio = new PaperPortfolio(5);
    const position = makePosition("big", 10);

    expect(() => portfolio.openPosition(position)).toThrow();
  });
});
