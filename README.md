# TON Paper Trading Bot — Major Version 2.0.1

A Bun + TypeScript TON paper/emulation trading bot built around:

- **CoinGecko / GeckoTerminal REST** — new-pool discovery.
- **DEX Screener REST** — exact-pair reference market price.
- **DeDust Router v2** — read-only executable BUY/SELL quotes for paper execution.
- **TONAPI REST** — Jetton metadata/decimals and high-level chain health.
- **TONAPI Emulation adapter** — future live preflight; never used for broadcast.
- **TON Center API v2/v3** — direct-node read adapter and indexed history/reconciliation adapters.
- **TON Center Streaming v2 SSE** — optional low-latency chain event adapter for future monitoring.
- **TON Center Emulate API** — future live preflight adapter.
- **grammY + telegram-markdown-v2** — professional Telegram reporting.

## Safety model

This repository is **paper/emulation only**.

There is no wallet, mnemonic, private key, signing flow, or broadcast path in `main.ts`.

DeDust is used only through the read-only Router quote endpoint. The TONAPI and TON Center emulation adapters are isolated preflight utilities and are disabled by default.

## Paper account

Default runtime configuration:

- Starting balance: **1000 GRAM**
- Position size: **10 GRAM**
- Maximum open positions: **5**
- One open position per token: **enabled**
- Automatic paper BUY: **enabled**
- Hard stop loss: **-15%**
- Trailing activation: **+40%**
- Trailing distance: **15% below highest price**
- Dynamic TP:
  - **+30% → sell 25% of remaining**
  - **+60% → sell 25% of remaining**
  - **+100% → sell 100% of remaining**

Edit these in `.env` without changing source code.

## Runtime flow

```text
CoinGecko new_pools
      ↓
new pool deduplication
      ↓
DEX Screener exact pair
      ↓
DeDust BUY quote
      ↓
TONAPI Jetton metadata
      ↓
paper position
      ↓
DEX Screener price monitoring
      ↓
TP / trailing / hard SL
      ↓
DeDust SELL quote
      ↓
paper portfolio ledger
      ↓
Telegram report
```

The first successful CoinGecko poll is a baseline. Existing pools are seeded into `seenPools` and do **not** trigger paper BUYs.

## Discovery behavior

Pool identity is the **pool address**. Token identity is the **base Jetton address**.

This means two different pools for the same Jetton are retained as two pools while still allowing the optional `ONE_POSITION_PER_TOKEN` guard to prevent duplicate open positions.

No liquidity threshold is hard-coded into discovery. Low-liquidity pools are still discoverable; the paper execution layer only proceeds when a supported native-GRAM pool has an executable DeDust quote.

The native TON/GRAM asset is identified by its canonical address, not its ticker:

```text
EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c
```

## Configuration

Copy:

```bash
cp .env.example .env
```

Set at minimum:

```env
COINGECKO_DEMO_API_KEY=...
```

For Telegram reporting:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

For authenticated TONAPI / TON Center access:

```env
TONAPI_KEY=...
TONCENTER_API_KEY=...
```

## Install

```bash
bun install
```

## Verify

```bash
bun run typecheck
bun test
```

## Run

```bash
bun run start
```

Example startup:

```text
================================
 TON PAPER TRADING BOT
================================
Version         : 2.0.1
Mode            : emulation
Paper Balance   : 1000 GRAM
Position Size   : 10 GRAM
Max Open        : 5
TP              : 30%/25%, 60%/25%, 100%/100%
Hard SL         : -15%
Trailing        : +40% / 15%
Auto Buy        : ON
Telegram        : ON
================================

🩺 SERVICE HEALTH
  TONAPI       : ✅ ...
  TON Center   : ✅ ...
  CoinGecko    : ✅ ...
  DEX Screener : ✅ ...
  DeDust       : ✅ ...
  Telegram     : ✅ ...
```

## Telegram commands

```text
/start
/status
/positions
```

Open-position reports include:

- position size
- reference market price
- effective execution price
- received token amount
- entry network fee
- balance before/after
- open/total positions
- portfolio PnL
- winrate

Close reports include:

- exit reason
- entry/exit price
- duration
- gross proceeds
- network fee
- position PnL and PnL %
- balance before/after
- open/total positions
- winrate

## Dynamic TP

The TP engine is configured through:

```env
TAKE_PROFITS=30:25,60:25,100:100
```

