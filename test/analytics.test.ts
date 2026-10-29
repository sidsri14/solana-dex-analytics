import { test } from "node:test";
import assert from "node:assert/strict";
import { BondingCurveModel } from "../src/bonding-curve.js";
import { WalletScorer } from "../src/wallet-scorer.js";
import { PumpFunLogParser } from "../src/parser.js";
import { RaydiumMigrationModel } from "../src/raydium-migration.js";
import { SignalGenerator } from "../src/signal-generator.js";
import { type PumpTradeEvent } from "../src/types.js";

test("Bonding Curve: accurately computes price, market cap, and graduation progress", () => {
  const virtualSol = 30_000_000_000n; // 30 SOL
  const virtualToken = 1_073_000_000_000_000n; // 1.073B tokens
  const realSol = 42_500_000_000n; // 42.5 SOL (50% of 85 SOL target)
  const realToken = 400_000_000_000_000n;

  const state = BondingCurveModel.evaluateState(
    "TestMint1111111111111111111111111111111111111",
    virtualSol,
    virtualToken,
    realSol,
    realToken
  );

  assert.equal(state.progressPercent, 50);
  assert.equal(state.isComplete, false);
  assert.ok(state.priceSolPerToken > 0);
  assert.ok(state.marketCapSol > 0);
});

test("Bonding Curve: enforces constant product invariant k during buy and sell", () => {
  const initialSol = 30_000_000_000n;
  const initialToken = 1_000_000_000_000_000n;
  const k = initialSol * initialToken;

  // Buy 5 SOL
  const buySim = BondingCurveModel.simulateBuy(initialSol, initialToken, 5_000_000_000n);
  assert.equal(buySim.newVirtualSol, 35_000_000_000n);
  assert.ok(buySim.tokenAmountUnits > 0n);

  const kAfterBuy = buySim.newVirtualSol * buySim.newVirtualToken;
  // Constant product precision check within integer rounding bounds
  assert.ok(k - kAfterBuy < 35_000_000_000n);

  // Sell same tokens back
  const sellSim = BondingCurveModel.simulateSell(buySim.newVirtualSol, buySim.newVirtualToken, buySim.tokenAmountUnits);
  assert.ok(sellSim.solAmountLamports > 0n);
  assert.ok(sellSim.solAmountLamports <= 5_000_000_000n); // At most what was put in
});

test("Wallet Scorer: computes win rate, realized PnL, and assigns correct tiers", () => {
  const scorer = new WalletScorer();

  const traderA = "EliteTrader_001";
  const traderB = "LossTrader_002";

  // Trader A: buys 1 SOL, sells for 3 SOL (+2 SOL profit)
  scorer.ingestTrade({
    mint: "Mint1",
    trader: traderA,
    isBuy: true,
    solAmountLamports: 1_000_000_000n,
    tokenAmountUnits: 10_000_000n,
    virtualSolReserves: 30_000_000_000n,
    virtualTokenReserves: 1_000_000_000_000_000n,
    slot: 100,
    timestamp: 1000,
  });
  scorer.ingestTrade({
    mint: "Mint1",
    trader: traderA,
    isBuy: false,
    solAmountLamports: 3_000_000_000n,
    tokenAmountUnits: 10_000_000n,
    virtualSolReserves: 32_000_000_000n,
    virtualTokenReserves: 990_000_000_000_000n,
    slot: 200,
    timestamp: 2000,
  });

  // Trader B: buys 5 SOL, sells for 2 SOL (-3 SOL loss)
  scorer.ingestTrade({
    mint: "Mint2",
    trader: traderB,
    isBuy: true,
    solAmountLamports: 5_000_000_000n,
    tokenAmountUnits: 50_000_000n,
    virtualSolReserves: 30_000_000_000n,
    virtualTokenReserves: 1_000_000_000_000_000n,
    slot: 100,
    timestamp: 1000,
  });
  scorer.ingestTrade({
    mint: "Mint2",
    trader: traderB,
    isBuy: false,
    solAmountLamports: 2_000_000_000n,
    tokenAmountUnits: 50_000_000n,
    virtualSolReserves: 27_000_000_000n,
    virtualTokenReserves: 1_050_000_000_000_000n,
    slot: 200,
    timestamp: 2000,
  });

  const profileA = scorer.evaluateWallet(traderA);
  const profileB = scorer.evaluateWallet(traderB);

  assert.equal(profileA.winRate, 1.0);
  assert.equal(profileA.realizedPnlSol, 2.0);
  assert.ok(profileA.traderScore > profileB.traderScore);

  assert.equal(profileB.winRate, 0.0);
  assert.equal(profileB.realizedPnlSol, -3.0);

  const leaderboard = scorer.getLeaderboard(2);
  assert.equal(leaderboard[0].wallet, traderA);
  assert.equal(leaderboard[1].wallet, traderB);
});

test("Log Parser: extracts Pump.fun buy, sell, and create instructions from transaction logs", () => {
  const mockLogs = [
    "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]",
    "Program log: Instruction: Create",
    "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success",
    "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]",
    "Program log: Instruction: Buy",
    "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success",
    "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]",
    "Program log: Instruction: Sell",
    "Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P success",
  ];

  const parsed = PumpFunLogParser.parseTransactionLogs("mockSig", 280001000, mockLogs);
  assert.equal(parsed.creations.length, 1);
  assert.equal(parsed.trades.length, 2);
  assert.equal(parsed.trades[0].isBuy, true);
  assert.equal(parsed.trades[1].isBuy, false);
});

