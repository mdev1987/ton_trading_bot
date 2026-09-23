import { describe, expect, test } from "bun:test";
import {
  applyVirtualSell,
  createPosition,
  dayRealizedPnl,
  entryGapPercent,
  lossGuardTripped,
  type Position,
} from "../src/position.js";
import { statsMarkdown } from "../src/reporter.js";

function makePosition(id: string, symbol: string, source: string): Position {
  return createPosition({
    id,
    discoveryPoolAddress: `DISCOVERY-${id}`,
    pairAddress: `PAIR-${id}`,
    tokenAddress: `TOKEN-${id}`,
    tokenDecimals: 9,
    baseSymbol: symbol,
    quoteSymbol: "GRAM",
    referenceEntryPrice: 1,
    executionEntryPrice: 1,
    quoteAmount: 10,
    receivedQuantity: 10,
    receivedQuantityRaw: 10_000_000_000n,
    source,
    entryLiquidityUsd: 12_000,
    entryGapPct: 1.5,
    takeProfits: [{ profitPercent: 30, sellPercent: 25, triggered: false }],
    hardStopLossPercent: 15,
    trailingActivationPercent: 40,
    trailingDistancePercent: 15,
  });
}

function close(position: Position, grossProceeds: number): Position {
  applyVirtualSell(position, {
    quantityRaw: position.remainingQuantityRaw,
    grossProceeds,
    networkFee: 0,
    exitPrice: grossProceeds / 10,
    reason: "take_profit",
    close: true,
  });
  return position;
}

describe("Entry and loss-guard risk math", () => {
  test("entryGapPercent measures fill vs reference", () => {
    expect(entryGapPercent(1.045, 1)).toBeCloseTo(4.5, 10);
    expect(entryGapPercent(0.99, 1)).toBeCloseTo(-1, 10);
    expect(entryGapPercent(1, 1)).toBe(0);
    expect(() => entryGapPercent(1, 0)).toThrow();
  });

  test("loss guard trips exactly at the daily limit", () => {
    expect(lossGuardTripped(dayRealizedPnl(-50, 0), 50)).toBe(true);
    expect(lossGuardTripped(dayRealizedPnl(-49.99, 0), 50)).toBe(false);
    // Day baseline isolates history: -0.5 carried in is not today's loss.
    expect(lossGuardTripped(dayRealizedPnl(-0.5, -0.5), 50)).toBe(false);
    // Non-positive limit disables the guard.
    expect(lossGuardTripped(-1000, 0)).toBe(false);
  });
});

describe("Trade stats report", () => {
  test("empty book reports no closed trades", () => {
    expect(statsMarkdown([])).toContain("No closed trades yet");
  });

  test("winrate and source breakdowns come from closed trades only", () => {
    const win = close(makePosition("s-1", "A", "dexpaprika"), 13);
    const loss = close(makePosition("s-2", "B", "coingecko"), 8);
    const open = makePosition("s-3", "C", "dexpaprika");

    const text = statsMarkdown([win, loss, open]);

    expect(text).toContain("Closed Trades:** 2");
    expect(text).toContain("Wins / Losses:** 1 / 1");
    expect(text).toContain("dexpaprika: 1W/0L");
    expect(text).toContain("coingecko: 0W/1L");
    expect(text).toContain("take_profit: 2");
  });
});
