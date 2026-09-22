/**
 * DexPaprika discovery adapter (official dexpaprika-sdk).
 *
 * Second discovery source alongside CoinGecko newPools: the newest pools on
 * TON sorted by on-chain creation time. Rows are mapped to NewTonPool so the
 * rest of the pipeline (venue filter, min-LP gate, DeDust quotes) is shared.
 *
 * Notes:
 * - Pool-search rows carry no token symbols/decimals; only on-chain ids.
 *   Symbols/decimals resolve downstream via TONAPI Jetton metadata, so the
 *   mapper uses short addresses as display placeholders.
 * - SDK response cache is disabled: a 5-minute cache would delay new-pool
 *   discovery by up to 5 minutes.
 */

import {
  DexPaprikaClient,
  type SearchPool,
} from "dexpaprika-sdk";
import {
  config,
  NATIVE_GRAM_ADDRESS,
} from "./config.js";
import type { NewTonPool } from "./coingecko.js";

let client: DexPaprikaClient | null = null;

/** Lazily build the SDK client with explicit key and no response cache. */
export function getDexPaprikaClient(): DexPaprikaClient {
  if (!client) {
    const key = config.dexPaprikaApiKey;
    client = new DexPaprikaClient(
      config.dexPaprikaUrl,
      { timeout: config.httpTimeoutMs },
      {
        cache: { enabled: false },
        ...(key ? { apiKey: key } : {}),
      },
    );
  }

  return client;
}

/** Fetch the newest TON pools by on-chain creation time. */
export async function getRecentTonPools(): Promise<SearchPool[]> {
  const response = await getDexPaprikaClient().pools.listByNetwork(
    "ton",
    {
      limit: config.dexPaprikaLimit,
      orderBy: "created_at",
      sort: "desc",
    },
  );

  return response.results ?? [];
}

/**
 * Split a pool's token ids into base/quote.
 *
 * GRAM-quoted pools: base is the non-GRAM token. Non-GRAM pools keep
 * row order and are rejected downstream by isNativeTonPool anyway.
 */
export function splitBaseQuote(tokenIds: string[]): {
  baseAddress: string;
  quoteAddress: string;
} {
  const gramPresent = tokenIds.includes(NATIVE_GRAM_ADDRESS);
  const nonGram = tokenIds.find((id) => id !== NATIVE_GRAM_ADDRESS);

  if (gramPresent && nonGram) {
    return { baseAddress: nonGram, quoteAddress: NATIVE_GRAM_ADDRESS };
  }

  return {
    baseAddress: tokenIds[0] ?? "",
    quoteAddress: tokenIds[1] ?? "",
  };
}

function shortAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

/**
 * Map a DexPaprika pool row to the shared discovery shape.
 *
 * priceNative is 0 by construction: the reference entry price always comes
 * from the DEX Screener discovery lookup, never from the discovery row.
 * CoinGecko-only fields (5m txns, fdv, market cap) have no DexPaprika
 * equivalent and are zeroed/nulled.
 */
export function toNewTonPool(row: SearchPool): NewTonPool {
  const { baseAddress, quoteAddress } = splitBaseQuote(
    row.tokens.map((token) => token.id),
  );
  const baseLabel = shortAddress(baseAddress);
  const quoteLabel = shortAddress(quoteAddress);

  return {
    poolAddress: row.id,
    poolName: `${baseLabel} / ${quoteLabel}`,
    createdAt: row.created_at,
    dexId: row.dex_id,
    dexName: row.dex_name,
    baseToken: {
      address: baseAddress,
      name: baseLabel,
      symbol: baseLabel,
      decimals: 0,
    },
    quoteToken: {
      address: quoteAddress,
      name: quoteLabel,
      symbol: quoteLabel,
      decimals: 0,
    },
    priceNative: 0,
    priceUsd: row.price_usd ?? null,
    fdvUsd: null,
    marketCapUsd: null,
    liquidityUsd: row.liquidity_usd ?? null,
    transactions5m: { buys: 0, sells: 0, buyers: 0, sellers: 0 },
    volume5mUsd: 0,
  };
}

/** Lightweight boot check: platform stats + latency. */
export async function checkDexPaprika(): Promise<{
  ok: boolean;
  detail: string;
  latencyMs: number;
}> {
  const started = Date.now();

  try {
    await getDexPaprikaClient().utils.getStats();
    return {
      ok: true,
      detail: "stats OK",
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message.slice(0, 120) : "error",
      latencyMs: Date.now() - started,
    };
  }
}
