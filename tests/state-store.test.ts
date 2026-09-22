import { describe, expect, test } from "bun:test";
import { PaperPortfolio } from "../src/portfolio.js";
import {
  createPosition,
  applyVirtualSell,
  updatePosition,
} from "../src/position.js";
import { meetsMinLiquidity } from "../src/position-manager.js";
import {
  getScannerState,
  setScannerState,
} from "../src/pool-scanner.js";
import {
  deserializePosition,
  serializePosition,
} from "../src/state-store.js";

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

describe("State persistence", () => {
  test("position survives serialize/deserialize with exact bigint quantities", () => {
    const position = makePosition("persist-1", 10);
    updatePosition(position, 2);

    const restored = deserializePosition(
      JSON.parse(JSON.stringify(serializePosition(position))),
    );

    expect(restored.initialQuantityRaw).toBe(position.initialQuantityRaw);
    expect(restored.remainingQuantityRaw).toBe(
      position.remainingQuantityRaw,
    );
    expect(restored.currentPrice).toBe(2);
    expect(typeof restored.initialQuantityRaw).toBe("bigint");
  });

  test("portfolio export/restore keeps cash and open positions", () => {
    const before = new PaperPortfolio(100);
    const position = makePosition("persist-2", 10);
    before.openPosition(position);

    const after = new PaperPortfolio(100);
    after.restoreState(
      before.getCashBalance(),
      before.exportPositions().map((p) =>
        deserializePosition(JSON.parse(JSON.stringify(serializePosition(p)))),
      ),
    );

    expect(after.getCashBalance()).toBeCloseTo(90, 10);
    expect(after.getOpenPositions()).toHaveLength(1);
    expect(after.getOpenPositions()[0]?.id).toBe("persist-2");
  });

  test("closed positions restore with win stats intact", () => {
    const before = new PaperPortfolio(100);
    const position = makePosition("persist-3", 10);
    before.openPosition(position);
    updatePosition(position, 2);
    applyVirtualSell(position, {
      quantityRaw: position.remainingQuantityRaw,
      grossProceeds: 20,
      networkFee: 0,
      exitPrice: 2,
      reason: "take_profit",
      close: true,
    });
    before.creditSale(20, 0);

    const after = new PaperPortfolio(100);
    after.restoreState(
      before.getCashBalance(),
      before.exportPositions().map((p) =>
        deserializePosition(JSON.parse(JSON.stringify(serializePosition(p)))),
      ),
    );

    expect(after.getStats().closedPositions).toBe(1);
    expect(after.getStats().wins).toBe(1);
    expect(after.getCashBalance()).toBeCloseTo(110, 10);
  });

  test("scanner state round-trips", () => {
    const saved = getScannerState();
    try {
      setScannerState({
        seenPools: ["pool-a", "pool-b"],
        seenTokens: ["token-a"],
        baselinedSources: ["coingecko", "dexpaprika"],
      });
      const state = getScannerState();
      expect(state.seenPools).toHaveLength(2);
      expect(state.seenTokens).toHaveLength(1);
      expect(state.baselinedSources).toEqual(
        expect.arrayContaining(["coingecko", "dexpaprika"]),
      );
    } finally {
      setScannerState(saved);
    }
  });
});

describe("Min liquidity gate", () => {
  test("blocks thin pools, allows null as zero", () => {
    expect(meetsMinLiquidity(6000, 10000)).toBe(false);
    expect(meetsMinLiquidity(10000, 10000)).toBe(true);
    expect(meetsMinLiquidity(55000, 10000)).toBe(true);
    expect(meetsMinLiquidity(null, 10000)).toBe(false);
    expect(meetsMinLiquidity(undefined, 10000)).toBe(false);
  });

  test("zero minimum disables the gate", () => {
    expect(meetsMinLiquidity(0, 0)).toBe(true);
    expect(meetsMinLiquidity(null, 0)).toBe(true);
  });
});
