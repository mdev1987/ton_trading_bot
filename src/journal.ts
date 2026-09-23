/**
 * Closed-trade journal.
 *
 * Every closed paper position appends one CSV row. After 20-30 trades this
 * answers which discovery source, liquidity band, and entry-gap slice actually
 * makes money, instead of tuning on gut feel.
 *
 * The writer never throws: a full disk must not take down the trading loop.
 * Callers treat a false return as "logged to console only".
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Position } from "./position.js";

export const CLOSED_TRADES_CSV_HEADER =
  "closed_at,id,symbol,token_address,source,discovery_pool,exec_pool," +
  "entry_ref,entry_exec,entry_gap_pct,entry_liquidity_usd,cost_gram," +
  "exit_reason,exit_price,hold_minutes,realized_pnl_gram,total_pnl_gram,pnl_pct";

/** UTC day stamp (YYYY-MM-DD) used by the daily loss guard. */
export function utcDayString(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function num(value: number | null | undefined): string {
  return Number.isFinite(value) ? String(value) : "";
}

/** One CSV row for a closed position (no trailing newline). */
export function closedTradeCsvRow(position: Position): string {
  const holdMinutes =
    position.closedAt !== null
      ? ((position.closedAt - position.openedAt) / 60_000).toFixed(1)
      : "";

  return [
    position.closedAt !== null
      ? new Date(position.closedAt).toISOString()
      : "",
    csvEscape(position.id),
    csvEscape(position.baseSymbol),
    csvEscape(position.tokenAddress),
    csvEscape(position.source ?? ""),
    csvEscape(position.discoveryPoolAddress),
    csvEscape(position.pairAddress),
    num(position.referenceEntryPrice),
    num(position.executionEntryPrice),
    num(position.entryGapPct),
    num(position.entryLiquidityUsd),
    num(position.initialCost),
    position.exitReason ?? "",
    num(position.exitPrice),
    holdMinutes,
    num(position.realizedPnl),
    num(position.totalPnl),
    num(position.pnlPercent),
  ].join(",");
}

/**
 * Append a closed position to the journal CSV, creating the file (with
 * header) on first use. Returns true on success, false on any I/O failure.
 */
export function appendClosedTrade(
  filePath: string,
  position: Position,
): boolean {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    if (!existsSync(filePath)) {
      appendFileSync(filePath, `${CLOSED_TRADES_CSV_HEADER}\n`, "utf8");
    }
    appendFileSync(filePath, `${closedTradeCsvRow(position)}\n`, "utf8");
    return true;
  } catch (error) {
    console.error(
      "❌ Journal append failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
