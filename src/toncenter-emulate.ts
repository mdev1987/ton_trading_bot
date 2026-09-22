/**
 * TON Center Emulate API adapter.
 *
 * This endpoint is for future live preflight only. The paper engine never
 * submits a BOC here unless explicitly called by a future live layer.
 */

import { config } from "./config.js";

/** Emulate an external-message BOC against the current chain state. */
export async function emulateTraceWithTonCenter(
  bocBase64: string,
): Promise<unknown> {
  if (process.env.TONCENTER_EMULATION_ENABLED !== "true") {
    throw new Error(
      "TON Center emulation is disabled. Set TONCENTER_EMULATION_ENABLED=true for preflight use.",
    );
  }

  const response = await fetch(
    `${config.tonCenterUrl}/api/emulate/v1/emulateTrace`,
    {
      method: "POST",
      headers: {
        ...(config.tonCenterApiKey
          ? { "X-API-Key": config.tonCenterApiKey }
          : {}),
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(config.httpTimeoutMs),
      body: JSON.stringify({ boc: bocBase64 }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `TON Center Emulate HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  return response.json();
}
