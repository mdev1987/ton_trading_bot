/**
 * CoinGecko / GeckoTerminal discovery adapter.
 *
 * The new-pools endpoint is used only for discovery. We deliberately do not
 * apply trading filters here; discovery should remain broad and observable.
 */

import Coingecko from "@coingecko/coingecko-typescript";
import { config } from "./config.js";

export interface CoinGeckoToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface NewTonPool {
  poolAddress: string;
  poolName: string;
  createdAt: string;
  dexId: string;
  dexName: string;
  baseToken: CoinGeckoToken;
  quoteToken: CoinGeckoToken;
  priceNative: number;
  priceUsd: number | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  transactions5m: {
    buys: number;
    sells: number;
    buyers: number;
    sellers: number;
  };
  volume5mUsd: number;
}

const client = new Coingecko({
  demoAPIKey: config.coinGeckoApiKey,
  environment: "demo",
});

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findIncluded(
  included: unknown[],
  id: string,
  type: string,
): Record<string, any> {
  const item = included.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as Record<string, unknown>;
    return candidate.id === id && candidate.type === type;
  });

  if (!item || typeof item !== "object") {
    throw new Error(`CoinGecko included resource not found: ${type}/${id}`);
  }

  return item as Record<string, any>;
}

function normalizePool(
  rawPool: Record<string, any>,
  included: unknown[],
): NewTonPool {
  const attributes = rawPool.attributes as Record<string, any>;
  const relationships = rawPool.relationships as Record<string, any>;

  const baseTokenId = relationships.base_token.data.id as string;
  const quoteTokenId = relationships.quote_token.data.id as string;
  const dexId = relationships.dex.data.id as string;

  const baseResource = findIncluded(included, baseTokenId, "token");
  const quoteResource = findIncluded(included, quoteTokenId, "token");
  const dexResource = findIncluded(included, dexId, "dex");

  const base = baseResource.attributes as Record<string, any>;
  const quote = quoteResource.attributes as Record<string, any>;
  const dex = dexResource.attributes as Record<string, any>;
  const tx5m = (attributes.transactions?.m5 ?? {}) as Record<string, any>;

  return {
    poolAddress: String(attributes.address),
    poolName: String(attributes.name),
    createdAt: String(attributes.pool_created_at),
    dexId,
    dexName: String(dex.name ?? dexId),
    baseToken: {
      address: String(base.address),
      name: String(base.name ?? ""),
      symbol: String(base.symbol ?? ""),
      decimals: Number(base.decimals ?? 0),
    },
    quoteToken: {
      address: String(quote.address),
      name: String(quote.name ?? ""),
      symbol: String(quote.symbol ?? ""),
      decimals: Number(quote.decimals ?? 0),
    },
    priceNative: asNumber(attributes.base_token_price_native_currency) ?? 0,
    priceUsd: asNumber(attributes.base_token_price_usd),
    fdvUsd: asNumber(attributes.fdv_usd),
    marketCapUsd: asNumber(attributes.market_cap_usd),
    liquidityUsd: asNumber(attributes.reserve_in_usd),
    transactions5m: {
      buys: Number(tx5m.buys ?? 0),
      sells: Number(tx5m.sells ?? 0),
      buyers: Number(tx5m.buyers ?? 0),
      sellers: Number(tx5m.sellers ?? 0),
    },
    volume5mUsd: asNumber(attributes.volume_usd?.m5) ?? 0,
  };
}

/** Fetch one page of new pools for the configured network. */
export async function getNewTonPoolsPage(
  page = 1,
): Promise<NewTonPool[]> {
  const response = await client.onchain.networks.newPools.getNetwork(
    config.coinGeckoNetwork,
    {
      include: "base_token,quote_token,dex",
      page,
    },
  );

  const rawPools = (response.data ?? []) as unknown as Record<string, any>[];
  const included = (response.included ?? []) as unknown as unknown[];

  return rawPools.map((pool) => normalizePool(pool, included));
}

/** Fetch all configured discovery pages. */
export async function getNewTonPools(): Promise<NewTonPool[]> {
  const pages = await Promise.all(
    Array.from(
      { length: config.coinGeckoNewPoolPages },
      (_, index) => getNewTonPoolsPage(index + 1),
    ),
  );

  return pages.flat();
}

/** Identify native-GRAM quoted pools by address, never by ticker. */
export function isNativeTonPool(pool: NewTonPool): boolean {
  return pool.quoteToken.address === config.nativeGramAddress;
}
