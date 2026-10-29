export * from "./types.js";
export * from "./bonding-curve.js";
export * from "./wallet-scorer.js";
export * from "./parser.js";
export * from "./raydium-migration.js";

import { BondingCurveModel } from "./bonding-curve.js";
import { WalletScorer } from "./wallet-scorer.js";
import { RaydiumMigrationModel } from "./raydium-migration.js";
import { type PumpTradeEvent } from "./types.js";

// CLI execution simulation
if (process.argv[1]?.includes("index")) {
  console.log("=== Solana Pump.fun & DEX Analytics Engine ===");

  // 1. Evaluate Bonding Curve State
  const initialSol = 30_000_000_000n; // 30 SOL virtual
  const initialToken = 1_073_000_000_000_000n; // 1.073B virtual
  const realSol = 45_000_000_000n; // 45 SOL real deposits
  const realToken = 400_000_000_000_000n;

  const state = BondingCurveModel.evaluateState(
    "PumpTokenMint1111111111111111111111111111111",
    initialSol,
    initialToken,
    realSol,
    realToken
  );

  console.log("\n[Bonding Curve State]:", {
    mint: state.mint,
    progressPercent: `${state.progressPercent}%`,
    priceSolPerToken: state.priceSolPerToken.toExponential(6),
    marketCapSol: `${state.marketCapSol.toFixed(2)} SOL`,
    isComplete: state.isComplete,
  });

  // 2. Buy Simulation
  const buySim = BondingCurveModel.simulateBuy(initialSol, initialToken, 5_000_000_000n);
  console.log("\n[Simulate Buy 5 SOL]:", {
    tokensReceived: (Number(buySim.tokenAmountUnits) / 1e6).toFixed(2),
    newVirtualSol: `${Number(buySim.newVirtualSol) / 1e9} SOL`,
  });

  // 3. Wallet Analytics & Scoring
  const scorer = new WalletScorer();

  const mockTrades: PumpTradeEvent[] = [
    {
      mint: state.mint,
      trader: "WalletAlpha_Elite",
      isBuy: true,
      solAmountLamports: 10_000_000_000n, // 10 SOL
      tokenAmountUnits: 200_000_000_000n,
      virtualSolReserves: initialSol,
      virtualTokenReserves: initialToken,
      slot: 280001000,
      timestamp: Date.now() - 3600_000,
    },
    {
      mint: state.mint,
      trader: "WalletAlpha_Elite",
      isBuy: false,
      solAmountLamports: 18_000_000_000n, // 18 SOL (profit: +8 SOL)
      tokenAmountUnits: 200_000_000_000n,
      virtualSolReserves: initialSol + 8_000_000_000n,
      virtualTokenReserves: initialToken - 200_000_000_000n,
      slot: 280001500,
      timestamp: Date.now() - 1800_000,
    },
    {
      mint: state.mint,
      trader: "WalletBeta_Loss",
      isBuy: true,
      solAmountLamports: 5_000_000_000n,
      tokenAmountUnits: 80_000_000_000n,
      virtualSolReserves: initialSol,
      virtualTokenReserves: initialToken,
      slot: 280002000,
      timestamp: Date.now() - 1200_000,
    },
    {
      mint: state.mint,
      trader: "WalletBeta_Loss",
      isBuy: false,
      solAmountLamports: 2_500_000_000n, // -2.5 SOL
      tokenAmountUnits: 80_000_000_000n,
      virtualSolReserves: initialSol - 2_500_000_000n,
      virtualTokenReserves: initialToken + 80_000_000_000n,
      slot: 280002200,
      timestamp: Date.now() - 600_000,
    },
  ];

  for (const t of mockTrades) {
    scorer.ingestTrade(t);
  }

  const leaderboard = scorer.getLeaderboard(5);
  console.log("\n[Top Trader Leaderboard]:");
  leaderboard.forEach((p, idx) => {
    console.log(
      `${idx + 1}. [${p.tier}] ${p.wallet} | Score: ${p.traderScore}/100 | WinRate: ${p.winRate * 100}% | NetPnL: ${p.realizedPnlSol > 0 ? "+" : ""}${p.realizedPnlSol} SOL | Vol: ${p.totalVolumeSol} SOL`
    );
  });
}
