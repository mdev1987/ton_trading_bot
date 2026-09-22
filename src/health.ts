/** Lightweight startup diagnostics for external services. */

import { checkTonApi } from "./tonapi.js";
import { checkTonCenter } from "./toncenter.js";
import { config } from "./config.js";

export async function runHealthChecks(): Promise<void> {
  console.log("\n🩺 SERVICE HEALTH");

  const [tonApi, tonCenter] = await Promise.all([
    checkTonApi(),
    checkTonCenter(),
  ]);

  console.log(
    `  TONAPI       : ${tonApi.ok ? "✅" : "❌"} ${tonApi.detail} (${tonApi.latencyMs}ms)`,
  );

  console.log(
    `  TON Center   : ${tonCenter.ok ? "✅" : "❌"} ${tonCenter.detail} (${tonCenter.latencyMs}ms)`,
  );

  console.log(
    `  CoinGecko    : ✅ configured${config.coinGeckoApiKey ? " (API key)" : " (Demo/no key)"}`,
  );
  console.log("  DEX Screener : ✅ configured");
  console.log("  DeDust       : ✅ Router v2 configured");
  console.log(
    `  Telegram     : ${config.telegramEnabled && config.telegramBotToken && config.telegramChatId ? "✅ configured" : "⚪ disabled/not configured"}`,
  );
}
