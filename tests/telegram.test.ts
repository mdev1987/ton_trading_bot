import { describe, expect, test } from "bun:test";
import { statusMarkdown, toTelegramMarkdown } from "../src/reporter.js";

const stats = {
  initialBalance: 1000,
  cashBalance: 990,
  marketValue: 20,
  equity: 1010,
  realizedPnl: 5,
  unrealizedPnl: 5,
  totalPnl: 10,
  totalPnlPercent: 1,
  totalPositions: 2,
  openPositions: 1,
  closedPositions: 1,
  wins: 1,
  losses: 0,
  breakeven: 0,
  winrate: 100,
};

describe("Telegram formatter", () => {
  test("converts Markdown without throwing", () => {
    const markdown = statusMarkdown(stats);
    const converted = toTelegramMarkdown(markdown);

    expect(converted.length).toBeGreaterThan(0);
    expect(converted).not.toContain("###");
  });
});
