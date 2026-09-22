import { describe, expect, test } from "bun:test";
import {
  splitBaseQuote,
  toNewTonPool,
} from "../src/dexpaprika.js";
import { isNativeTonPool } from "../src/coingecko.js";
import { NATIVE_GRAM_ADDRESS } from "../src/config.js";
import type { SearchPool } from "dexpaprika-sdk";

const GRAM = NATIVE_GRAM_ADDRESS;
const TOKEN_A = "EQBlKoS2jgE3InbvLUXLx6r3jTfaM114Sv1-WNWUNznNDZwQ";
const TOKEN_B = "EQDuGgqZU7_AEgiOwEe-abozIefuoairTWLOyd7c_f8GhzMf";

function row(tokenIds: string[]): SearchPool {
  return {
    id: "EQDw3RezIcJ-f5v3VTWB4CntLuG3d5dNj9aAwuVtB12M1uNY",
    chain: "ton",
    dex_id: "dedust",
    dex_name: "Dedust",
    created_at: "2026-09-21T13:53:22Z",
    created_at_block_number: 94154720,
    volume_usd_24h: 295.12,
    liquidity_usd: 13420.74,
    price_usd: 1.451,
    tokens: tokenIds.map((id) => ({ id })),
  };
}

describe("DexPaprika base/quote split", () => {
  test("GRAM-first order resolves the traded token as base", () => {
    expect(splitBaseQuote([GRAM, TOKEN_A])).toEqual({
      baseAddress: TOKEN_A,
      quoteAddress: GRAM,
    });
  });

  test("GRAM-second order resolves the same way", () => {
    expect(splitBaseQuote([TOKEN_A, GRAM])).toEqual({
      baseAddress: TOKEN_A,
      quoteAddress: GRAM,
    });
  });

  test("non-GRAM pools keep row order and fail the native check", () => {
    const split = splitBaseQuote([TOKEN_A, TOKEN_B]);
    expect(split.baseAddress).toBe(TOKEN_A);

    const pool = toNewTonPool(row([TOKEN_A, TOKEN_B]));
    expect(isNativeTonPool(pool)).toBe(false);
  });
});

describe("DexPaprika pool mapping", () => {
  test("maps venue, liquidity and timestamps; native check passes", () => {
    const pool = toNewTonPool(row([GRAM, TOKEN_A]));

    expect(pool.poolAddress).toBe(
      "EQDw3RezIcJ-f5v3VTWB4CntLuG3d5dNj9aAwuVtB12M1uNY",
    );
    expect(pool.dexId).toBe("dedust");
    expect(pool.createdAt).toBe("2026-09-21T13:53:22Z");
    expect(pool.liquidityUsd).toBeCloseTo(13420.74, 10);
    expect(pool.baseToken.address).toBe(TOKEN_A);
    expect(pool.quoteToken.address).toBe(GRAM);
    expect(isNativeTonPool(pool)).toBe(true);
  });

  test("missing liquidity maps to null (min-LP gate treats it as zero)", () => {
    const r = row([GRAM, TOKEN_A]) as unknown as Record<string, unknown>;
    delete r["liquidity_usd"];
    expect(
      toNewTonPool(r as unknown as SearchPool).liquidityUsd,
    ).toBeNull();
  });
});
