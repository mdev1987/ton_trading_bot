/**
 * Optional TON Center Streaming API v2 SSE client.
 *
 * Streaming is deliberately not the paper price source. It is included as
 * an infrastructure adapter for future on-chain event monitoring. The
 * Streaming API does not recover missed events; applications should resync
 * from TON Center API v3 after reconnects.
 */

import { config } from "./config.js";

export interface TonCenterStreamEvent {
  type: string;
  data: unknown;
}

export interface TonCenterStreamOptions {
  onEvent: (event: TonCenterStreamEvent) => void | Promise<void>;
  signal?: AbortSignal;
}

/**
 * Stream current TON Center events over SSE with simple reconnect backoff.
 */
export async function runTonCenterSse(
  options: TonCenterStreamOptions,
): Promise<void> {
  if (!config.tonCenterStreamingEnabled) return;
  if (config.tonCenterStreamAddresses.length === 0) {
    console.log("📡 TON Center streaming enabled but no addresses configured");
    return;
  }

  let backoffMs = 1_000;

  while (!options.signal?.aborted) {
    try {
      const requestOptions: RequestInit = {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          ...(config.tonCenterApiKey
            ? { "X-API-Key": config.tonCenterApiKey }
            : {}),
        },
        body: JSON.stringify({
          types: ["transactions", "actions"],
          accounts: config.tonCenterStreamAddresses,
          min_finality: config.tonCenterStreamMinFinality,
        }),
      };

      if (options.signal) {
        requestOptions.signal = options.signal;
      }

      const response = await fetch(
        `${config.tonCenterUrl}/api/streaming/v2/sse`,
        requestOptions,
      );

      if (!response.ok || !response.body) {
        throw new Error(`TON Center SSE HTTP ${response.status}`);
      }

      console.log("📡 TON Center SSE connected");
      backoffMs = 1_000;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!options.signal?.aborted) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trimEnd();
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();
            if (payload) {
              try {
                await options.onEvent({
                  type: "message",
                  data: JSON.parse(payload) as unknown,
                });
              } catch {
                await options.onEvent({
                  type: "message",
                  data: payload,
                });
              }
            }
          }

          newlineIndex = buffer.indexOf("\n");
        }
      }

      console.log("📡 TON Center SSE disconnected; reconnecting");
    } catch (error) {
      if (options.signal?.aborted) return;

      console.error(
        "📡 TON Center SSE error:",
        error instanceof Error ? error.message : error,
      );
    }

    if (options.signal?.aborted) return;

    await Bun.sleep(backoffMs);
    backoffMs = Math.min(backoffMs * 2, 30_000);
  }
}
