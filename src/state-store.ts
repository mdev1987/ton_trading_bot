/**
 * File-backed persistence for paper state.
 *
 * The bot keeps everything in memory (portfolio ledger, seen-pool sets,
 * position id counter). Without this module a restart wipes open positions
 * and forces a fresh pool baseline, silently missing the discovery window.
 * main.ts loads on boot, saves on an interval, and saves synchronously on
 * SIGINT/SIGTERM.
 *
 * BigInt raw quantities are serialized as decimal strings; everything else
 * is plain JSON.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Position } from "./position.js";

export type SerializedPosition = Omit<
  Position,
  "initialQuantityRaw" | "remainingQuantityRaw"
> & {
  initialQuantityRaw: string;
  remainingQuantityRaw: string;
};

export interface PersistedStateV1 {
  version: 1;
  cashBalance: number;
  positions: SerializedPosition[];
  seenPools: string[];
  seenTokens: string[];
  scannerInitialized: boolean;
  idCounter: number;
}

export interface PersistedStateV2 {
  version: 2;
  cashBalance: number;
  positions: SerializedPosition[];
  seenPools: string[];
  seenTokens: string[];
  baselinedSources: ("coingecko" | "dexpaprika")[];
  idCounter: number;
}

export interface PersistedState {
  version: 3;
  cashBalance: number;
  positions: SerializedPosition[];
  seenPools: string[];
  seenTokens: string[];
  baselinedSources: ("coingecko" | "dexpaprika")[];
  idCounter: number;
  /** UTC day + realized-PnL baseline for the daily loss guard. */
  lossGuardDay: string;
  lossGuardStartRealized: number;
}

/** Convert a live position to its JSON-safe form. */
export function serializePosition(position: Position): SerializedPosition {
  return {
    ...position,
    initialQuantityRaw: position.initialQuantityRaw.toString(),
    remainingQuantityRaw: position.remainingQuantityRaw.toString(),
  };
}

/** Restore a position from its JSON-safe form. Throws on corrupt fields. */
export function deserializePosition(raw: SerializedPosition): Position {
  return {
    ...raw,
    initialQuantityRaw: BigInt(raw.initialQuantityRaw),
    remainingQuantityRaw: BigInt(raw.remainingQuantityRaw),
  };
}

/** Read persisted state. Returns null when missing or unreadable. */
export function loadState(
  filePath: string,
): PersistedState | PersistedStateV2 | PersistedStateV1 | null {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as
      | PersistedState
      | PersistedStateV2
      | PersistedStateV1;
    if (
      (parsed?.version !== 1 &&
        parsed?.version !== 2 &&
        parsed?.version !== 3) ||
      !Array.isArray(parsed.positions)
    ) {
      console.warn(`⚠️ State file has unknown shape, ignoring: ${filePath}`);
      return null;
    }
    // Validate bigint fields eagerly so corrupt state fails fast on boot
    // instead of mid-run inside the price loop.
    for (const raw of parsed.positions) {
      BigInt(raw.initialQuantityRaw);
      BigInt(raw.remainingQuantityRaw);
    }
    return parsed;
  } catch (error) {
    console.warn(
      `⚠️ Could not parse state file ${filePath}, starting fresh:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function writeAtomic(filePath: string, text: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, text, "utf8");
  renameSync(tmpPath, filePath);
}

/** Synchronous save for signal handlers where awaiting is unreliable. */
export function saveStateSync(filePath: string, state: PersistedState): void {
  writeAtomic(filePath, JSON.stringify(state));
}

/** Async save for the periodic interval. */
export async function saveState(
  filePath: string,
  state: PersistedState,
): Promise<void> {
  saveStateSync(filePath, state);
}
