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

let stopping = false;

function stop(signal: string): void {
  if (stopping) return;
  stopping = true;

  console.log(`\n🛑 Received ${signal}; stopping paper bot...`);
  abortController.abort();
  manager.stop();
  telegram.stop();

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
