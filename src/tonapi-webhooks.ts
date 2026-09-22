/**
 * Optional TONAPI Webhooks management adapter.
 *
 * This is infrastructure for future live monitoring. It is not part of the
 * paper price loop. TONAPI requires a private API key for webhook operations.
 */

import { config } from "./config.js";

const webhookBaseUrl = "https://rt.tonapi.io";

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!config.tonApiKey) {
    throw new Error("TONAPI_KEY is required for Webhooks API.");
  }

  const response = await fetch(`${webhookBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.tonApiKey}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(config.httpTimeoutMs),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `TONAPI Webhooks HTTP ${response.status}: ${text.slice(0, 400)}`,
    );
  }

  return (await response.json()) as T;
}

/** Create a webhook endpoint and return its ID. */
export async function createTonApiWebhook(
  endpoint: string,
): Promise<number> {
  const result = await request<{ webhook_id: number }>(
    "/webhooks",
    "POST",
    { endpoint },
  );
  return result.webhook_id;
}

/** Subscribe a webhook to account transactions. */
export async function subscribeTonApiAccountTransactions(
  webhookId: number,
  accounts: string[],
): Promise<unknown> {
  return request(
    `/webhooks/${webhookId}/account-tx/subscribe`,
    "POST",
    { accounts: accounts.map((account_id) => ({ account_id })) },
  );
}

/** List configured webhooks for the TonAPI key. */
export async function listTonApiWebhooks(): Promise<unknown> {
  return request("/webhooks");
}

/** Delete a webhook and all its subscriptions. */
export async function deleteTonApiWebhook(
  webhookId: number,
): Promise<void> {
  await request(`/webhooks/${webhookId}`, "DELETE");
}
