import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendClosedTrade,
  CLOSED_TRADES_CSV_HEADER,
  closedTradeCsvRow,
  utcDayString,
} from "../src/journal.js";
import {
  applyVirtualSell,
  createPosition,
  type Position,
} from "../src/position.js";

function makeClosedPosition(
  id: string,
  symbol: string,
  source: string,
  grossProceeds: number,
): Position {
  const position = createPosition({
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

describe("Trade journal", () => {
  test("CSV row has exactly one field per header column", () => {
    const position = makeClosedPosition("j-1", "LABUBU", "dexpaprika", 13);

    const headerCols = CLOSED_TRADES_CSV_HEADER.split(",");
    const rowCols = closedTradeCsvRow(position).split(",");

    expect(rowCols.length).toBe(headerCols.length);
    expect(closedTradeCsvRow(position)).toContain("dexpaprika");
    expect(closedTradeCsvRow(position)).toContain("take_profit");
  });

  test("append creates the file with header once and adds rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "journal-"));
    try {
      const file = join(dir, "closed-trades.csv");

      expect(appendClosedTrade(file, makeClosedPosition("j-2", "A", "coingecko", 13))).toBe(true);
      expect(appendClosedTrade(file, makeClosedPosition("j-3", "B", "dexpaprika", 8))).toBe(true);

      const lines = readFileSync(file, "utf8").trim().split("\n");
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe(CLOSED_TRADES_CSV_HEADER);
      expect(lines[1]).toContain("j-2");
      expect(lines[2]).toContain("j-3");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("utcDayString follows YYYY-MM-DD in UTC", () => {
    expect(utcDayString(Date.UTC(2026, 8, 22, 23, 59))).toBe("2026-09-22");
    expect(utcDayString(Date.UTC(2026, 8, 23, 0, 0))).toBe("2026-09-23");
  });
});
