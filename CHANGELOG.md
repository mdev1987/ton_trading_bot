# Changelog

## 2.0.1

- Fixed execution-pool identity drift between CoinGecko discovery, DEX Screener monitoring, and DeDust exits.
- Paper positions now retain the discovery pool separately from the actual execution/market pool.
- BUY quotes can be rejected when DeDust routes outside the discovered pool (`DEDUST_REQUIRE_DISCOVERED_POOL=true`).
- SELL quotes can be rejected when DeDust routes outside the position execution pool (`DEDUST_REQUIRE_SAME_POOL_ON_EXIT=true`).
- When strict BUY binding is disabled, the reference price is re-read from the router-selected pool instead of using the discovery pool price.
- Added pure route-binding regression tests.
- Telegram reports now show discovery and execution pool addresses.
