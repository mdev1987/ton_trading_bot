/**
 * New-pool state machine.
 *
 * The first successful poll is a baseline. Existing pools are marked seen
 * but are never bought automatically. Later polls emit only unseen pool
 * addresses. Token identity is tracked separately from pool identity.
 */

import { getNewTonPools, type NewTonPool } from "./coingecko.js";

export interface NewPoolEvent {
  pool: NewTonPool;
  isNewToken: boolean;
}

const seenPools = new Set<string>();
const seenTokens = new Set<string>();
let initialized = false;

/** Poll CoinGecko once and return only genuinely new pools. */
export async function pollNewPools(): Promise<NewPoolEvent[]> {
  const pools = await getNewTonPools();

  pools.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime(),
  );

  if (!initialized) {
    for (const pool of pools) {
      seenPools.add(pool.poolAddress);
      seenTokens.add(pool.baseToken.address);
    }

    initialized = true;
    console.log(`📋 Initial pool sync: ${pools.length} pools`);
    console.log(`   Pools seen : ${seenPools.size}`);
    console.log(`   Tokens seen: ${seenTokens.size}`);
    return [];
  }

  const events: NewPoolEvent[] = [];

  for (const pool of pools) {
    if (seenPools.has(pool.poolAddress)) continue;

    seenPools.add(pool.poolAddress);

    const isNewToken = !seenTokens.has(pool.baseToken.address);
    seenTokens.add(pool.baseToken.address);

    events.push({ pool, isNewToken });
  }

  return events;
}

export function getSeenPoolCount(): number {
  return seenPools.size;
}

export function getSeenTokenCount(): number {
  return seenTokens.size;
}
