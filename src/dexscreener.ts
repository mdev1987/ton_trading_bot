/**
 * DEX Screener exact-pair market-data adapter.
 *
 * We use the exact pair endpoint instead of symbol search so that multiple
 * pools for the same token remain distinct.
 */

import { config } from "./config.js";

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  url: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string | null;
  priceUsd: string | null;
  txns: {
    m5?: { buys: number; sells: number };
  };
  volume: {
    m5?: number;
  };
  liquidity?: {
    usd: number | null;
    base: number;
    quote: number;
  } | null;
  fdv?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
}

interface DexScreenerResponse {
  pairs: DexPair[] | null;
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.httpRetries; attempt += 1) {
    try {
      return await fetch(url, {
        signal: AbortSignal.timeout(config.httpTimeoutMs),
      });
    } catch (error) {
      lastError = error;
      if (attempt < config.httpRetries) {
        await Bun.sleep(config.httpRetryDelayMs);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("DEX Screener request failed.");
}

/** Get current DEX Screener data for one exact pair address. */
export async function getDexPair(
  pairAddress: string,
): Promise<DexPair | null> {
  const url =
    `${config.dexScreenerUrl}/latest/dex/pairs/` +
    `${config.dexScreenerChainId}/${encodeURIComponent(pairAddress)}`;

  const response = await fetchWithRetry(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `DEX Screener HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as DexScreenerResponse;

  if (!data.pairs || data.pairs.length === 0) {
    return null;
  }

  return (
    data.pairs.find((pair) => pair.pairAddress === pairAddress) ??
    data.pairs[0] ??
    null
  );
}

/** Extract a finite positive native price from a pair. */
export function getPairPrice(pair: DexPair): number | null {
  const price = Number(pair.priceNative);
  return Number.isFinite(price) && price > 0 ? price : null;
}
