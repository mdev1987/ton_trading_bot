/**
 * TON Paper Trading Bot entry point.
 *
 * Safety boundary:
 * - no wallet
 * - no private key
 * - no transaction signing
 * - no transaction broadcast
 *
 * Paper execution uses live public market/quote APIs only.
 */

import { config } from "./config.js";
import { PaperPortfolio } from "./portfolio.js";
import { TelegramReporter } from "./telegram.js";
import { PositionManager } from "./position-manager.js";
import { runHealthChecks } from "./health.js";
import { runTonCenterSse } from "./toncenter-stream.js";
import { statusMarkdown } from "./reporter.js";
import {
  deserializePosition,
  loadState,
  saveStateSync,
  serializePosition,
  type PersistedState,
} from "./state-store.js";
import {
  getScannerState,
  setScannerState,
} from "./pool-scanner.js";

console.log("================================");
console.log(" TON PAPER TRADING BOT");
console.log("================================");
console.log(`Version         : 2.0.1`);
console.log(`Mode            : ${config.mode}`);
console.log(`Paper Balance   : ${config.paperInitialBalance} GRAM`);
console.log(`Position Size   : ${config.positionSize} GRAM`);
console.log(`Max Open        : ${config.maxOpenPositions}`);
console.log(`TP              : ${config.takeProfits.map((x) => `${x.profitPercent}%/${x.sellPercent}%`).join(", ")}`);
console.log(`Hard SL         : -${config.hardStopLossPercent}%`);
console.log(`Trailing        : +${config.trailingActivationPercent}% / ${config.trailingDistancePercent}%`);
console.log(`Auto Buy        : ${config.paperAutoBuy ? "ON" : "OFF"}`);
console.log(`Telegram        : ${config.telegramEnabled && config.telegramBotToken ? "ON" : "OFF"}`);
console.log("================================");

await runHealthChecks();

const portfolio = new PaperPortfolio(config.paperInitialBalance);
const telegram = new TelegramReporter(portfolio);
const manager = new PositionManager(portfolio, telegram);
const abortController = new AbortController();

function snapshotState(): PersistedState {
  const scanner = getScannerState();
  return {
    version: 2,
    cashBalance: portfolio.getCashBalance(),
    positions: portfolio.exportPositions().map(serializePosition),
    seenPools: scanner.seenPools,
    seenTokens: scanner.seenTokens,
    baselinedSources: scanner.baselinedSources,
    idCounter: manager.getIdCounter(),
  };
}

function persistState(reason: string): void {
  try {
    saveStateSync(config.stateFile, snapshotState());
  } catch (error) {
    console.error(
      `❌ State save failed (${reason}):`,
      error instanceof Error ? error.message : error,
    );
  }
}

const restored = loadState(config.stateFile);
if (restored) {
  try {
    // v1 predates DexPaprika: a v1 baseline only covers CoinGecko, so the
    // DexPaprika source baselines silently on its first poll instead of
    // firing one event per pool in its lookback.
    const baselinedSources =
      restored.version === 2
        ? restored.baselinedSources
        : restored.scannerInitialized
          ? (["coingecko"] as const)
          : [];
    portfolio.restoreState(
      restored.cashBalance,
      restored.positions.map(deserializePosition),
    );
    setScannerState({
      seenPools: restored.seenPools,
      seenTokens: restored.seenTokens,
      baselinedSources: [...baselinedSources],
    });
    manager.setIdCounter(restored.idCounter);
    const openCount = portfolio.getOpenPositions().length;
    console.log(
      `💾 Restored paper state: ${restored.positions.length} positions (${openCount} open), ` +
        `${restored.seenPools.length} pools seen`,
    );
  } catch (error) {
    console.error(
      "❌ Persisted state is corrupt, starting fresh:",
      error instanceof Error ? error.message : error,
    );
  }
}

const stateTimer = setInterval(
  () => persistState("interval"),
  config.stateSaveIntervalMs,
);

let stopping = false;

function stop(signal: string): void {
  if (stopping) return;
  stopping = true;

  console.log(`\n🛑 Received ${signal}; stopping paper bot...`);
  abortController.abort();
  manager.stop();
  telegram.stop();
  clearInterval(stateTimer);
  persistState("shutdown");

  console.log(statusMarkdown(portfolio.getStats()));
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

const tasks: Promise<void>[] = [
  manager.run(),
  telegram.start(),
  runTonCenterSse({
    signal: abortController.signal,
    onEvent: async (event) => {
      console.log("📡 TON Center event:", event.type);
    },
  }),
];

await Promise.all(tasks);

console.log("👋 TON paper bot stopped.");
