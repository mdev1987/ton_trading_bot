/**
 * Execution abstraction for the paper engine.
 *
 * CoinGecko discovers the pool, DEX Screener supplies the market/reference
 * price, TONAPI supplies token decimals, and DeDust supplies executable
 * virtual BUY/SELL quantities.
 *
 * IMPORTANT:
 * - The paper position is bound to the pool actually selected by the
 *   DeDust Router.
 * - In strict mode, a newly discovered pool must also be the pool selected
 *   by the router. This prevents the market/position price feed from being
 *   detached from the liquidity used for the virtual execution.
 */

import type { NewTonPool } from "./coingecko.js";
import { isNativeTonPool } from "./coingecko.js";
import {
  getBuyQuote,
  getSellQuote,
  type DedustRouterQuote,
} from "./dedust-router.js";
import { formatUnits, getJettonMetadata } from "./jetton.js";
import { config } from "./config.js";

export interface ExecutionQuote {
  side: "buy" | "sell";
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;

  amountInRaw: bigint;
  amountOutRaw: bigint;

  amountIn: string;
  amountOut: string;

  executionPrice: number;
  priceImpact: number | null;

  estimatedNetworkFeeRaw: bigint;
  estimatedNetworkFee: number;

  /** The pool selected by the router for this quote. */
  poolAddress: string;
  routerProtocol: string | null;
  executionSource: "dedust-router-v2";
}

function nativeAmount(raw: bigint): number {
  return Number(raw) / 1e9;
}

function firstProtocol(
  quote: DedustRouterQuote,
): string | null {
  for (const route of quote.routes) {
    for (const step of route) {
      if (step.protocolSlug) return step.protocolSlug;
    }
  }

  return null;
}

function firstPool(
  quote: DedustRouterQuote,
): string | null {
  for (const route of quote.routes) {
    for (const step of route) {
      if (step.poolAddress) return step.poolAddress;
    }
  }

  return null;
}

/**
 * Check whether every routed step uses exactly one expected pool.
 *
 * This is intentionally strict. A multi-pool route must not be silently
 * represented as a single-pair position.
 */
export function quoteUsesOnlyPool(
  quote: DedustRouterQuote,
  expectedPoolAddress: string,
): boolean {
  let foundStep = false;

  for (const route of quote.routes) {
    for (const step of route) {
      foundStep = true;

      if (
        !step.poolAddress ||
        step.poolAddress !== expectedPoolAddress
      ) {
        return false;
      }
    }
  }

  return foundStep;
}

/** Build a DeDust BUY quote for a newly discovered native-GRAM pool. */
export async function getBuyExecutionQuote(
  pool: NewTonPool,
  quoteAmountGram: number,
): Promise<ExecutionQuote | null> {
  if (!isNativeTonPool(pool)) return null;

  if (
    !pool.dexId.includes("dedust") &&
    !pool.dexName.toLowerCase().includes("dedust")
  ) {
    return null;
  }

  if (
    !Number.isFinite(quoteAmountGram) ||
    quoteAmountGram <= 0
  ) {
    throw new Error("BUY amount must be positive.");
  }

  const token = await getJettonMetadata(
    pool.baseToken.address,
  );

  const inputRaw = BigInt(
    Math.round(quoteAmountGram * 1e9),
  );

  const quote = await getBuyQuote(
    pool.baseToken.address,
    inputRaw,
  );

  if (
    !quote.swapIsPossible ||
    quote.outAmount <= 0n
  ) {
    return null;
  }

  const routedPool = firstPool(quote);

  if (
    config.dedustRequireDiscoveredPool &&
    !quoteUsesOnlyPool(quote, pool.poolAddress)
  ) {
    console.log(
      `⏭️ DeDust BUY rejected: router did not use discovered pool ` +
      `${pool.poolAddress}`,
    );

    console.log(
      `   Router pool: ${routedPool ?? "none"}`,
    );

    return null;
  }

  if (!routedPool) {
    return null;
  }

  const outputHuman = formatUnits(
    quote.outAmount,
    token.decimals,
  );

  const outputNumber = Number(outputHuman);

  if (
    !Number.isFinite(outputNumber) ||
    outputNumber <= 0
  ) {
    throw new Error("Invalid DeDust BUY output.");
  }

  const executionPrice =
    quoteAmountGram / outputNumber;

  const estimatedNetworkFee = nativeAmount(
    quote.estimatedNetworkFee,
  );

  return {
    side: "buy",
    tokenAddress: token.address,
    tokenSymbol: token.symbol,
    tokenDecimals: token.decimals,
    amountInRaw: inputRaw,
    amountOutRaw: quote.outAmount,
    amountIn: formatUnits(inputRaw, 9),
    amountOut: outputHuman,
    executionPrice,
    priceImpact: quote.priceImpact,
    estimatedNetworkFeeRaw:
      quote.estimatedNetworkFee,
    estimatedNetworkFee,
    poolAddress: routedPool,
    routerProtocol: firstProtocol(quote),
    executionSource: "dedust-router-v2",
  };
}

/**
 * Build a DeDust SELL quote for an exact raw Jetton quantity.
 *
 * When expectedPoolAddress is supplied, every route step must use that exact
 * pool. This prevents the exit execution venue from drifting away from the
 * venue that backs the position's monitored price series.
 */
export async function getSellExecutionQuote(
  tokenAddress: string,
  amountRaw: bigint,
  expectedPoolAddress?: string,
): Promise<ExecutionQuote | null> {
  if (amountRaw <= 0n) return null;

  const token = await getJettonMetadata(tokenAddress);
  const quote = await getSellQuote(
    tokenAddress,
    amountRaw,
  );

  if (
    !quote.swapIsPossible ||
    quote.outAmount <= 0n
  ) {
    return null;
  }

  const routedPool = firstPool(quote);

  if (
    expectedPoolAddress &&
    config.dedustRequireSamePoolOnExit &&
    !quoteUsesOnlyPool(
      quote,
      expectedPoolAddress,
    )
  ) {
    console.log(
      `⏭️ DeDust SELL rejected: router changed pool. ` +
      `Expected=${expectedPoolAddress} ` +
      `Router=${routedPool ?? "none"}`,
    );

    return null;
  }

  if (!routedPool) {
    return null;
  }

  const amountInHuman = formatUnits(
    amountRaw,
    token.decimals,
  );

  const amountOutHuman = formatUnits(
    quote.outAmount,
    9,
  );

  const amountOut = nativeAmount(
    quote.outAmount,
  );

  const amountIn = Number(amountInHuman);

  if (
    !Number.isFinite(amountIn) ||
    amountIn <= 0 ||
    amountOut <= 0
  ) {
    throw new Error("Invalid DeDust SELL output.");
  }

  return {
    side: "sell",
    tokenAddress: token.address,
    tokenSymbol: token.symbol,
    tokenDecimals: token.decimals,
    amountInRaw: amountRaw,
    amountOutRaw: quote.outAmount,
    amountIn: amountInHuman,
    amountOut: amountOutHuman,
    executionPrice: amountOut / amountIn,
    priceImpact: quote.priceImpact,
    estimatedNetworkFeeRaw:
      quote.estimatedNetworkFee,
    estimatedNetworkFee: nativeAmount(
      quote.estimatedNetworkFee,
    ),
    poolAddress: routedPool,
    routerProtocol: firstProtocol(quote),
    executionSource: "dedust-router-v2",
  };
}
