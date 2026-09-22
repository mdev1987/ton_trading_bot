/** Lightweight startup diagnostics for external services. */

import { checkTonApi } from "./tonapi.js";
import { checkTonCenter } from "./toncenter.js";
import { checkDexPaprika } from "./dexpaprika.js";
import { config } from "./config.js";

export async function runHealthChecks(): Promise<void> {
  console.log("\n🩺 SERVICE HEALTH");

  const [tonApi, tonCenter, dexPaprika] = await Promise.all([
    checkTonApi(),
    checkTonCenter(),
    config.dexPaprikaEnabled
      ? checkDexPaprika()
      : Promise.resolve({
          ok: true,
          detail: "disabled",
          latencyMs: 0,
        }),
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
  console.log(
    `  DexPaprika   : ${dexPaprika.ok ? "✅" : "❌"} ${dexPaprika.detail}${config.dexPaprikaApiKey ? " (API key)" : " (keyless)"} (${dexPaprika.latencyMs}ms)`,
  );
  console.log("  DeDust       : ✅ Router v2 configured");
  console.log(
    `  Telegram     : ${config.telegramEnabled && config.telegramBotToken && config.telegramChatId ? "✅ configured" : "⚪ disabled/not configured"}`,
  );
}
