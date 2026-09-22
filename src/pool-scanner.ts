/**
 * New-pool state machine.
 *
 * The first successful poll is a baseline. Existing pools are marked seen
 * but are never bought automatically. Later polls emit only unseen pool
 * addresses. Token identity is tracked separately from pool identity.
 */

import { getNewTonPools, type NewTonPool } from "./coingecko.js";
import {
  getRecentTonPools,
  toNewTonPool,
} from "./dexpaprika.js";
import { config } from "./config.js";

export type PoolSource = "coingecko" | "dexpaprika";

export interface NewPoolEvent {
  pool: NewTonPool;
  isNewToken: boolean;
  source: PoolSource;
}

const seenPools = new Set<string>();
const seenTokens = new Set<string>();
// Per-source baselines: the first successful poll of a source only marks
// pools seen, never emits. Without this, enabling a new source (or a fresh
// boot with two sources) would fire one event per pool in its lookback.
const baselined: Record<PoolSource, boolean> = {
  coingecko: false,
  dexpaprika: false,
};

// Consecutive per-source failures. A dead source must not kill the other
// one, and must not spam the log every 30s: warn on the 1st failure, on
// recovery, and every 10th consecutive failure.
const failures: Record<PoolSource, number> = {
  coingecko: 0,
  dexpaprika: 0,
};

async function safePoll(
  source: PoolSource,
  poll: () => Promise<NewTonPool[]>,
): Promise<{ pool: NewTonPool; source: PoolSource }[]> {
  try {
    const pools = await poll();

    if (failures[source] > 0) {
      console.log(`✅ ${source} discovery recovered`);
    }
    failures[source] = 0;

    return pools.map((pool) => ({ pool, source }));
  } catch (error) {
    failures[source] += 1;
    const count = failures[source];

    if (count === 1 || count % 10 === 0) {
      console.warn(
        `⚠️ ${source} discovery failed (${count}x):`,
        error instanceof Error ? error.message.slice(0, 200) : error,
      );
    }

    return [];
  }
}

/** Poll every enabled source and return only genuinely new pools. */
export async function pollNewPools(): Promise<NewPoolEvent[]> {
  const settled = await Promise.all([
    safePoll("coingecko", getNewTonPools),
    config.dexPaprikaEnabled
      ? safePoll("dexpaprika", async () =>
          (await getRecentTonPools()).map(toNewTonPool),
        )
      : Promise.resolve([] as { pool: NewTonPool; source: PoolSource }[]),
  ]);

  const all = settled.flat();
  const counts: Record<PoolSource, number> = {
    coingecko: 0,
    dexpaprika: 0,
  };
  for (const item of all) counts[item.source] += 1;

  all.sort(
    (a, b) =>
      Date.parse(b.pool.createdAt) -
      Date.parse(a.pool.createdAt),
  );

  if (!baselined.coingecko && !baselined.dexpaprika) {
    for (const { pool } of all) {
      seenPools.add(pool.poolAddress);
      seenTokens.add(pool.baseToken.address);
    }

    baselined.coingecko = counts.coingecko > 0;
    baselined.dexpaprika = config.dexPaprikaEnabled
      ? counts.dexpaprika > 0
      : true;
    console.log(
      `📋 Initial pool sync: ${all.length} pools ` +
        `(coingecko: ${counts.coingecko}, dex paprika: ${counts.dexpaprika})`,
    );
    console.log(`   Pools seen : ${seenPools.size}`);
    console.log(`   Tokens seen: ${seenTokens.size}`);
    return [];
  }

  const events: NewPoolEvent[] = [];

  for (const { pool, source } of all) {
    // A source that has never produced a successful poll baselines on its
    // first one instead of emitting a catch-up flood.
    if (!baselined[source]) {
      seenPools.add(pool.poolAddress);
      seenTokens.add(pool.baseToken.address);
      continue;
    }

    if (seenPools.has(pool.poolAddress)) continue;

    seenPools.add(pool.poolAddress);

    const isNewToken = !seenTokens.has(pool.baseToken.address);
    seenTokens.add(pool.baseToken.address);

    events.push({ pool, isNewToken, source });
  }

  // Mark newly baselined sources only after absorbing their first poll.
  for (const source of ["coingecko", "dexpaprika"] as const) {
    if (!baselined[source] && counts[source] > 0) {
      baselined[source] = true;
      console.log(
        `📋 Baseline ${source === "coingecko" ? "CoinGecko" : "DexPaprika"}: ${counts[source]} pools absorbed, no buys`,
      );
    }
  }

  return events;
}

export function getSeenPoolCount(): number {
  return seenPools.size;
}

export function getSeenTokenCount(): number {
  return seenTokens.size;
}

export interface ScannerState {
  seenPools: string[];
  seenTokens: string[];
  baselinedSources: PoolSource[];
}

/** Export discovery state for persistence. */
export function getScannerState(): ScannerState {
  const baselinedSources = (
    Object.keys(baselined) as PoolSource[]
  ).filter((source) => baselined[source]);
  return {
    seenPools: [...seenPools],
    seenTokens: [...seenTokens],
    baselinedSources,
  };
}

/** Restore discovery state from persistence (boot only). */
export function setScannerState(state: ScannerState): void {
  seenPools.clear();
  seenTokens.clear();
  for (const pool of state.seenPools) seenPools.add(pool);
  for (const token of state.seenTokens) seenTokens.add(token);
  baselined.coingecko = state.baselinedSources.includes("coingecko");
  baselined.dexpaprika = state.baselinedSources.includes("dexpaprika");
}
