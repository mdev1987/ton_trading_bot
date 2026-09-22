/**
 * Central application configuration.
 *
 * The project is intentionally paper/emulation-only. The live-send APIs
 * are exposed only as adapters for future preflight/reconciliation work;
 * main.ts never broadcasts a transaction.
 */

export type BotMode = "emulation";

export interface TakeProfitConfig {
  profitPercent: number;
  sellPercent: number;
}

export const NATIVE_GRAM_ADDRESS =
  "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function numberEnv(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be numeric.`);
  }

  return value;
}

function integerEnv(name: string, fallback: number): number {
  const value = numberEnv(name, fallback);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer.`);
  }
  return value;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = env(name);
  if (!raw) return fallback;

  switch (raw.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
      return true;
    case "0":
    case "false":
    case "no":
      return false;
    default:
      throw new Error(`${name} must be true/false.`);
  }
}

function parseTakeProfits(raw: string | undefined): TakeProfitConfig[] {
  const value = raw ?? "30:25,60:25,100:100";

  const levels = value.split(",").map((item) => {
    const [profitRaw, sellRaw] = item.split(":");

    const profitPercent = Number(profitRaw);
    const sellPercent = Number(sellRaw);

    if (
      !Number.isFinite(profitPercent) ||
      !Number.isFinite(sellPercent) ||
      profitPercent <= 0 ||
      sellPercent <= 0 ||
      sellPercent > 100
    ) {
      throw new Error(
        `Invalid TAKE_PROFITS item: ${item}. Expected profit:sell.`,
      );
    }

    return { profitPercent, sellPercent };
  });

  levels.sort((a, b) => a.profitPercent - b.profitPercent);

  return levels;
}

export const config = {
  mode: "emulation" as BotMode,

  nativeGramAddress: NATIVE_GRAM_ADDRESS,
  nativeSymbol: "GRAM",

  tonApiUrl: env("TONAPI_URL") ?? "https://tonapi.io",
  tonApiKey: env("TONAPI_KEY"),
  tonApiEmulationEnabled: booleanEnv("TONAPI_EMULATION_ENABLED", false),

  coinGeckoApiKey: env("COINGECKO_DEMO_API_KEY"),
  coinGeckoNetwork: env("COINGECKO_NETWORK") ?? "ton",
  coinGeckoNewPoolPages: integerEnv("COINGECKO_NEW_POOL_PAGES", 1),

  dexScreenerUrl:
    env("DEXSCREENER_URL") ?? "https://api.dexscreener.com",
  dexScreenerChainId: env("DEXSCREENER_CHAIN_ID") ?? "ton",

  dexPaprikaUrl:
    env("DEXPAPRIKA_URL") ?? "https://api.dexpaprika.com",
  dexPaprikaApiKey: env("DEXPAPRIKA_API_KEY"),
  dexPaprikaEnabled: booleanEnv("DEXPAPRIKA_ENABLED", true),
  dexPaprikaLimit: integerEnv("DEXPAPRIKA_LIMIT", 50),

  dedustRouterUrl:
    env("DEDUST_ROUTER_URL") ??
    "https://api-mainnet.dedust.io/v1/router",
  dedustBuySlippageBps: integerEnv("DEDUST_BUY_SLIPPAGE_BPS", 100),
  dedustSellSlippageBps: integerEnv("DEDUST_SELL_SLIPPAGE_BPS", 100),
  dedustMaxSplits: integerEnv("DEDUST_MAX_SPLITS", 1),
  dedustMaxRouteLength: integerEnv("DEDUST_MAX_ROUTE_LENGTH", 1),
  // Keep the research position tied to the pool that triggered discovery.
  dedustRequireDiscoveredPool:
    booleanEnv("DEDUST_REQUIRE_DISCOVERED_POOL", true),
  // Never silently move an open position to another exit pool.
  dedustRequireSamePoolOnExit:
    booleanEnv("DEDUST_REQUIRE_SAME_POOL_ON_EXIT", true),

  tonCenterUrl:
    env("TONCENTER_URL") ?? "https://toncenter.com",
  tonCenterApiKey: env("TONCENTER_API_KEY"),
  tonCenterStreamingEnabled:
    booleanEnv("TONCENTER_STREAM_ENABLED", false),
  tonCenterStreamAddresses:
    (env("TONCENTER_STREAM_ADDRESSES") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  tonCenterStreamMinFinality:
    env("TONCENTER_STREAM_MIN_FINALITY") ?? "finalized",

  paperInitialBalance: numberEnv("PAPER_INITIAL_BALANCE", 1000),
  positionSize: numberEnv("PAPER_POSITION_SIZE", 10),
  maxOpenPositions: integerEnv("PAPER_MAX_OPEN_POSITIONS", 5),
  paperAutoBuy: booleanEnv("PAPER_AUTO_BUY", true),
  onePositionPerToken:
    booleanEnv("ONE_POSITION_PER_TOKEN", true),
  // Minimum CoinGecko-reported pool liquidity in USD for auto-buy.
  // 0 disables the gate (previous behavior). Thin-LP micros slip hard,
  // so a production paper value like 10000 is recommended.
  minLiquidityUsd: numberEnv("MIN_LIQUIDITY_USD", 0),

  // File-backed paper state (portfolio, seen pools, id counter).
  stateFile: env("STATE_FILE") ?? "./data/paper-state.json",
  stateSaveIntervalMs: integerEnv("STATE_SAVE_INTERVAL_MS", 15_000),

  poolScanIntervalMs: integerEnv("POOL_SCAN_INTERVAL_MS", 30_000),
  pricePollIntervalMs: integerEnv("PRICE_POLL_INTERVAL_MS", 1_500),
  httpTimeoutMs: integerEnv("HTTP_TIMEOUT_MS", 10_000),
  httpRetries: integerEnv("HTTP_RETRIES", 2),
  httpRetryDelayMs: integerEnv("HTTP_RETRY_DELAY_MS", 750),

  hardStopLossPercent: numberEnv("HARD_STOP_LOSS_PERCENT", 15),
  trailingActivationPercent: numberEnv(
    "TRAILING_ACTIVATION_PERCENT",
    40,
  ),
  trailingDistancePercent: numberEnv(
    "TRAILING_DISTANCE_PERCENT",
    15,
  ),
  takeProfits: parseTakeProfits(env("TAKE_PROFITS")),

  includeNetworkFees: booleanEnv("INCLUDE_NETWORK_FEES", true),

  telegramBotToken: env("TELEGRAM_BOT_TOKEN"),
  telegramChatId: env("TELEGRAM_CHAT_ID"),
  telegramEnabled: booleanEnv("TELEGRAM_ENABLED", true),
};

if (config.coinGeckoNewPoolPages < 1) {
  throw new Error("COINGECKO_NEW_POOL_PAGES must be >= 1.");
}

if (config.paperInitialBalance <= 0) {
  throw new Error("PAPER_INITIAL_BALANCE must be > 0.");
}

if (config.positionSize <= 0) {
  throw new Error("PAPER_POSITION_SIZE must be > 0.");
}

if (config.positionSize > config.paperInitialBalance) {
  throw new Error("PAPER_POSITION_SIZE cannot exceed paper balance.");
}

if (config.maxOpenPositions < 1) {
  throw new Error("PAPER_MAX_OPEN_POSITIONS must be >= 1.");
}

if (config.minLiquidityUsd < 0) {
  throw new Error("MIN_LIQUIDITY_USD must be >= 0.");
}

if (config.stateSaveIntervalMs < 1_000) {
  throw new Error("STATE_SAVE_INTERVAL_MS must be >= 1000.");
}

if (config.dexPaprikaLimit < 1 || config.dexPaprikaLimit > 100) {
  throw new Error("DEXPAPRIKA_LIMIT must be between 1 and 100.");
}
