/**
 * Telegram transport using grammY.
 *
 * Telegram reporting is optional. The paper engine continues to run if no
 * TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID is configured.
 */

import { Bot } from "grammy";
import { config } from "./config.js";
import type { PaperPortfolio } from "./portfolio.js";
import {
  positionsMarkdown,
  statusMarkdown,
  toTelegramMarkdown,
} from "./reporter.js";

export class TelegramReporter {
  private readonly bot: Bot | null;

  public constructor(private readonly portfolio: PaperPortfolio) {
    if (!config.telegramEnabled || !config.telegramBotToken) {
      this.bot = null;
      return;
    }

    this.bot = new Bot(config.telegramBotToken);

    this.bot.command("start", async (ctx) => {
      await this.send(
        "### 🤖 TON PAPER TRADING BOT\n\n" +
          "Paper mode is active.\n\n" +
          "Commands: `/status` · `/positions`",
        ctx.chat.id.toString(),
      );
    });

    this.bot.command("status", async (ctx) => {
      await this.send(
        statusMarkdown(this.portfolio.getStats()),
        ctx.chat.id.toString(),
      );
    });

    this.bot.command("positions", async (ctx) => {
      await this.send(
        positionsMarkdown(this.portfolio.getPositions()),
        ctx.chat.id.toString(),
      );
    });
  }

  public isEnabled(): boolean {
    return this.bot !== null && Boolean(config.telegramChatId);
  }

  /** Start grammY long polling. This resolves when polling is stopped. */
  public async start(): Promise<void> {
    if (!this.bot) return;

    console.log("📨 Telegram polling enabled");
    await this.bot.start({
      onStart: () => console.log("📨 Telegram bot started"),
    });
  }

  public stop(): void {
    this.bot?.stop();
  }

  /** Send Markdown authored by the reporting layer as MarkdownV2. */
  public async send(
    markdown: string,
    chatId = config.telegramChatId,
  ): Promise<void> {
    if (!this.bot || !chatId) return;

    await this.bot.api.sendMessage(
      chatId,
      toTelegramMarkdown(markdown),
      {
        parse_mode: "MarkdownV2",
        link_preview_options: { is_disabled: true },
      },
    );
  }

  /** Send to the configured reporting chat. */
  public async report(markdown: string): Promise<void> {
    if (!this.isEnabled()) {
      console.log(`\n${markdown}\n`);
      return;
    }

    await this.send(markdown);
  }
}