Format:

```text
profit_percent:sell_percent
```

The percentage is always applied to the **remaining** position, not the original quantity.

## Execution pool binding

A paper position is bound to the actual pool selected by the DeDust Router. By default, `DEDUST_REQUIRE_DISCOVERED_POOL=true` rejects a BUY when the Router does not use the exact pool that generated the discovery event. `DEDUST_REQUIRE_SAME_POOL_ON_EXIT=true` rejects a SELL when the Router changes to another pool. This prevents the DEX Screener position price feed from silently diverging from the pool backing the virtual position. The current DeDust Router v2 `/quote` API documents inputs such as amount, slippage and swap mode, but does not document a request parameter for forcing a specific pool, so the project enforces pool identity by validating the returned route instead of inventing an unsupported request field.

## Execution accounting

The paper BUY uses the DeDust Router output quantity. It does not calculate:

```text
investment / DEX Screener price
```

Instead:

```text
GRAM input
   ↓
DeDust quote
   ↓
raw Jetton output
   ↓
TONAPI decimals
   ↓
human quantity
```

The execution entry price is:

```text
quote amount / quoted received quantity
```

The DEX Screener price is retained separately as `referenceEntryPrice`.

SELLs use the exact raw Jetton quantity held by the paper position. The DeDust SELL quote determines the actual virtual GRAM proceeds.

Network fees are accounted separately when `INCLUDE_NETWORK_FEES=true`.

## TON Center adapters

`src/toncenter.ts` exposes:

- API v2 direct account reads.
- API v3 actions.
- API v3 transactions.
- API v3 Jetton transfers.
- v3 masterchain health.

`src/toncenter-stream.ts` provides an optional SSE client. It is **not** used for DEX price monitoring and is disabled by default. Because streaming systems do not recover missed events, future live state should resynchronize from v3 after reconnects.

`src/toncenter-emulate.ts` provides the Emulate API adapter for future live transaction preflight.

## TONAPI adapters

`src/tonapi.ts` provides high-level REST health checks.

`src/jetton.ts` uses the TONAPI Jetton REST endpoint for metadata and decimals, with a small TTL cache.

`src/tonapi-emulate.ts` exposes the official TonAPI TypeScript SDK emulation operation for future preflight.

## Deployment

A systemd unit is included at:

```text
deploy/ton-paper-bot.service
```

Typical installation:

```bash
sudo useradd --system --home /opt/ton-paper-bot --shell /sbin/nologin tonbot
sudo mkdir -p /opt/ton-paper-bot
sudo chown -R tonbot:tonbot /opt/ton-paper-bot
```

Copy the project to `/opt/ton-paper-bot`, create `.env`, install dependencies as the service user, then install the service:

```bash
sudo cp deploy/ton-paper-bot.service /etc/systemd/system/ton-paper-bot.service
sudo systemctl daemon-reload
sudo systemctl enable --now ton-paper-bot
sudo systemctl status ton-paper-bot
```

Adjust `/usr/local/bin/bun` in the unit if Bun is installed elsewhere.

## Services and documentation

TONAPI:
- https://docs.tonconsole.com/tonapi
- https://docs.tonconsole.com/tonapi/rest-api
- https://docs.tonconsole.com/tonapi/rest-api/emulation
- https://docs.tonconsole.com/tonapi/sdk
- https://docs.tonconsole.com/tonapi/webhooks-api

TON Center:
- https://docs.ton.org/ecosystem/api/toncenter/v2/overview
- https://docs.ton.org/ecosystem/api/toncenter/v3/overview
- https://docs.ton.org/applications/api/toncenter/streaming/overview
- https://docs.ton.org/ecosystem/api/toncenter/emulate/overview

CoinGecko Onchain:
- https://docs.coingecko.com/
- https://github.com/coingecko/coingecko-typescript

DEX Screener:
- https://docs.dexscreener.com/api/reference

DeDust Router:
- https://hub.dedust.io/apis/router-v2/quote/

## Notes

This project intentionally avoids a hard-coded liquidity threshold and does not claim that a newly discovered token is profitable. Discovery and execution are separate layers.

The market price source remains DEX Screener. The execution quantity source remains DeDust quotes. Blockchain metadata remains TONAPI. TON Center is used for blockchain infrastructure, indexed reconciliation, optional streaming, and future transaction emulation.
