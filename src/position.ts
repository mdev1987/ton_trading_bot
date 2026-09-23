/**
 * Pure paper-position state and risk logic.
 *
 * This module intentionally contains no network calls. Market prices are
 * supplied by the position manager and actual paper SELL proceeds are
 * supplied by the execution adapter after a DeDust quote.
 */

export interface TakeProfitLevel {
  /** Price increase from execution entry required to trigger the level. */
  profitPercent: number;
  /** Percentage of remaining quantity to sell when triggered. */
  sellPercent: number;
  /** Whether the level has already executed. */
  triggered: boolean;
}

export type ExitReason =
  | "take_profit"
  | "trailing_stop"
  | "hard_stop_loss"
  | "manual"
  | "error";

export interface Position {
  id: string;
  /** CoinGecko pool that generated the discovery event. */
  discoveryPoolAddress: string;

  /** Actual DeDust execution/market pool used by the position. */
  pairAddress: string;
  tokenAddress: string;
  tokenDecimals: number;
  baseSymbol: string;
  quoteSymbol: string;

  openedAt: number;
  closedAt: number | null;

  referenceEntryPrice: number;
  executionEntryPrice: number;

  /** Discovery source that produced the pool ("coingecko" | "dexpaprika"). */
  source: string | undefined;
  /** Discovery-reported pool liquidity USD at entry. */
  entryLiquidityUsd: number | null | undefined;
  /** (exec - ref) / ref * 100 at entry; positive means paid up. */
  entryGapPct: number | undefined;

  initialCost: number;
  entryNetworkFee: number;
  initialQuantity: number;
  initialQuantityRaw: bigint;
  remainingQuantity: number;
  remainingQuantityRaw: bigint;

  currentPrice: number;
  highestPrice: number;

  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  pnlPercent: number;
  priceChangePercent: number;

  takeProfits: TakeProfitLevel[];

  hardStopLossPercent: number;
  hardStopTriggered: boolean;

  trailingActivationPercent: number;
  trailingDistancePercent: number;
  trailingActive: boolean;
  trailingStopPrice: number | null;
  trailingTriggered: boolean;

  isOpen: boolean;
  exitReason: ExitReason | null;
  exitPrice: number | null;
  exitNetworkFee: number;
}

export interface CreatePositionParams {
  id: string;
  discoveryPoolAddress: string;
  pairAddress: string;
  tokenAddress: string;
  tokenDecimals: number;
  baseSymbol: string;
  quoteSymbol: string;

  referenceEntryPrice: number;
  executionEntryPrice: number;

  source?: string;
  entryLiquidityUsd?: number | null;
  entryGapPct?: number;

  quoteAmount: number;
  receivedQuantity: number;
  receivedQuantityRaw: bigint;

  entryNetworkFee?: number;
  openedAt?: number;
  takeProfits: TakeProfitLevel[];
  hardStopLossPercent: number;
  trailingActivationPercent: number;
  trailingDistancePercent: number;
}

