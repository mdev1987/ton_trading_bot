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

/** Check that TONAPI is reachable via the lightweight status endpoint. */
export async function checkTonApi(): Promise<TonApiStatus> {
  const started = Date.now();

  try {
    const response = await fetch(
      `${config.tonApiUrl}/v2/status`,
      {
        ...(config.tonApiKey
        ? { headers: { Authorization: `Bearer ${config.tonApiKey}` } }
        : {}),
        signal: AbortSignal.timeout(config.httpTimeoutMs),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        detail: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      rest_online?: boolean;
    };

    const online = data.rest_online !== false;

    return {
      ok: online,
      latencyMs: Date.now() - started,
      detail: online ? "status OK (rest_online)" : "rest_online=false",
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : "request failed",
    };
  }
}
