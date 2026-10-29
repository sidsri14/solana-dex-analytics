import { type PumpTradeEvent, type WalletScoreProfile } from "./types.js";

interface WalletLedgerEntry {
  trades: PumpTradeEvent[];
  totalBuyCostLamports: bigint;
  totalTokensBought: bigint;
  totalSellRevenueLamports: bigint;
  totalTokensSold: bigint;
  closedTradesProfitLamports: bigint[];
}

export class WalletScorer {
  private ledgers: Map<string, WalletLedgerEntry> = new Map();

  /**
   * Ingests a trade event and updates the wallet's real-time position ledger.
   */
  ingestTrade(trade: PumpTradeEvent): void {
    let ledger = this.ledgers.get(trade.trader);
    if (!ledger) {
      ledger = {
        trades: [],
        totalBuyCostLamports: 0n,
        totalTokensBought: 0n,
        totalSellRevenueLamports: 0n,
        totalTokensSold: 0n,
        closedTradesProfitLamports: [],
      };
      this.ledgers.set(trade.trader, ledger);
    }

    ledger.trades.push(trade);

    if (trade.isBuy) {
      ledger.totalBuyCostLamports += trade.solAmountLamports;
      ledger.totalTokensBought += trade.tokenAmountUnits;
    } else {
      ledger.totalSellRevenueLamports += trade.solAmountLamports;
      ledger.totalTokensSold += trade.tokenAmountUnits;

      // Estimate closed trade profit if there was prior buy basis
      if (ledger.totalTokensBought > 0n) {
        const avgBuyCostPerToken = Number(ledger.totalBuyCostLamports) / Number(ledger.totalTokensBought);
        const estimatedCostBasis = BigInt(Math.floor(avgBuyCostPerToken * Number(trade.tokenAmountUnits)));
        const profit = trade.solAmountLamports - estimatedCostBasis;
        ledger.closedTradesProfitLamports.push(profit);
      }
    }
  }

  /**
   * Evaluates wallet profile, metrics, and composite trader score.
   */
  evaluateWallet(wallet: string): WalletScoreProfile {
    const ledger = this.ledgers.get(wallet);
    if (!ledger || ledger.trades.length === 0) {
      return {
        wallet,
        totalTrades: 0,
        buys: 0,
        sells: 0,
        totalVolumeSol: 0,
        realizedPnlSol: 0,
        winRate: 0,
        traderScore: 50,
        tier: "Neutral",
      };
    }

    let buys = 0;
    let sells = 0;
    let totalLamports = 0n;

    for (const t of ledger.trades) {
      if (t.isBuy) buys++;
      else sells++;
      totalLamports += t.solAmountLamports;
    }

    const totalVolumeSol = Number(totalLamports) / 1e9;
    const netProfitLamports = ledger.totalSellRevenueLamports - ledger.totalBuyCostLamports;
    const realizedPnlSol = Number(netProfitLamports) / 1e9;

    let winningTrades = 0;
    for (const p of ledger.closedTradesProfitLamports) {
      if (p > 0n) winningTrades++;
    }

    const totalClosed = ledger.closedTradesProfitLamports.length;
    const winRate = totalClosed > 0 ? winningTrades / totalClosed : 0.5;

    // Composite scoring algorithm (0 to 100)
    // 1. Win rate component (max 40 pts)
    const winRateScore = winRate * 40;

    // 2. Profit factor component (max 40 pts)
    let profitScore = 20;
    if (realizedPnlSol > 0) {
      profitScore = Math.min(40, 20 + Math.log10(realizedPnlSol + 1) * 10);
    } else if (realizedPnlSol < 0) {
      profitScore = Math.max(0, 20 - Math.log10(Math.abs(realizedPnlSol) + 1) * 10);
    }

    // 3. Activity/Consistency component (max 20 pts)
    const activityScore = Math.min(20, ledger.trades.length * 2);

    const rawScore = winRateScore + profitScore + activityScore;
    const traderScore = Math.min(100, Math.max(0, Math.round(rawScore * 10) / 10));

    let tier: WalletScoreProfile["tier"] = "Neutral";
    if (traderScore >= 80) tier = "Elite";
    else if (traderScore >= 60) tier = "Profitable";
    else if (traderScore <= 35) tier = "Unprofitable";

    return {
      wallet,
      totalTrades: ledger.trades.length,
      buys,
      sells,
      totalVolumeSol: Math.round(totalVolumeSol * 1000) / 1000,
      realizedPnlSol: Math.round(realizedPnlSol * 1000) / 1000,
      winRate: Math.round(winRate * 100) / 100,
      traderScore,
      tier,
    };
  }

  /**
   * Returns top performing wallets ranked by score.
   */
  getLeaderboard(limit: number = 10): WalletScoreProfile[] {
    const profiles: WalletScoreProfile[] = [];
    for (const wallet of this.ledgers.keys()) {
      profiles.push(this.evaluateWallet(wallet));
    }
    profiles.sort((a, b) => b.traderScore - a.traderScore);
    return profiles.slice(0, limit);
  }
}