/** Create a position from a completed paper BUY quote. */
export function createPosition(params: CreatePositionParams): Position {
  if (!params.id) throw new Error("Position id is required.");
  if (!params.discoveryPoolAddress) {
    throw new Error("Discovery pool address is required.");
  }
  if (!params.pairAddress) throw new Error("Pair address is required.");
  if (!params.tokenAddress) throw new Error("Token address is required.");
  if (!Number.isInteger(params.tokenDecimals) || params.tokenDecimals < 0) {
    throw new Error("Token decimals must be a non-negative integer.");
  }
  if (!Number.isFinite(params.referenceEntryPrice) || params.referenceEntryPrice <= 0) {
    throw new Error("Reference entry price must be greater than zero.");
  }
  if (!Number.isFinite(params.executionEntryPrice) || params.executionEntryPrice <= 0) {
    throw new Error("Execution entry price must be greater than zero.");
  }
  if (!Number.isFinite(params.quoteAmount) || params.quoteAmount <= 0) {
    throw new Error("Quote amount must be greater than zero.");
  }
  if (!Number.isFinite(params.receivedQuantity) || params.receivedQuantity <= 0) {
    throw new Error("Received quantity must be greater than zero.");
  }
  if (params.receivedQuantityRaw <= 0n) {
    throw new Error("Received raw quantity must be greater than zero.");
  }

  // The quoted quantity is authoritative. Recalculate the effective price so
  // the position exactly reflects the virtual execution result.
  const effectiveExecutionPrice =
    params.quoteAmount / params.receivedQuantity;

  return {
    id: params.id,
    discoveryPoolAddress: params.discoveryPoolAddress,
    pairAddress: params.pairAddress,
    tokenAddress: params.tokenAddress,
    tokenDecimals: params.tokenDecimals,
    baseSymbol: params.baseSymbol,
    quoteSymbol: params.quoteSymbol,

    openedAt: params.openedAt ?? Date.now(),
    closedAt: null,

    referenceEntryPrice: params.referenceEntryPrice,
    executionEntryPrice: effectiveExecutionPrice,

    source: params.source,
    entryLiquidityUsd: params.entryLiquidityUsd ?? null,
    entryGapPct: params.entryGapPct,

    initialCost: params.quoteAmount,
    entryNetworkFee: params.entryNetworkFee ?? 0,
    initialQuantity: params.receivedQuantity,
    initialQuantityRaw: params.receivedQuantityRaw,
    remainingQuantity: params.receivedQuantity,
    remainingQuantityRaw: params.receivedQuantityRaw,

    currentPrice: effectiveExecutionPrice,
    highestPrice: effectiveExecutionPrice,

    realizedPnl: 0,
    unrealizedPnl: 0,
    totalPnl: 0,
    pnlPercent: 0,
    priceChangePercent: 0,

    takeProfits: params.takeProfits.map((level) => ({
      profitPercent: level.profitPercent,
      sellPercent: level.sellPercent,
      triggered: false,
    })),

    hardStopLossPercent: params.hardStopLossPercent,
    hardStopTriggered: false,

    trailingActivationPercent: params.trailingActivationPercent,
    trailingDistancePercent: params.trailingDistancePercent,
    trailingActive: false,
    trailingStopPrice: null,
    trailingTriggered: false,

    isOpen: true,
    exitReason: null,
    exitPrice: null,
    exitNetworkFee: 0,
  };
}

/** Update mark-to-market state from a DEX Screener price. */
export function updatePosition(position: Position, currentPrice: number): Position {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error("Current price must be greater than zero.");
  }

  position.currentPrice = currentPrice;
  position.highestPrice = Math.max(position.highestPrice, currentPrice);

  position.priceChangePercent =
    ((currentPrice - position.executionEntryPrice) /
      position.executionEntryPrice) *
    100;

  position.unrealizedPnl =
    (currentPrice - position.executionEntryPrice) *
    position.remainingQuantity;

  // Entry network fee is charged once at OPEN and therefore belongs to the
  // position's all-in PnL even though it is not part of the SELL trade PnL.
  position.totalPnl =
    position.realizedPnl +
    position.unrealizedPnl -
    position.entryNetworkFee;
  position.pnlPercent =
    (position.totalPnl / position.initialCost) * 100;

  return position;
}

export function getTakeProfitPrice(
  position: Position,
  profitPercent: number,
): number {
  return position.executionEntryPrice * (1 + profitPercent / 100);
}

export function getHardStopPrice(position: Position): number {
  return position.executionEntryPrice * (1 - position.hardStopLossPercent / 100);
}

export function getTrailingActivationPrice(position: Position): number {
  return position.executionEntryPrice *
    (1 + position.trailingActivationPercent / 100);
}

export function getTrailingStopPrice(position: Position): number | null {
  if (!position.trailingActive) return null;
  return position.highestPrice *
    (1 - position.trailingDistancePercent / 100);
}

/** Return the first untriggered TP whose exact trigger price was reached. */
export function getTriggeredTakeProfit(
  position: Position,
): TakeProfitLevel | null {
  for (const tp of position.takeProfits) {
    if (tp.triggered) continue;
    if (position.currentPrice >= getTakeProfitPrice(position, tp.profitPercent)) {
      return tp;
    }
  }
  return null;
}

/** Return raw quantity corresponding to a percentage of current holdings. */
export function getTakeProfitQuantityRaw(
  position: Position,
  tp: TakeProfitLevel,
): bigint {
  if (position.remainingQuantityRaw <= 0n) return 0n;
  if (tp.sellPercent >= 100) return position.remainingQuantityRaw;

  // BigInt integer arithmetic avoids floating-point rounding for the raw token
  // balance. Rounding down keeps the paper engine from selling more than held.
  const numerator = position.remainingQuantityRaw * BigInt(Math.round(tp.sellPercent * 10_000));
  const denominator = 1_000_000n;
  const quantity = numerator / denominator;

  return quantity > 0n ? quantity : 1n;
}

