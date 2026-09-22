/**
 * Orchestrates discovery -> quote -> paper position -> mark-to-market -> exit.
 *
 * The manager is the only module that coordinates external market/quote APIs
 * with the pure Position and PaperPortfolio state modules.
 */

import { isNativeTonPool, type NewTonPool } from "./coingecko.js";
import { getDexPair, getPairPrice } from "./dexscreener.js";
import {
  getBuyExecutionQuote,
  getSellExecutionQuote,
} from "./execution.js";
import {
  applyVirtualSell,
  createPosition,
  getHardStopPrice,
  getTakeProfitQuantityRaw,
  getTriggeredTakeProfit,
  getTrailingActivationPrice,
  getTrailingStopPrice,
  markTakeProfitTriggered,
  updatePosition,
  type ExitReason,
  type Position,
} from "./position.js";
import { PaperPortfolio } from "./portfolio.js";
import { config } from "./config.js";
import {
  getSeenPoolCount,
  pollNewPools,
  type PoolSource,
} from "./pool-scanner.js";
import {
  positionClosedMarkdown,
  positionOpenedMarkdown,
  takeProfitMarkdown,
} from "./reporter.js";
import { TelegramReporter } from "./telegram.js";

/** Pure predicate so the liquidity gate is unit-testable. */
export function meetsMinLiquidity(
  liquidityUsd: number | null | undefined,
  minLiquidityUsd: number,
): boolean {
  return (liquidityUsd ?? 0) >= minLiquidityUsd;
}

/** Coordinates all paper trading actions. */
export class PositionManager {
  private running = true;
  private idCounter = 0;
  private scanCount = 0;

  public constructor(
    private readonly portfolio: PaperPortfolio,
    private readonly reporter: TelegramReporter,
  ) {}

  public stop(): void {
    this.running = false;
  }

  /** Exposed for persistence across restarts. */
  public getIdCounter(): number {
    return this.idCounter;
  }

