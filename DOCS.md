Yes. I checked the current official documentation and agent/LLM resources for the services in the final project.

One important distinction: **MCPs are not runtime dependencies of the trading bot**. They are useful for your AI/development workflow; the bot itself talks to the APIs directly.

## 1. CoinGecko / GeckoTerminal

This is the **new-pool discovery** service in the project. CoinGecko's current AI documentation explicitly provides an `llms.txt`, official TypeScript SDK documentation, and an official CoinGecko MCP. 

**Official docs**

[CoinGecko API documentation](https://docs.coingecko.com/?utm_source=chatgpt.com)
[CoinGecko Onchain / GeckoTerminal documentation](https://docs.coingecko.com/docs/querying-onchain-data.md?utm_source=chatgpt.com)
[New Pools by Network](https://docs.coingecko.com/reference/onchain-network-new-pools.md?utm_source=chatgpt.com)
[CoinGecko TypeScript SDK](https://docs.coingecko.com/docs/sdk-typescript.md?utm_source=chatgpt.com)
[CoinGecko SDK overview](https://docs.coingecko.com/docs/sdk.md?utm_source=chatgpt.com)

**LLM / AI**

[CoinGecko llms.txt](https://docs.coingecko.com/llms.txt?utm_source=chatgpt.com)
[CoinGecko AI Integration](https://docs.coingecko.com/ai-integration/index.md?utm_source=chatgpt.com)
[CoinGecko MCP](https://docs.coingecko.com/ai-integration/mcp-server.md?utm_source=chatgpt.com)
[CoinGecko Docs MCP](https://docs.coingecko.com/ai-integration/docs-mcp.md?utm_source=chatgpt.com)
[CoinGecko Agent Skill](https://docs.coingecko.com/ai-integration/agent-skill.md?utm_source=chatgpt.com)

CoinGecko's current `llms.txt` explicitly indexes its MCP, SDK and trading/onchain documentation. 

**MCP**

Official CoinGecko MCP:

[Official CoinGecko MCP documentation](https://docs.coingecko.com/ai-integration/mcp-server.md?utm_source=chatgpt.com)

Community alternatives:

[cyanheads/coingecko-mcp-server](https://github.com/cyanheads/coingecko-mcp-server?utm_source=chatgpt.com)
[Junct hosted CoinGecko MCP](https://github.com/junct-bot/coingecko-mcp?utm_source=chatgpt.com)

The Junct project currently documents a hosted Streamable HTTP MCP and links its own `llms.txt`. ([GitHub][1])

---

# 2. DEX Screener

Used for:

```text
exact pair lookup
current price
price USD
liquidity
volume
transactions
```

The official API reference currently documents `/latest/dex/pairs/{chainId}/{pairId}` and the 300 requests/minute DEX/pairs limit. ([Dexscreener Documentation][2])

**Official docs**

[DEX Screener documentation](https://docs.dexscreener.com/?utm_source=chatgpt.com)
[DEX Screener API Reference](https://docs.dexscreener.com/api/reference?utm_source=chatgpt.com)
[DEX Screener API Terms](https://docs.dexscreener.com/api/api-terms-and-conditions?utm_source=chatgpt.com)
[DEX Screener FAQ](https://docs.dexscreener.com/faq.md?utm_source=chatgpt.com)

**LLM**

[DEX Screener llms.txt](https://docs.dexscreener.com/llms.txt?utm_source=chatgpt.com)

The current DEX Screener `llms.txt` includes the API reference and explicitly provides an agent-oriented documentation query mechanism. 

**MCP**

I did not find an official DEX Screener MCP maintained by DEX Screener. There are community implementations:

[openSVM DEX Screener MCP](https://github.com/openSVM/dexscreener-mcp-server?utm_source=chatgpt.com)
[janswist DEX Screener MCP](https://github.com/janswist/mcp-dexscreener?utm_source=chatgpt.com)

The openSVM implementation exposes DEX Screener endpoints through MCP and includes rate-limit handling. ([GitHub][3])

---

# 3. DeDust

Used for:

```text
BUY quote
SELL quote
execution price
route
price impact
virtual execution
```

The current DeDust Router v2 documentation describes `/quote` as returning the best quote for swapping between assets, and the Router can aggregate liquidity across pools/protocols. ([DeDust Developer Hub][4])

**Official docs**

[DeDust Developer Hub](https://hub.dedust.io/?utm_source=chatgpt.com)
[DeDust documentation](https://docs.dedust.io/?utm_source=chatgpt.com)
[DeDust V2 SDK](https://hub.dedust.io/sdk/v2/overview/?utm_source=chatgpt.com)
[DeDust Router v2](https://hub.dedust.io/apis/router-v2/overview/?utm_source=chatgpt.com)
[DeDust Router v2 quote](https://hub.dedust.io/apis/router-v2/quote/?utm_source=chatgpt.com)
[DeDust Router v2 build swap message](https://hub.dedust.io/apis/router-v2/build-swap-message/?utm_source=chatgpt.com)
[DeDust pool reference](https://docs.dedust.io/reference/pool?utm_source=chatgpt.com)

**LLM**

DeDust explicitly provides:

[DeDust llms.txt](https://docs.dedust.io/llms.txt?utm_source=chatgpt.com)

Their current documentation says this file is an index of the documentation in Markdown plus OpenAPI endpoints for AI agents. ([DeDust][5])

**MCP**

I did **not** find a clearly maintained official DeDust MCP corresponding to the Router v2 API.

So for DeDust:

```text
Official docs     ✅
Official llms.txt ✅
Official MCP      not found
```

---

# 4. TONAPI

Used in our current project mainly for:

```text
Jetton metadata
Jetton decimals
high-level TON data
future emulation/webhooks
```

TonAPI's current official JS/TS SDK is `@ton-api/client`. ([Documentation][6])

**Official docs**

[TonAPI documentation](https://docs.tonconsole.com/tonapi?utm_source=chatgpt.com)
[TonAPI REST API](https://docs.tonconsole.com/tonapi/rest-api?utm_source=chatgpt.com)
[TonAPI Jettons](https://docs.tonconsole.com/tonapi/rest-api/jettons?utm_source=chatgpt.com)
[TonAPI Blockchain API](https://docs.tonconsole.com/tonapi/rest-api/blockchain?utm_source=chatgpt.com)
[TonAPI Emulation](https://docs.tonconsole.com/tonapi/rest-api/emulation?utm_source=chatgpt.com)
[TonAPI Webhooks](https://docs.tonconsole.com/tonapi/webhooks-api?utm_source=chatgpt.com)
[TonAPI SDK](https://docs.tonconsole.com/tonapi/sdk?utm_source=chatgpt.com)

**SDK**

[TonAPI JS/TS SDK repository](https://github.com/tonkeeper/tonapi-js?utm_source=chatgpt.com)

The current official SDK docs list `@ton-api/client` and `@ton-api/ton-adapter`. ([Documentation][6])

**LLM**

I did not find a current official `docs.tonconsole.com/llms.txt`.

So:

```text
Official docs     ✅
Official SDK      ✅
Official llms.txt not found
```

**MCP**

Third-party:

[TON API MCP by ton-ai-core](https://github.com/ton-ai-core/ton-api-mcp?utm_source=chatgpt.com)

It exposes TON API methods to MCP-compatible assistants. ([GitHub][7])

There is also:

[TonAPI JS SDK repository](https://github.com/tonkeeper/tonapi-js?utm_source=chatgpt.com)

---

# 5. TON Center

This is the blockchain-infrastructure side we discussed.

## API v2

Used for direct node-facing operations.

[TON Center API v2 overview](https://docs.ton.org/api/v2/overview?utm_source=chatgpt.com)
[TON Center v2 Swagger / API](https://toncenter.com/api/v2/?utm_source=chatgpt.com)

## API v3

Used for indexed historical/reconciliation data.

[TON Center API v3 overview](https://docs.ton.org/ecosystem/api/toncenter/v3/overview?utm_source=chatgpt.com)
[TON Center v3 Swagger UI](https://toncenter.com/api/v3/index.html?utm_source=chatgpt.com)

The current v3 documentation covers indexed blocks, transactions, messages, traces, actions, Jettons and NFTs. ([TON Docs][8])

## Streaming

[TON Center Streaming API](https://docs.ton.org/api/streaming/overview?utm_source=chatgpt.com)

It provides SSE/WebSocket subscriptions for transactions, actions, traces and state changes. ([TON Docs][9])

## Emulate

[TON Center Emulate API](https://toncenter.com/emulate/?utm_source=chatgpt.com)
[TON Center Emulate Swagger](https://toncenter.com/api/emulate/index.html?utm_source=chatgpt.com)

The current API exposes `emulateTrace` and `emulateTonConnect`. ([TON Center][10])

## LLM

TON's main documentation does have:

[TON docs llms.txt](https://docs.ton.org/llms.txt?utm_source=chatgpt.com)

It currently indexes the TON API, nodes, SDK, AI, and MCP documentation. 

## MCP

There isn't a separate official **"TON Center MCP"** that I found.

However, TON now has an official general TON MCP:

[Official TON AgentKit / @ton/mcp](https://github.com/ton-org/kit/tree/main/packages/mcp?utm_source=chatgpt.com)
[TON MCP documentation](https://docs.ton.org/onboarding/ai/mcp?utm_source=chatgpt.com)
[TON MCP / AI overview](https://docs.ton.org/onboarding/ai/overview?utm_source=chatgpt.com)

TON's current documentation describes `@ton/mcp` as its main MCP entry point for agents. ([GitHub][11])

There is also an independent direct-liteserver MCP:

[TONNode MCP](https://github.com/tonnode/mcp?utm_source=chatgpt.com)

It provides balances, account state, transactions and get-method access through native TON liteserver connectivity. ([GitHub][12])

---

# 6. Telegram Bot API

Used for:

```text
open position
TP
close position
paper balance
PnL
win rate
open/total positions
```

**Official**

[Telegram Bot API](https://core.telegram.org/bots/api?utm_source=chatgpt.com)
[Telegram Bots introduction](https://core.telegram.org/bots?utm_source=chatgpt.com)

Telegram's current Bot API documents `sendMessage`, MarkdownV2, commands, webhooks and the rest of the bot interface. ([Telegram][13])

---

# 7. grammY

Our Telegram framework.

**Docs**

[grammY documentation](https://grammy.dev/?utm_source=chatgpt.com)
[grammY API reference](https://grammy.dev/ref/?utm_source=chatgpt.com)
[grammY GitHub](https://github.com/grammyjs/grammY?utm_source=chatgpt.com)

The grammY project describes itself as a framework for Telegram bots and directly links to the Telegram Bot API reference it uses underneath. ([GitHub][14])

**LLM**

I did not find a current official `grammy.dev/llms.txt`.

So:

```text
Official docs     ✅
Official GitHub   ✅
Official llms.txt not found
```

**MCP**

No official grammY MCP is relevant to the runtime library.

---

# 8. telegram-markdown-v2

Used purely to turn our professional Markdown reports into Telegram-compatible MarkdownV2.

**Package**

[telegram-markdown-v2 on npm](https://www.npmjs.com/package/telegram-markdown-v2?utm_source=chatgpt.com)
[telegram-markdown-v2 GitHub](https://github.com/andyrightnow/telegram-markdown-v2?utm_source=chatgpt.com)

The package exposes `convert(markdown)` and outputs MarkdownV2-ready text. ([npm][15])

There is no meaningful MCP or official `llms.txt` for this small formatting library.

---

# 9. Bun

Runtime/build system for the project.

[Bun documentation](https://bun.com/docs?utm_source=chatgpt.com)
[Bun API reference](https://bun.com/docs/api?utm_source=chatgpt.com)
[Bun package manager](https://bun.com/docs/pm/cli/install?utm_source=chatgpt.com)
[Bun GitHub](https://github.com/oven-sh/bun?utm_source=chatgpt.com)

No MCP is needed for the trading runtime.

---

# Recommended LLM resource set

For an AI coding agent working on this project, I would bookmark these first:

```text
1. CoinGecko llms.txt
2. DEX Screener llms.txt
3. DeDust llms.txt
4. TON docs llms.txt
5. Telegram Bot API
6. grammY docs
```

In direct link form:

[CoinGecko llms.txt](https://docs.coingecko.com/llms.txt?utm_source=chatgpt.com)
[DEX Screener llms.txt](https://docs.dexscreener.com/llms.txt?utm_source=chatgpt.com)
[DeDust llms.txt](https://docs.dedust.io/llms.txt?utm_source=chatgpt.com)
[TON llms.txt](https://docs.ton.org/llms.txt?utm_source=chatgpt.com)

These four are the most useful **agent-readable documentation indexes** for the actual blockchain/market stack. CoinGecko, DeDust and TON explicitly provide AI/LLM-oriented documentation resources, while DEX Screener provides its own `llms.txt` and agent query instructions. 

## MCP shortlist

For your future **AI trading agent / research agent**, the useful MCPs are:

| Service         | MCP                     | Status       |
| --------------- | ----------------------- | ------------ |
| CoinGecko       | Official CoinGecko MCP  | ✅ Official   |
| TON             | `@ton/mcp` / AgentKit   | ✅ Official   |
| DEX Screener    | openSVM MCP             | 🟡 Community |
| TONAPI          | ton-ai-core TON API MCP | 🟡 Community |
| TON direct      | TONNode MCP             | 🟡 Community |
| DeDust          | Dedicated Router MCP    | ❌ Not found  |
| Telegram/grammY | Dedicated runtime MCP   | ❌ Not needed |

The official TON MCP is especially interesting for your eventual AI-agent direction because current TON documentation identifies `@ton/mcp` as the official machine/agent entry point. ([GitHub][11])

**One practical recommendation:** for this project's AI documentation layer, use **CoinGecko `llms.txt` + DeDust `llms.txt` + TON `llms.txt` + DEX Screener `llms.txt`**, and use **official MCPs only where they exist**. That gives you documentation grounding without adding MCP infrastructure to the trading bot itself.

[1]: https://github.com/junct-bot/coingecko-mcp?utm_source=chatgpt.com "GitHub - junct-bot/coingecko-mcp: Coingecko MCP server — 36 tools for AI agent access to Coingecko (analytics). Hosted by Junct. · GitHub"
[2]: https://docs.dexscreener.com/api/reference?utm_source=chatgpt.com "Reference | DEX Screener - Docs"
[3]: https://github.com/opensvm/dexscreener-mcp-server?utm_source=chatgpt.com "GitHub - openSVM/dexscreener-mcp-server · GitHub"
[4]: https://hub.dedust.io/apis/router-v2/overview/?utm_source=chatgpt.com "DeDust Router v2 | DeDust Developer Hub"
[5]: https://docs.dedust.io/recipes?utm_source=chatgpt.com "Recipes"
[6]: https://docs.tonconsole.com/tonapi/sdk?utm_source=chatgpt.com "TonAPI SDK Guide – Console Docs"
[7]: https://github.com/ton-ai-core/tonapi-mcp?utm_source=chatgpt.com "GitHub - ton-ai-core/ton-api-mcp · GitHub"
[8]: https://docs.ton.org/ecosystem/api/toncenter/v3/overview?utm_source=chatgpt.com "TON Center API v3 overview"
[9]: https://docs.ton.org/applications/api/toncenter/streaming/overview "Streaming API overview"
[10]: https://testnet.toncenter.com/api/emulate/index.html?utm_source=chatgpt.com "TON Emulate API - Swagger UI"
[11]: https://github.com/ton-org/kit/blob/main/README.md?utm_source=chatgpt.com "kit/README.md at main · ton-org/kit · GitHub"
[12]: https://github.com/tonnode/mcp/blob/main/README.md?utm_source=chatgpt.com "mcp/README.md at main · tonnode/mcp · GitHub"
[13]: https://core.telegram.org/bots/api?utm_source=chatgpt.com "Telegram Bot API"
[14]: https://github.com/grammyjs/grammy?utm_source=chatgpt.com "GitHub - grammyjs/grammY: The Telegram Bot Framework. · GitHub"
[15]: https://www.npmjs.com/package/telegram-markdown-v2?utm_source=chatgpt.com "telegram-markdown-v2 - npm"