/** Mark a TP as completed after its SELL quote has succeeded. */
export function markTakeProfitTriggered(
  position: Position,
  profitPercent: number,
): void {
  const tp = position.takeProfits.find(
    (level) => level.profitPercent === profitPercent,
  );

  if (!tp) {
    throw new Error(`TP ${profitPercent}% not found.`);
  }

  tp.triggered = true;
}

/** Apply proceeds from a completed virtual SELL to the position. */
export function applyVirtualSell(
  position: Position,
  params: {
    quantityRaw: bigint;
    grossProceeds: number;
    networkFee: number;
    exitPrice: number;
    reason: ExitReason;
    close: boolean;
    closedAt?: number;
  },
): void {
  if (!position.isOpen) throw new Error("Position is already closed.");
  if (params.quantityRaw <= 0n) throw new Error("Sell quantity must be positive.");
  if (params.quantityRaw > position.remainingQuantityRaw) {
    throw new Error("Sell quantity exceeds remaining position.");
  }
  if (!Number.isFinite(params.grossProceeds) || params.grossProceeds < 0) {
    throw new Error("Invalid sell proceeds.");
  }
  if (!Number.isFinite(params.networkFee) || params.networkFee < 0) {
    throw new Error("Invalid sell network fee.");
  }
  if (!Number.isFinite(params.exitPrice) || params.exitPrice <= 0) {
    throw new Error("Invalid sell execution price.");
  }

  const fraction = Number(params.quantityRaw) / Number(position.remainingQuantityRaw);
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
    throw new Error("Could not determine sell fraction.");
  }

  // Allocate the original execution cost proportionally to the quantity sold.
  const costBasis = position.initialCost *
    (Number(params.quantityRaw) / Number(position.initialQuantityRaw));

  position.realizedPnl += params.grossProceeds - params.networkFee - costBasis;
  position.remainingQuantityRaw -= params.quantityRaw;
  position.remainingQuantity -= position.initialQuantity * fraction;

  if (position.remainingQuantityRaw === 0n) {
    position.remainingQuantity = 0;
  } else if (position.remainingQuantity < 0) {
    position.remainingQuantity = 0;
  }

  if (params.close || position.remainingQuantityRaw === 0n) {
    position.isOpen = false;
    position.closedAt = params.closedAt ?? Date.now();
    position.exitReason = params.reason;
    position.exitPrice = params.exitPrice;
    position.exitNetworkFee += params.networkFee;
  } else {
    // Partial sells still contribute to cumulative exit fees.
    position.exitNetworkFee += params.networkFee;
  }

  updatePosition(position, position.currentPrice);
}

/** Mark a non-market-data emergency close without inventing proceeds. */
export function markExit(
  position: Position,
  reason: ExitReason,
): void {
  if (!position.isOpen) return;
  position.isOpen = false;
  position.closedAt = Date.now();
  position.exitReason = reason;
}

export function getDurationMs(position: Position, now = Date.now()): number {
  return Math.max(
    0,
    (position.closedAt ?? now) - position.openedAt,
  );
}

/**
 * Entry gap in percent: how far the DeDust execution price landed above
 * (positive) or below (negative) the discovery reference price.
 */
export function entryGapPercent(
  executionPrice: number,
  referencePrice: number,
): number {
  if (
    !Number.isFinite(executionPrice) ||
    !Number.isFinite(referencePrice) ||
    referencePrice <= 0
  ) {
    throw new Error("Invalid prices for entry gap.");
  }
  return ((executionPrice - referencePrice) / referencePrice) * 100;
}

/** Realized PnL earned since the start of the current UTC day. */
export function dayRealizedPnl(
  realizedPnl: number,
  dayStartRealized: number,
): number {
  return realizedPnl - dayStartRealized;
}

/**
 * Daily loss kill-switch predicate. A non-positive limit disables the guard.
 */
export function lossGuardTripped(
  dayPnl: number,
  maxDailyLossGram: number,
): boolean {
  if (!(maxDailyLossGram > 0)) return false;
  return dayPnl <= -maxDailyLossGram;
}
