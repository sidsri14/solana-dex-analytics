export const PUMP_FUN_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_FUN_FEE_RECIPIENT = "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM";
export const INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000n; // 793.1M tokens with 6 decimals
export const GRADUATION_REAL_SOL_TARGET = 85_000_000_000n; // 85 SOL in lamports

export interface PumpTradeEvent {
  mint: string;
  trader: string;
  isBuy: boolean;
  solAmountLamports: bigint;
  tokenAmountUnits: bigint;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  slot: number;
  timestamp: number;
}

export interface BondingCurveState {
  mint: string;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  isComplete: boolean;
  progressPercent: number;
  priceSolPerToken: number;
  marketCapSol: number;
}

export interface WalletScoreProfile {
  wallet: string;
  totalTrades: number;
  buys: number;
  sells: number;
  totalVolumeSol: number;
  realizedPnlSol: number;
  winRate: number;
  traderScore: number; // 0 to 100
  tier: "Elite" | "Profitable" | "Neutral" | "Unprofitable";
}

export interface TokenCreationEvent {
  mint: string;
  bondingCurve: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  slot: number;
  timestamp: number;
}
