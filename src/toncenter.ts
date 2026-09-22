/**
 * TON Center API v2/v3 adapter.
 *
 * v3 is used for indexed historical/reconciliation queries. v2 is exposed
 * for direct node-style reads. No send-message method is implemented here on
 * purpose: the project is emulation/paper only.
 */

import { config } from "./config.js";

export interface TonCenterStatus {
  ok: boolean;
  latencyMs: number;
  detail: string;
}

function apiHeaders(): HeadersInit {
  return config.tonCenterApiKey
    ? { "X-API-Key": config.tonCenterApiKey }
    : {};
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: apiHeaders(),
    signal: AbortSignal.timeout(config.httpTimeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `TON Center HTTP ${response.status}: ${body.slice(0, 400)}`,
    );
  }

  return (await response.json()) as T;
}

/** Health check against the indexed v3 masterchain endpoint. */
export async function checkTonCenter(): Promise<TonCenterStatus> {
  const started = Date.now();

  try {
    await getJson<unknown>(
      `${config.tonCenterUrl}/api/v3/masterchainInfo`,
    );

    return {
      ok: true,
      latencyMs: Date.now() - started,
      detail: "v3 masterchainInfo OK",
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : "request failed",
    };
  }
}

/** Direct v2 account information read. */
export async function getV2AddressInformation(
  address: string,
): Promise<unknown> {
  return getJson<unknown>(
    `${config.tonCenterUrl}/api/v2/getAddressInformation?address=${encodeURIComponent(address)}`,
  );
}

/** Indexed v3 actions query. */
export async function getV3Actions(params: Record<string, string | number | string[]> = {}): Promise<unknown> {
  const url = new URL(`${config.tonCenterUrl}/api/v3/actions`);

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return getJson<unknown>(url.toString());
}

/** Indexed v3 Jetton transfer query. */
export async function getV3JettonTransfers(
  params: Record<string, string | number | string[]> = {},
): Promise<unknown> {
  const url = new URL(`${config.tonCenterUrl}/api/v3/jetton/transfers`);

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return getJson<unknown>(url.toString());
}

/** Indexed v3 transaction query. */
export async function getV3Transactions(
  params: Record<string, string | number | string[]> = {},
): Promise<unknown> {
  const url = new URL(`${config.tonCenterUrl}/api/v3/transactions`);

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return getJson<unknown>(url.toString());
}