  /** Restore the counter from persistence (boot only). */
  public setIdCounter(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Invalid persisted id counter.");
    }
    this.idCounter = value;
  }

  /** Main concurrent loops: pool discovery and open-position monitoring. */
  public async run(): Promise<void> {
    await Promise.all([
      this.discoveryLoop(),
      this.priceLoop(),
    ]);
  }

  /** Discover and process new pools. */
  private async discoveryLoop(): Promise<void> {
    while (this.running) {
      try {
        const events = await pollNewPools();
        this.scanCount += 1;
        // Heartbeat every cycle: the oxmgr health check treats a log older
        // than 6 minutes as a stuck loop, so a quiet market must still log.
        console.log(
          `🔄 scan #${this.scanCount} ${new Date().toISOString()} | ` +
            `+${events.length} new | seen ${getSeenPoolCount()} pools | ` +
            `${this.portfolio.getOpenPositions().length} open`,
        );

        for (const event of events) {
          if (!this.running) break;
          // One bad pool (bad metadata, no quote, RPC hiccup) must not
          // abort the rest of the batch.
          try {
            await this.handleNewPool(event.pool, event.isNewToken, event.source);
          } catch (error) {
            this.logError(
              `New pool ${event.pool.poolAddress} (${event.source})`,
              error,
            );
          }
        }
      } catch (error) {
        this.logError("Pool discovery error", error);
      }

      await Bun.sleep(config.poolScanIntervalMs);
    }
  }

  /** Monitor each open position using the exact DEX Screener pair. */
  private async priceLoop(): Promise<void> {
    while (this.running) {
      try {
        const positions = this.portfolio.getOpenPositions();
        await Promise.all(
          positions.map((position) => this.monitorPosition(position)),
        );
      } catch (error) {
        this.logError("Price loop error", error);
      }

      await Bun.sleep(config.pricePollIntervalMs);
    }
  }

  /** Process a newly discovered pool without applying strategy filters. */
  private async handleNewPool(
    pool: NewTonPool,
    isNewToken: boolean,
    source: PoolSource,
  ): Promise<void> {
    console.log("\n🆕 NEW POOL");
    console.log(
      `${pool.createdAt} | ${pool.baseToken.symbol}/${pool.quoteToken.symbol} | ${pool.dexName} | via ${source}`,
    );
    console.log(`Pool      : ${pool.poolAddress}`);
    console.log(`Token     : ${pool.baseToken.symbol}`);
    console.log(`Address   : ${pool.baseToken.address}`);
    console.log(`Liquidity : $${pool.liquidityUsd ?? 0}`);
    console.log(isNewToken ? "🪙 NEW TOKEN" : "♻️ EXISTING TOKEN / NEW POOL");

    if (!config.paperAutoBuy) {
      console.log("⏭️ Auto-buy disabled");
      return;
    }

    if (!isNativeTonPool(pool)) {
      console.log("⏭️ Skip execution: quote asset is not GRAM");
      return;
    }

    if (
      !pool.dexId.includes("dedust") &&
      !pool.dexName.toLowerCase().includes("dedust")
    ) {
      console.log("⏭️ Skip execution: current paper venue is DeDust Router");
      return;
    }

    if (!meetsMinLiquidity(pool.liquidityUsd, config.minLiquidityUsd)) {
      console.log(
        `⏭️ Skip execution: liquidity $${pool.liquidityUsd ?? 0} below minimum $${config.minLiquidityUsd}`,
      );
      return;
    }

    if (this.portfolio.getOpenPositions().length >= config.maxOpenPositions) {
      console.log(
        `⏭️ Max open positions reached (${config.maxOpenPositions})`,
      );
      return;
    }

    if (
      config.onePositionPerToken &&
      this.portfolio
        .getOpenPositions()
        .some((position) => position.tokenAddress === pool.baseToken.address)
    ) {
      console.log("⏭️ Token already has an open position");
      return;
    }

    // DEX Screener can lag behind CoinGecko for a brand-new pool.
    const discoveryPair = await getDexPair(pool.poolAddress);
    if (!discoveryPair) {
      console.log("🔎 DEX Screener: discovery pair not found yet");
      return;
    }

    const discoveryReferencePrice = getPairPrice(discoveryPair);
    if (!discoveryReferencePrice) {
      console.log("⏭️ Skip execution: invalid DEX Screener discovery price");
      return;
    }

    const buyQuote = await getBuyExecutionQuote(
      pool,
      config.positionSize,
    );

    if (!buyQuote) {
      console.log("💰 No executable DeDust BUY quote");
      return;
    }

    // The router-selected pool is authoritative for the position. If strict
    // binding is disabled, re-read DEX Screener for that actual pool so the
    // reference price and subsequent mark-to-market series stay aligned with
    // the execution venue rather than the discovery pool.
    let referencePrice: number = discoveryReferencePrice;

    if (buyQuote.poolAddress !== pool.poolAddress) {
      console.log(
        `⚠️ Router pool differs from discovery pool: ${pool.poolAddress} → ${buyQuote.poolAddress}`,
      );

      const executionPair = await getDexPair(
        buyQuote.poolAddress,
      );

      if (!executionPair) {
        console.log(
          "⏭️ Skip execution: router-selected pair is not indexed by DEX Screener",
        );
        return;
      }

      const executionPrice = getPairPrice(executionPair);

      if (!executionPrice) {
        console.log(
          "⏭️ Skip execution: invalid router-selected DEX Screener price",
        );
        return;
      }

      referencePrice = executionPrice;
    }

    const beforeBalance = this.portfolio.getCashBalance();
    const entryFee = config.includeNetworkFees
      ? buyQuote.estimatedNetworkFee
      : 0;

    const position = createPosition({
      id: this.nextPositionId(),
      discoveryPoolAddress: pool.poolAddress,
      // Monitor and value the exact pool selected by the DeDust router.
      // In strict mode this equals pool.poolAddress; keeping the assignment
      // explicit prevents the execution venue from being silently dropped.
      pairAddress: buyQuote.poolAddress,
      tokenAddress: buyQuote.tokenAddress,
      tokenDecimals: buyQuote.tokenDecimals,
      baseSymbol: buyQuote.tokenSymbol,
      quoteSymbol: config.nativeSymbol,
      referenceEntryPrice: referencePrice,
      executionEntryPrice: buyQuote.executionPrice,
      quoteAmount: config.positionSize,
      receivedQuantity: Number(buyQuote.amountOut),
      receivedQuantityRaw: buyQuote.amountOutRaw,
      entryNetworkFee: entryFee,
      takeProfits: config.takeProfits.map((level) => ({
        ...level,
        triggered: false,
      })),
      hardStopLossPercent: config.hardStopLossPercent,
      trailingActivationPercent: config.trailingActivationPercent,
      trailingDistancePercent: config.trailingDistancePercent,
    });

    this.portfolio.openPosition(position);
    const afterBalance = this.portfolio.getCashBalance();
    const stats = this.portfolio.getStats();

    console.log("\n💰 EMULATED BUY");
    console.log(`Spend     : ${buyQuote.amountIn} ${config.nativeSymbol}`);
    console.log(`Receive   : ${buyQuote.amountOut} ${buyQuote.tokenSymbol}`);
    console.log(`Exec price: ${buyQuote.executionPrice}`);
    console.log(`Reference : ${referencePrice}`);
    console.log(`Balance   : ${beforeBalance.toFixed(4)} → ${afterBalance.toFixed(4)} GRAM`);
    console.log(`TP        : ${config.takeProfits.map((x) => `+${x.profitPercent}%/${x.sellPercent}%`).join(", ")}`);
    console.log(`Hard SL   : -${config.hardStopLossPercent}%`);
    console.log(`Trailing  : +${config.trailingActivationPercent}% / ${config.trailingDistancePercent}%`);

    await this.reporter.report(
      positionOpenedMarkdown({
        beforeBalance,
        afterBalance,
        stats,
        quote: buyQuote,
        position,
      }),
    );
  }

  /**
   * Update a position and process exits in deterministic priority order:
   * hard SL -> dynamic TP levels -> trailing SL.
   */
  private async monitorPosition(position: Position): Promise<void> {
    if (!position.isOpen) return;

    try {
      const pair = await getDexPair(position.pairAddress);
      if (!pair) return;

      const price = getPairPrice(pair);
      if (!price) return;

      updatePosition(position, price);

      // Hard stop is the highest-priority protective exit.
      const hardStop = getHardStopPrice(position);
      if (price <= hardStop) {
        const closed = await this.executeFullExit(
          position,
          "hard_stop_loss",
        );
        if (closed) return;
      }

      // A sharp price jump can cross multiple dynamic TP levels in one tick.
      while (position.isOpen) {
        const tp = getTriggeredTakeProfit(position);
        if (!tp) break;

        const quantityRaw = getTakeProfitQuantityRaw(position, tp);
        if (quantityRaw <= 0n) break;

        const beforeBalance = this.portfolio.getCashBalance();
        const beforeRealized = position.realizedPnl;

        const sellQuote = await getSellExecutionQuote(
          position.tokenAddress,
          quantityRaw,
          position.pairAddress,
        );

        if (!sellQuote) {
          console.log(
            `⏭️ TP +${tp.profitPercent}% waiting: no executable SELL quote`,
          );
          break;
        }

        const networkFee = config.includeNetworkFees
          ? sellQuote.estimatedNetworkFee
          : 0;

        applyVirtualSell(position, {
          quantityRaw,
          grossProceeds: Number(sellQuote.amountOut),
          networkFee,
          exitPrice: sellQuote.executionPrice,
          reason: "take_profit",
          close: tp.sellPercent >= 100 || quantityRaw === position.remainingQuantityRaw,
        });

        markTakeProfitTriggered(position, tp.profitPercent);

        this.portfolio.creditSale(
          Number(sellQuote.amountOut),
          networkFee,
        );

        const afterBalance = this.portfolio.getCashBalance();
        const tradePnl = position.realizedPnl - beforeRealized;

        if (!position.isOpen) {
          const stats = this.portfolio.getStats();
          await this.reporter.report(
            positionClosedMarkdown({
              beforeBalance,
              afterBalance,
              stats,
              quote: sellQuote,
              position,
              grossProceeds: Number(sellQuote.amountOut),
              networkFee,
            }),
          );
          return;
        }

        const stats = this.portfolio.getStats();
        await this.reporter.report(
          takeProfitMarkdown({
            beforeBalance,
            afterBalance,
            stats,
            quote: sellQuote,
            position,
            triggerPercent: tp.profitPercent,
            soldQuantity: Number(
              formatRawQuantity(quantityRaw, position.tokenDecimals),
            ),
            grossProceeds: Number(sellQuote.amountOut),
            networkFee,
            tradePnl,
          }),
        );

        // Mark-to-market again after the partial sale before checking trailing.
        updatePosition(position, price);
      }

      if (!position.isOpen) return;

      // Trailing activation occurs on exact activation-price crossing.
      const activationPrice = getTrailingActivationPrice(position);
      if (!position.trailingActive && price >= activationPrice) {
        position.trailingActive = true;
        position.trailingStopPrice = getTrailingStopPrice(position);

        console.log(
          `🔒 Trailing activated: price=${price.toFixed(12)} stop=${position.trailingStopPrice?.toFixed(12) ?? "N/A"}`,
        );
      }

      if (position.trailingActive) {
        const stop = getTrailingStopPrice(position);
        if (stop !== null) {
          if (
            position.trailingStopPrice === null ||
            stop > position.trailingStopPrice
          ) {
            position.trailingStopPrice = stop;
          }

          if (price <= position.trailingStopPrice) {
            await this.executeFullExit(position, "trailing_stop");
          }
        }
      }
    } catch (error) {
      this.logError(`Position ${position.id}`, error);
    }
  }

  /** Execute an entire remaining position through a DeDust SELL quote. */
  private async executeFullExit(
    position: Position,
    reason: Exclude<ExitReason, "take_profit" | "manual" | "error">,
  ): Promise<boolean> {
    if (!position.isOpen) return true;

    const quantityRaw = position.remainingQuantityRaw;
    if (quantityRaw <= 0n) return false;

    const sellQuote = await getSellExecutionQuote(
      position.tokenAddress,
      quantityRaw,
      position.pairAddress,
    );

    if (!sellQuote) {
      console.log(`⏭️ ${reason} waiting: no executable SELL quote`);
      return false;
    }

    const beforeBalance = this.portfolio.getCashBalance();
    const networkFee = config.includeNetworkFees
      ? sellQuote.estimatedNetworkFee
      : 0;

    applyVirtualSell(position, {
      quantityRaw,
      grossProceeds: Number(sellQuote.amountOut),
      networkFee,
      exitPrice: sellQuote.executionPrice,
      reason,
      close: true,
    });

    if (reason === "hard_stop_loss") {
      position.hardStopTriggered = true;
    } else if (reason === "trailing_stop") {
      position.trailingTriggered = true;
    }

    this.portfolio.creditSale(
      Number(sellQuote.amountOut),
      networkFee,
    );

    const afterBalance = this.portfolio.getCashBalance();
    const stats = this.portfolio.getStats();

    await this.reporter.report(
      positionClosedMarkdown({
        beforeBalance,
        afterBalance,
        stats,
        quote: sellQuote,
        position,
        grossProceeds: Number(sellQuote.amountOut),
        networkFee,
      }),
    );

    return true;
  }

  private nextPositionId(): string {
    this.idCounter += 1;
    return `paper-${Date.now()}-${this.idCounter}`;
  }

  private logError(context: string, error: unknown): void {
    console.error(
      `❌ ${context}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

function formatRawQuantity(
  raw: bigint,
  decimals: number,
): number {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  return Number(whole) + Number(fraction) / Number(base);
}