test("Raydium Migration: creates CPMM pool with fee deduction and valid LP supply", () => {
  const mint = "MigratedMint11111111111111111111111111111111";
  const realSol = 85_000_000_000n; // 85 SOL at graduation

  const pool = RaydiumMigrationModel.createMigratedPool(mint, realSol);

  // 85 SOL - 6 SOL migration fee = 79 SOL
  assert.equal(pool.solReservesLamports, 79_000_000_000n);
  assert.equal(pool.tokenReservesUnits, 206_900_000_000_000n);
  assert.ok(pool.lpSupply > 0n);
  assert.ok(pool.priceSolPerToken > 0);
});

test("Raydium Migration: simulates buy with 0.25% fee and price impact", () => {
  const mint = "MigratedMint11111111111111111111111111111111";
  const pool = RaydiumMigrationModel.createMigratedPool(mint, 85_000_000_000n);

  const buySim = RaydiumMigrationModel.simulateBuy(pool, 5_000_000_000n); // 5 SOL buy

  assert.equal(buySim.amountIn, 5_000_000_000n);
  // 5 SOL * 0.25% = 12,500,000 lamports fee
  assert.equal(buySim.feeAmount, 12_500_000n);
  assert.ok(buySim.amountOut > 0n);
  assert.ok(buySim.priceImpactPercent > 0);
  assert.ok(buySim.effectivePrice > pool.priceSolPerToken);
});

test("Raydium Migration: simulates sell with 0.25% fee and price impact", () => {
  const mint = "MigratedMint11111111111111111111111111111111";
  const pool = RaydiumMigrationModel.createMigratedPool(mint, 85_000_000_000n);

  const tokensToSell = 5_000_000_000_000n; // 5M tokens
  const sellSim = RaydiumMigrationModel.simulateSell(pool, tokensToSell);

  assert.equal(sellSim.amountIn, tokensToSell);
  assert.equal(sellSim.feeAmount, (tokensToSell * 25n) / 10000n);
  assert.ok(sellSim.amountOut > 0n);
  assert.ok(sellSim.priceImpactPercent >= 0);
  assert.ok(sellSim.effectivePrice < pool.priceSolPerToken);
});

test("Signal Generator: generates high-confidence BUY signal when Elite trader buys", () => {
  const scorer = new WalletScorer();
  const eliteTrader = "EliteWhale_007";

  // Build profitable history
  scorer.ingestTrade({
    mint: "MintA",
    trader: eliteTrader,
    isBuy: true,
    solAmountLamports: 10_000_000_000n,
    tokenAmountUnits: 100_000_000n,
    virtualSolReserves: 30_000_000_000n,
    virtualTokenReserves: 1_000_000_000_000_000n,
    slot: 100,
    timestamp: 1000,
  });
  scorer.ingestTrade({
    mint: "MintA",
    trader: eliteTrader,
    isBuy: false,
    solAmountLamports: 25_000_000_000n, // +15 SOL profit
    tokenAmountUnits: 100_000_000n,
    virtualSolReserves: 40_000_000_000n,
    virtualTokenReserves: 900_000_000_000_000n,
    slot: 200,
    timestamp: 2000,
  });

  const generator = new SignalGenerator(scorer, 60);

  // Elite trader enters new token
  const newBuyTrade: PumpTradeEvent = {
    mint: "NewMintAlpha",
    trader: eliteTrader,
    isBuy: true,
    solAmountLamports: 5_000_000_000n,
    tokenAmountUnits: 50_000_000n,
    virtualSolReserves: 30_000_000_000n,
    virtualTokenReserves: 1_000_000_000_000_000n,
    slot: 300,
    timestamp: 3000,
  };

  const signal = generator.evaluateTrade(newBuyTrade);
  assert.ok(signal !== null);
  assert.equal(signal?.signalType, "BUY");
  assert.equal(signal?.trader, eliteTrader);
  assert.ok(signal?.confidencePercent! >= 70);
  assert.ok(signal?.suggestedAction.includes("COPY_BUY"));
});

test("Signal Generator: suppresses signal for Unprofitable trader (retail filter)", () => {
  const scorer = new WalletScorer();
  const lossTrader = "LossTrader_999";

  scorer.ingestTrade({
    mint: "MintB",
    trader: lossTrader,
    isBuy: true,
    solAmountLamports: 5_000_000_000n,
    tokenAmountUnits: 50_000_000n,
    virtualSolReserves: 30_000_000_000n,
    virtualTokenReserves: 1_000_000_000_000_000n,
    slot: 100,
    timestamp: 1000,
  });
  scorer.ingestTrade({
    mint: "MintB",
    trader: lossTrader,
    isBuy: false,
    solAmountLamports: 1_000_000_000n, // -4 SOL loss
    tokenAmountUnits: 50_000_000n,
    virtualSolReserves: 35_000_000_000n,
    virtualTokenReserves: 950_000_000_000_000n,
    slot: 200,
    timestamp: 2000,
  });

  const generator = new SignalGenerator(scorer, 60);

  const lossBuyTrade: PumpTradeEvent = {
    mint: "NewMintBeta",
    trader: lossTrader,
    isBuy: true,
    solAmountLamports: 2_000_000_000n,
    tokenAmountUnits: 20_000_000n,
    virtualSolReserves: 30_000_000_000n,
    virtualTokenReserves: 1_000_000_000_000_000n,
    slot: 300,
    timestamp: 3000,
  };

  const signal = generator.evaluateTrade(lossBuyTrade);
  assert.equal(signal, null); // Suppressed
});
