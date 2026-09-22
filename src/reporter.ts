/**
 * Reporting formatter.
 *
 * Application messages are written as ordinary Markdown first. Telegram
 * transport converts the message to MarkdownV2 at the final boundary.
 */

import { convert } from "telegram-markdown-v2";
import type { ExecutionQuote } from "./execution.js";
import type { ExitReason, Position } from "./position.js";
import type { PortfolioStats } from "./portfolio.js";

export interface OpenReportContext {
  beforeBalance: number;
  afterBalance: number;
  stats: PortfolioStats;
  quote: ExecutionQuote;
  position: Position;
}

export interface PartialReportContext {
  beforeBalance: number;
  afterBalance: number;
  stats: PortfolioStats;
  quote: ExecutionQuote;
  position: Position;
  triggerPercent: number;
  soldQuantity: number;
  grossProceeds: number;
  networkFee: number;
  tradePnl: number;
}

export interface CloseReportContext {
  beforeBalance: number;
  afterBalance: number;
  stats: PortfolioStats;
  quote: ExecutionQuote;
  position: Position;
  grossProceeds: number;
  networkFee: number;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function duration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function reasonLabel(reason: ExitReason | null): string {
  switch (reason) {
    case "take_profit": return "🎯 Take Profit";
    case "trailing_stop": return "🔒 Trailing Stop";
    case "hard_stop_loss": return "🛑 Hard Stop Loss";
    case "manual": return "🖐 Manual";
    case "error": return "⚠️ Error";
    default: return "—";
  }
}

/** Telegram-safe MarkdownV2 payload. */
export function toTelegramMarkdown(markdown: string): string {
  return convert(markdown);
}

/** Format an OPEN report with all required paper-account fields. */
export function positionOpenedMarkdown(
  context: OpenReportContext,
): string {
  const { position, quote, stats } = context;

  return `### 🟢 POSITION OPENED

` +
    `**${position.baseSymbol}/${position.quoteSymbol}**\n` +
    `- **Size:** ${position.initialCost.toFixed(4)} ${position.quoteSymbol}\n` +
    `- **Entry:** ${position.executionEntryPrice.toFixed(12)} ${position.quoteSymbol}\n` +
    `- **Market Ref:** ${position.referenceEntryPrice.toFixed(12)} ${position.quoteSymbol}\n` +
    `- **Received:** ${quote.amountOut} ${position.baseSymbol}\n` +
    `- **Router:** ${quote.routerProtocol ?? "DeDust"}\n` +
    `- **Discovery Pool:** ${position.discoveryPoolAddress}\n` +
    `- **Execution Pool:** ${position.pairAddress}\n` +
    `- **Network Fee:** ${position.entryNetworkFee.toFixed(4)} ${position.quoteSymbol}\n` +
    `- **Dynamic TP:** ${position.takeProfits.map((x) => `+${x.profitPercent}% → ${x.sellPercent}%`).join(" · ")}\n` +
    `- **Hard SL:** -${position.hardStopLossPercent}%\n` +
    `- **Trailing SL:** +${position.trailingActivationPercent}% activation / ${position.trailingDistancePercent}% distance\n\n` +
    `💼 **Paper Balance**\n` +
    `- Before: ${context.beforeBalance.toFixed(4)} ${position.quoteSymbol}\n` +
    `- After: ${context.afterBalance.toFixed(4)} ${position.quoteSymbol}\n\n` +
    `📊 **Portfolio**\n` +
    `- Open Positions: ${stats.openPositions}\n` +
    `- Total Positions: ${stats.totalPositions}\n` +
    `- Winrate: ${stats.winrate.toFixed(2)}%\n` +
    `- PnL: ${signed(stats.totalPnl)} ${position.quoteSymbol}`;
}

/** Format a partial dynamic-TP report. */
export function takeProfitMarkdown(
  context: PartialReportContext,
): string {
  const { position, quote, stats } = context;

  return `### 🎯 PARTIAL TAKE PROFIT

` +
    `**${position.baseSymbol}/${position.quoteSymbol}**\n` +
    `- **Trigger:** +${context.triggerPercent.toFixed(0)}%\n` +
    `- **Sold:** ${context.soldQuantity.toFixed(6)} ${position.baseSymbol}\n` +
    `- **Exit Price:** ${quote.executionPrice.toFixed(12)} ${position.quoteSymbol}\n` +
    `- **Discovery Pool:** ${position.discoveryPoolAddress}\n` +
    `- **Execution Pool:** ${position.pairAddress}\n` +
    `- **Gross Proceeds:** ${context.grossProceeds.toFixed(6)} ${position.quoteSymbol}\n` +
    `- **Network Fee:** ${context.networkFee.toFixed(4)} ${position.quoteSymbol}\n` +
    `- **Next TP:** ${position.takeProfits.filter((x) => !x.triggered).map((x) => `+${x.profitPercent}% → ${x.sellPercent}%`).join(" · ") || "none"}\n` +
    `- **Trade PnL:** ${signed(context.tradePnl)} ${position.quoteSymbol}\n` +
    `- **Position PnL:** ${signed(position.totalPnl)} ${position.quoteSymbol}\n` +
    `- **Balance:** ${context.beforeBalance.toFixed(4)} → ${context.afterBalance.toFixed(4)} ${position.quoteSymbol}\n\n` +
    `📊 Open: ${stats.openPositions} · Total: ${stats.totalPositions} · Winrate: ${stats.winrate.toFixed(2)}%`;
}

/** Format a final close report. */
export function positionClosedMarkdown(
  context: CloseReportContext,
): string {
  const { position, quote, stats } = context;
  const durationMs = position.closedAt
    ? position.closedAt - position.openedAt
    : 0;
  const emoji = position.totalPnl >= 0 ? "✅" : "🔴";

  return `### ${emoji} POSITION CLOSED

` +
    `**${position.baseSymbol}/${position.quoteSymbol}**\n` +
    `- **Exit Reason:** ${reasonLabel(position.exitReason)}\n` +
    `- **Entry:** ${position.executionEntryPrice.toFixed(12)} ${position.quoteSymbol}\n` +
    `- **Exit:** ${quote.executionPrice.toFixed(12)} ${position.quoteSymbol}\n` +
    `- **Duration:** ${duration(durationMs)}\n` +
    `- **Proceeds:** ${context.grossProceeds.toFixed(6)} ${position.quoteSymbol}\n` +
    `- **Network Fee:** ${context.networkFee.toFixed(4)} ${position.quoteSymbol}\n` +
    `- **Dynamic TP:** ${position.takeProfits.map((x) => `+${x.profitPercent}% → ${x.sellPercent}%`).join(" · ")}\n` +
    `- **Hard SL:** -${position.hardStopLossPercent}%\n` +
    `- **Trailing SL:** +${position.trailingActivationPercent}% activation / ${position.trailingDistancePercent}% distance\n` +
    `- **PnL:** ${signed(position.totalPnl)} ${position.quoteSymbol}\n` +
    `- **PnL %:** ${position.pnlPercent.toFixed(2)}%\n\n` +
    `💼 **Paper Balance**\n` +
    `- Before: ${context.beforeBalance.toFixed(4)} ${position.quoteSymbol}\n` +
    `- After: ${context.afterBalance.toFixed(4)} ${position.quoteSymbol}\n\n` +
    `📊 **Performance**\n` +
    `- Open Positions: ${stats.openPositions}\n` +
    `- Total Positions: ${stats.totalPositions}\n` +
    `- Winrate: ${stats.winrate.toFixed(2)}%\n` +
    `- Portfolio PnL: ${signed(stats.totalPnl)} ${position.quoteSymbol}`;
}

export function statusMarkdown(stats: PortfolioStats): string {
  return `### 📊 PAPER PORTFOLIO

` +
    `- **Cash:** ${stats.cashBalance.toFixed(4)} GRAM\n` +
    `- **Market Value:** ${stats.marketValue.toFixed(4)} GRAM\n` +
    `- **Equity:** ${stats.equity.toFixed(4)} GRAM\n` +
    `- **PnL:** ${signed(stats.totalPnl)} GRAM (${stats.totalPnlPercent.toFixed(2)}%)\n` +
    `- **Realized:** ${signed(stats.realizedPnl)} GRAM\n` +
    `- **Unrealized:** ${signed(stats.unrealizedPnl)} GRAM\n` +
    `- **Open Positions:** ${stats.openPositions}\n` +
    `- **Total Positions:** ${stats.totalPositions}\n` +
    `- **Wins / Losses:** ${stats.wins} / ${stats.losses}\n` +
    `- **Winrate:** ${stats.winrate.toFixed(2)}%`;
}

export function positionsMarkdown(positions: Position[]): string {
  if (positions.length === 0) {
    return "### 📂 POSITIONS\n\n_No positions yet._";
  }

  const lines = positions.slice(0, 20).map((position) => {
    const state = position.isOpen ? "🟢 OPEN" : "⚪ CLOSED";
    return `${state} **${position.baseSymbol}** · PnL ${signed(position.totalPnl)} GRAM · ` +
      `Entry ${position.executionEntryPrice.toFixed(8)} · Current ${position.currentPrice.toFixed(8)}`;
  });

  return `### 📂 POSITIONS\n\n${lines.join("\n")}`;
}
