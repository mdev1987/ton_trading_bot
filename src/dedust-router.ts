/**
 * DeDust Router v2 read-only quote adapter.
 *
 * The adapter deliberately does not build or broadcast a swap transaction.
 * It asks the public Router endpoint for an exact-input quote and exposes
 * the selected route and fee metadata to the paper execution engine.
 */

import { config } from "./config.js";

export interface DedustRouteStep {
  poolAddress?: string;
  inMinter?: string;
  outMinter?: string;
  inAmount?: bigint;
  outAmount?: bigint;
  networkFee?: bigint;
  protocolSlug?: string;
}

export interface DedustRouterQuote {
  inAmount: bigint;
  outAmount: bigint;
  swapIsPossible: boolean;
  priceImpact: number | null;
  estimatedNetworkFee: bigint;
  routes: DedustRouteStep[][];
  raw: unknown;
}

function toBigInt(value: unknown): bigint | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Fetch a generic exact-input DeDust quote. */
export async function getDedustQuote(
  inMinter: string,
  outMinter: string,
  amountIn: bigint,
  slippageBps = config.dedustBuySlippageBps,
): Promise<DedustRouterQuote> {
  const response = await fetch(
    `${config.dedustRouterUrl}/quote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(config.httpTimeoutMs),
      body: JSON.stringify({
        in_minter: inMinter,
        out_minter: outMinter,
        amount: amountIn.toString(),
        swap_mode: "exact_in",
        slippage_bps: slippageBps,
        max_splits: config.dedustMaxSplits,
        max_length: config.dedustMaxRouteLength,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `DeDust Router HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  const inAmount = toBigInt(data.in_amount) ?? amountIn;
  const outAmount = toBigInt(data.out_amount) ?? 0n;

  const routes: DedustRouteStep[][] = [];
  let estimatedNetworkFee = 0n;

  // DeDust display_data exposes the route-level network fee estimate. Prefer
  // that value for paper cash accounting because it represents the complete
  // displayed network estimate, while swap_data step fees describe route steps.
  const displayData = data.display_data;
  if (Array.isArray(displayData)) {
    for (const item of displayData) {
      if (!item || typeof item !== "object") continue;
      const displayItem = item as Record<string, unknown>;
      const displayFee = toBigInt(displayItem.network_fee);
      if (displayFee !== undefined) {
        estimatedNetworkFee += displayFee;
      }
    }
  }

  let routeStepFee = 0n;

  const swapData = data.swap_data;
  if (swapData && typeof swapData === "object") {
    const routeData = (swapData as Record<string, unknown>).routes;

    if (Array.isArray(routeData)) {
      for (const route of routeData) {
        if (!Array.isArray(route)) continue;

        const parsedRoute: DedustRouteStep[] = [];

        for (const step of route) {
          if (!step || typeof step !== "object") continue;

          const item = step as Record<string, unknown>;
          const networkFee = toBigInt(item.network_fee);

          if (networkFee !== undefined) {
            routeStepFee += networkFee;
          }

          const routeStep: DedustRouteStep = {};

          if (typeof item.pool_address === "string") {
            routeStep.poolAddress = item.pool_address;
          }
          if (typeof item.in_minter === "string") {
            routeStep.inMinter = item.in_minter;
          }
          if (typeof item.out_minter === "string") {
            routeStep.outMinter = item.out_minter;
          }

          const inAmount = toBigInt(item.in_amount);
          const outAmount = toBigInt(item.out_amount);

          if (inAmount !== undefined) routeStep.inAmount = inAmount;
          if (outAmount !== undefined) routeStep.outAmount = outAmount;
          if (networkFee !== undefined) routeStep.networkFee = networkFee;

          if (typeof item.protocol_slug === "string") {
            routeStep.protocolSlug = item.protocol_slug;
          }

          parsedRoute.push(routeStep);
        }

        routes.push(parsedRoute);
      }
    }
  }

  // If the response has no display-level fee, fall back to the sum of the
  // route-step estimates. Never add both values together.
  if (estimatedNetworkFee === 0n) {
    estimatedNetworkFee = routeStepFee;
  }

  return {
    inAmount,
    outAmount,
    swapIsPossible: data.swap_is_possible === true,
    priceImpact: toNumber(data.price_impact),
    estimatedNetworkFee,
    routes,
    raw: data,
  };
}

/** GRAM -> Jetton quote. */
export function getBuyQuote(
  jettonAddress: string,
  amountIn: bigint,
): Promise<DedustRouterQuote> {
  return getDedustQuote(
    "native",
    jettonAddress,
    amountIn,
    config.dedustBuySlippageBps,
  );
}

/** Jetton -> GRAM quote. */
export function getSellQuote(
  jettonAddress: string,
  amountIn: bigint,
): Promise<DedustRouterQuote> {
  return getDedustQuote(
    jettonAddress,
    "native",
    amountIn,
    config.dedustSellSlippageBps,
  );
}
