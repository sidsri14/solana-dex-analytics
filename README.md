# Solana DEX & Pump.fun Analytics Engine

High-performance TypeScript analytics engine for Solana memecoin bonding curves, decentralized exchange migrations, and smart-money wallet profiling.

[![Test Status](https://img.shields.io/badge/tests-9%2F9%20passing-brightgreen)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

1. **Pump.fun Bonding Curve Simulator & Migration Tracker**:
   - Computes virtual and real token/SOL reserves using exact constant-product integer arithmetic ($x \cdot y = k$).
   - Calculates real-time price in SOL, fully diluted market cap, and Raydium graduation progress towards the 85 SOL target.
   - Zero floating-point rounding issues via standard AMM integer division with directional remainder handling.

2. **Raydium CPMM Pool Modeling & Slippage Simulator**:
   - Models post-graduation liquidity migration (85 SOL minus 6 SOL migration fee = 79 SOL seed + 206.9M tokens).
   - Computes integer square root LP token supply initialization.
   - Simulates Raydium CPMM swaps (SOL $\to$ Token and Token $\to$ SOL) with standard 0.25% fee (25 bps) and exact price impact percentage.

3. **Smart-Money Wallet Profiler**:
   - Calculates realized profit & loss (PnL in SOL), total trading volume, win rate, and trade count across tokens.
   - Implements a composite scoring algorithm (0–100) weighting Win Rate (40%), Total PnL (40%), and Activity Volume (20%).
   - Classifies wallets into actionable tiers: `ELITE`, `PROFITABLE`, `NEUTRAL`, `UNPROFITABLE`.

4. **Algorithmic Copy-Trade Signal Generator**:
   - Evaluates incoming trade streams against profiled smart money.
   - Triggers automated `COPY_BUY` signals when `Elite` or `Profitable` traders enter early curve phases (<30% progress).
   - Emits `TAKE_PROFIT` / `COPY_SELL` signals on position exit while suppressing noise from unprofitable/retail wallets.

5. **Transaction Log Parser**:
   - Extracts Pump.fun program instruction logs from raw Solana RPC transaction logs.
   - Parses `Create`, `Buy`, and `Sell` events, extracting trader pubkey, mint pubkey, lamports, and token units.

---

## Architecture & Code Structure

```
solana-dex-analytics/
├── src/
│   ├── types.ts           # Type definitions for bonding curve state, trades, wallet scores
│   ├── bonding-curve.ts   # AMM pricing, curve simulation, and graduation tracker
│   ├── wallet-scorer.ts   # PnL accounting, win rate, and smart-money tiering
│   ├── parser.ts          # Solana program log parser for Pump.fun events
│   └── index.ts           # Demo runner and CLI pipeline
├── test/
│   └── analytics.test.ts  # Node.js native test runner suite (4/4 passing)
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
- Node.js >= 20.x

### Installation
```bash
git clone https://github.com/sidsri14/solana-dex-analytics.git
cd solana-dex-analytics
npm install
```

### Running Tests
```bash
npm test
```

### Type Checking
```bash
npm run build
```

---

## License
MIT
