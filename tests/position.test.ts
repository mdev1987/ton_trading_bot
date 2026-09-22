import { describe, expect, test } from "bun:test";
import {
  applyVirtualSell,
  createPosition,
  getHardStopPrice,
  getTakeProfitPrice,
  getTakeProfitQuantityRaw,
  getTrailingActivationPrice,
  getTrailingStopPrice,
  updatePosition,
} from "../src/position.js";

function makePosition() {
  return createPosition({
    id: "test-1",
    discoveryPoolAddress: "DISCOVERY-PAIR",
    pairAddress: "PAIR",
    tokenAddress: "TOKEN",
    tokenDecimals: 9,
    baseSymbol: "TEST",
    quoteSymbol: "GRAM",
    referenceEntryPrice: 1,
    executionEntryPrice: 1,
    quoteAmount: 100,
    receivedQuantity: 100,
    receivedQuantityRaw: 100_000_000_000n,
    takeProfits: [
      { profitPercent: 30, sellPercent: 25, triggered: false },
      { profitPercent: 100, sellPercent: 100, triggered: false },
    ],
    hardStopLossPercent: 15,
    trailingActivationPercent: 40,
    trailingDistancePercent: 15,
  });
}

describe("Position engine", () => {
  test("uses execution entry price as the authoritative trigger price", () => {
    const position = makePosition();

    expect(position.discoveryPoolAddress).toBe("DISCOVERY-PAIR");
    expect(position.pairAddress).toBe("PAIR");

    expect(getTakeProfitPrice(position, 30)).toBe(1.3);
    expect(getHardStopPrice(position)).toBe(0.85);
    expect(getTrailingActivationPrice(position)).toBe(1.4);
  });

  test("updates price movement and PnL", () => {
    const position = makePosition();

    updatePosition(position, 1.3);

    expect(position.priceChangePercent).toBeCloseTo(30, 10);
    expect(position.unrealizedPnl).toBeCloseTo(30, 10);
    expect(position.totalPnl).toBeCloseTo(30, 10);
  });

  test("calculates a 25% raw TP quantity exactly", () => {
    const position = makePosition();
    const quantity = getTakeProfitQuantityRaw(
      position,
      position.takeProfits[0]!,
    );

    expect(quantity).toBe(25_000_000_000n);
  });

  test("trailing stop follows the highest observed price", () => {
    const position = makePosition();

    updatePosition(position, 1.4);
    position.trailingActive = true;

    updatePosition(position, 1.6);

    expect(position.highestPrice).toBe(1.6);
    expect(getTrailingStopPrice(position)).toBeCloseTo(1.36, 10);
  });

  test("closing a position updates state and net PnL", () => {
    const position = makePosition();

    updatePosition(position, 1.5);

    applyVirtualSell(position, {
      quantityRaw: 100_000_000_000n,
      grossProceeds: 150,
      networkFee: 0.1,
      exitPrice: 1.5,
      reason: "take_profit",
      close: true,
      closedAt: 2_000,
    });

    expect(position.isOpen).toBe(false);
    expect(position.remainingQuantityRaw).toBe(0n);
    expect(position.closedAt).toBe(2_000);
    expect(position.exitReason).toBe("take_profit");
    expect(position.realizedPnl).toBeCloseTo(49.9, 10);
    expect(position.totalPnl).toBeCloseTo(49.9, 10);
  });
});
