import { describe, expect, test } from "bun:test";
import { getJettonMetadata } from "../src/jetton.js";

function stubTonApi(body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("Jetton metadata", () => {
  test("coerces string decimals to a number", async () => {
    const originalFetch = globalThis.fetch;
    stubTonApi({
      metadata: { name: "StrDec", symbol: "STR", decimals: "9" },
    });
    try {
      const meta = await getJettonMetadata("EQ_TEST_STRING_DECIMALS_X1");
      expect(meta.decimals).toBe(9);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects non-numeric decimals instead of failing mid-quote", async () => {
    const originalFetch = globalThis.fetch;
    stubTonApi({
      metadata: { name: "BadDec", symbol: "BAD", decimals: "nine" },
    });
    try {
      await expect(
        getJettonMetadata("EQ_TEST_BAD_DECIMALS_X2"),
      ).rejects.toThrow("Incomplete Jetton metadata");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
