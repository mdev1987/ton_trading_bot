/**
 * TONAPI Jetton metadata adapter and exact unit helpers.
 *
 * Raw blockchain amounts remain bigint internally. Conversion to human
 * units is performed only when required for display or price arithmetic.
 */

import { config } from "./config.js";

export interface JettonMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface TonApiJettonResponse {
  metadata?: {
    name?: string;
    symbol?: string;
    decimals?: number;
  };
  jetton_address?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
}

const cache = new Map<
  string,
  { value: JettonMetadata; expiresAt: number }
>();

const CACHE_TTL_MS = 10 * 60 * 1000;

/** Retrieve and cache Jetton metadata from TONAPI. */
export async function getJettonMetadata(
  address: string,
): Promise<JettonMetadata> {
  const cached = cache.get(address);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fetch(
    `${config.tonApiUrl}/v2/jettons/${encodeURIComponent(address)}`,
    {
      ...(config.tonApiKey
        ? { headers: { Authorization: `Bearer ${config.tonApiKey}` } }
        : {}),
      signal: AbortSignal.timeout(config.httpTimeoutMs),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `TONAPI Jetton HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as TonApiJettonResponse;

  const name = data.metadata?.name ?? data.name;
  const symbol = data.metadata?.symbol ?? data.symbol;
  const decimals = data.metadata?.decimals ?? data.decimals;

  if (!name || !symbol || decimals === undefined) {
    throw new Error(`Incomplete Jetton metadata: ${address}`);
  }

  const value: JettonMetadata = {
    address,
    name,
    symbol,
    decimals,
  };

  cache.set(address, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return value;
}

/** Convert a raw integer amount to an exact human-readable decimal string. */
export function formatUnits(
  amount: bigint,
  decimals: number,
): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("Decimals must be a non-negative integer.");
  }

  if (decimals === 0) return amount.toString();

  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = absolute % base;

  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  const result =
    fractionText.length > 0
      ? `${whole}.${fractionText}`
      : whole.toString();

  return negative ? `-${result}` : result;
}

/** Convert a positive decimal string into raw integer units. */
export function parseUnits(
  value: string,
  decimals: number,
): bigint {
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }

  const negative = value.startsWith("-");
  const normalized = negative ? value.slice(1) : value;
  const [wholeRaw, fraction = ""] = normalized.split(".");
  const whole = wholeRaw ?? "0";

  if (fraction.length > decimals) {
    throw new Error(
      `Too many decimal places for ${decimals} decimals: ${value}`,
    );
  }

  const paddedFraction = fraction.padEnd(decimals, "0");
  const base = 10n ** BigInt(decimals);
  const raw = BigInt(whole) * base + BigInt(paddedFraction || "0");

  return negative ? -raw : raw;
}
