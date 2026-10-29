import {
  type CopyTradeSignal,
  type PumpTradeEvent,
  type BondingCurveState,
} from "./types.js";
import { WalletScorer } from "./wallet-scorer.js";

export class SignalGenerator {
  private scorer: WalletScorer;
  private minScoreThreshold: number;

  constructor(scorer: WalletScorer, minScoreThreshold: number = 60) {
    this.scorer = scorer;
    this.minScoreThreshold = minScoreThreshold;
  }

  /**
   * Evaluates a trade event and optional curve state to determine if a copy-trade signal should be emitted.
   */
  evaluateTrade(
    trade: PumpTradeEvent,
    curveState?: BondingCurveState
  ): CopyTradeSignal | null {
    const profile = this.scorer.evaluateWallet(trade.trader);

    // Only generate signals for Elite or Profitable traders meeting the minimum score threshold
    if (
      (profile.tier === "Elite" || profile.tier === "Profitable") &&
      profile.traderScore >= this.minScoreThreshold
    ) {
      const confidence = Math.min(
        100,
        Math.round(profile.traderScore * 0.7 + profile.winRate * 30)
      );

      const action = trade.isBuy
        ? `COPY_BUY: High-win-rate trader (${(profile.winRate * 100).toFixed(0)}%, net +${profile.realizedPnlSol.toFixed(1)} SOL) entered${curveState ? ` at ${curveState.progressPercent}% curve progress` : ""}`
        : `TAKE_PROFIT / COPY_SELL: ${profile.tier} trader (${profile.traderScore}/100) exiting position`;

      return {
        mint: trade.mint,
        signalType: trade.isBuy ? "BUY" : "SELL",
        trader: trade.trader,
        traderTier: profile.tier,
        traderScore: profile.traderScore,
        winRate: profile.winRate,
        confidencePercent: confidence,
        solAmountLamports: trade.solAmountLamports,
        suggestedAction: action,
        timestamp: trade.timestamp,
      };
    }

    return null;
  }
}
