/**
 * Paper portfolio ledger.
 *
 * Cash is denominated in GRAM. Positions are marked to DEX Screener's
 * reference price, while realized proceeds come from DeDust SELL quotes.
 */

import type { Position } from "./position.js";

export interface PortfolioStats {
  initialBalance: number;
  cashBalance: number;
  marketValue: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalPnlPercent: number;
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  wins: number;
  losses: number;
  breakeven: number;
  winrate: number;
}

/** In-memory accounting ledger for paper mode. */
export class PaperPortfolio {
  private readonly positions = new Map<string, Position>();
  private cashBalance: number;

  public constructor(private readonly initialBalance: number) {
    if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
      throw new Error("Initial paper balance must be greater than zero.");
    }

    this.cashBalance = initialBalance;
  }

  /** Reserve cash for a new position, including optional entry network fee. */
  public openPosition(position: Position): void {
    if (this.positions.has(position.id)) {
      throw new Error(`Position already exists: ${position.id}`);
    }

    const requiredCash = position.initialCost + position.entryNetworkFee;

    if (requiredCash > this.cashBalance + 1e-12) {
      throw new Error(
        `Insufficient paper balance. Required ${requiredCash.toFixed(9)} GRAM, ` +
          `available ${this.cashBalance.toFixed(9)} GRAM.`,
      );
    }

    this.cashBalance -= requiredCash;
    this.positions.set(position.id, position);
  }

  /** Credit net GRAM proceeds after the virtual SELL network fee. */
  public creditSale(
    grossProceeds: number,
    networkFee: number,
  ): void {
    if (!Number.isFinite(grossProceeds) || grossProceeds < 0) {
      throw new Error("Invalid sale proceeds.");
    }
    if (!Number.isFinite(networkFee) || networkFee < 0) {
      throw new Error("Invalid sale network fee.");
    }

    this.cashBalance += grossProceeds - networkFee;
  }

  /** Return an open position by ID. */
  public getPosition(id: string): Position | undefined {
    return this.positions.get(id);
  }

  /** Return all positions, newest first. */
  public getPositions(): Position[] {
    return [...this.positions.values()].sort(
      (a, b) => b.openedAt - a.openedAt,
    );
  }

  /** Return currently open positions. */
  public getOpenPositions(): Position[] {
    return this.getPositions().filter((position) => position.isOpen);
  }

  public getCashBalance(): number {
    return this.cashBalance;
  }

  /** Export all positions (open + closed) for persistence. */
  public exportPositions(): Position[] {
    return this.getPositions();
  }

  /** Restore cash and positions from persisted state (boot only). */
  public restoreState(cashBalance: number, positions: Position[]): void {
    if (!Number.isFinite(cashBalance) || cashBalance < 0) {
      throw new Error("Invalid persisted cash balance.");
    }
    this.cashBalance = cashBalance;
    this.positions.clear();
    for (const position of positions) {
      if (this.positions.has(position.id)) {
        throw new Error(`Duplicate persisted position: ${position.id}`);
      }
      this.positions.set(position.id, position);
    }
  }

  /** Compute equity and performance metrics from current ledger state. */
  public getStats(): PortfolioStats {
    let marketValue = 0;
    let realizedPnl = 0;
    let unrealizedPnl = 0;
    let openPositions = 0;
    let closedPositions = 0;
    let wins = 0;
    let losses = 0;
    let breakeven = 0;

    for (const position of this.positions.values()) {
      if (position.isOpen) {
        openPositions += 1;
        marketValue += position.remainingQuantity * position.currentPrice;
      } else {
        closedPositions += 1;
      }

      // Entry fee was already removed from paper cash at OPEN, so include it
      // in realized/net position PnL for reporting consistency.
      realizedPnl += position.realizedPnl - position.entryNetworkFee;
      unrealizedPnl += position.unrealizedPnl;

      if (!position.isOpen) {
        const pnl = position.totalPnl;
        if (pnl > 1e-9) wins += 1;
        else if (pnl < -1e-9) losses += 1;
        else breakeven += 1;
      }
    }

    const equity = this.cashBalance + marketValue;
    const totalPnl = equity - this.initialBalance;
    const totalPnlPercent =
      (totalPnl / this.initialBalance) * 100;

    const decisiveClosed = wins + losses;
    const winrate =
      decisiveClosed > 0
        ? (wins / decisiveClosed) * 100
        : 0;

    return {
      initialBalance: this.initialBalance,
      cashBalance: this.cashBalance,
      marketValue,
      equity,
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      totalPnlPercent,
      totalPositions: this.positions.size,
      openPositions,
      closedPositions,
      wins,
      losses,
      breakeven,
      winrate,
    };
  }

  /** Convenience snapshot used by reports before opening a position. */
  public snapshotBalance(): number {
    return this.cashBalance;
  }
}
