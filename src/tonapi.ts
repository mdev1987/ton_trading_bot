/**
 * TONAPI REST adapter.
 *
 * Used for high-level Jetton metadata and lightweight health checks in this
 * paper project. Transaction emulation is exposed separately in tonapi-emulate.
 */

import { config } from "./config.js";

export interface TonApiStatus {
  ok: boolean;
  latencyMs: number;
  detail: string;
}

/** Check that TONAPI is reachable. */
export async function checkTonApi(): Promise<TonApiStatus> {
  const started = Date.now();

  try {
    const response = await fetch(
      `${config.tonApiUrl}/v2/masterchainInfo`,
      {
        ...(config.tonApiKey
        ? { headers: { Authorization: `Bearer ${config.tonApiKey}` } }
        : {}),
        signal: AbortSignal.timeout(config.httpTimeoutMs),
      },
    );

    return {
      ok: response.ok,
      latencyMs: Date.now() - started,
      detail: response.ok
        ? "masterchainInfo OK"
        : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : "request failed",
    };
  }
}
