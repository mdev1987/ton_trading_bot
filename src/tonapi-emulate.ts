/**
 * Optional TonAPI transaction-emulation adapter.
 *
 * This file is intentionally not called by the paper trading engine. It is
 * provided for the future live/preflight stage and performs no broadcasting.
 */

import { TonApiClient } from "@ton-api/client";
import type { Cell } from "@ton/core";
import { config } from "./config.js";

function createClient(): TonApiClient {
  return new TonApiClient({
    baseUrl: config.tonApiUrl,
    ...(config.tonApiKey ? { apiKey: config.tonApiKey } : {}),
  });
}

/** Emulate an external message and return the detailed trace. */
export async function emulateWithTonApi(
  boc: Cell,
  ignoreSignatureCheck = true,
): Promise<unknown> {
  if (!config.tonApiEmulationEnabled) {
    throw new Error(
      "TonAPI emulation is disabled. Set TONAPI_EMULATION_ENABLED=true for preflight use.",
    );
  }

  const client = createClient();

  return client.emulation.emulateMessageToTrace(
    { boc },
    { ignore_signature_check: ignoreSignatureCheck },
  );
}
