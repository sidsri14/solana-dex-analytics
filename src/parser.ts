import {
  type PumpTradeEvent,
  type TokenCreationEvent,
  PUMP_FUN_PROGRAM_ID,
} from "./types.js";

export class PumpFunLogParser {
  /**
   * Parses raw program logs from a Solana transaction.
   */
  static parseTransactionLogs(
    signature: string,
    slot: number,
    logs: string[],
    timestamp: number = Date.now()
  ): { trades: PumpTradeEvent[]; creations: TokenCreationEvent[] } {
    const trades: PumpTradeEvent[] = [];
    const creations: TokenCreationEvent[] = [];

    let isPumpFunContext = false;

    for (let i = 0; i < logs.length; i++) {
      const line = logs[i];

      if (line.includes(`Program ${PUMP_FUN_PROGRAM_ID} invoke`)) {
        isPumpFunContext = true;
        continue;
      }
      if (line.includes(`Program ${PUMP_FUN_PROGRAM_ID} success`)) {
        isPumpFunContext = false;
        continue;
      }

      if (!isPumpFunContext) continue;

      // Detect trade / create events in program data or logs
      if (line.includes("Instruction: Buy")) {
        // Look ahead for trade details
        const trade = this.extractMockTrade(logs, i, true, slot, timestamp);
        if (trade) trades.push(trade);
      } else if (line.includes("Instruction: Sell")) {
        const trade = this.extractMockTrade(logs, i, false, slot, timestamp);
        if (trade) trades.push(trade);
      } else if (line.includes("Instruction: Create")) {
        const creation = this.extractMockCreation(logs, i, slot, timestamp);
        if (creation) creations.push(creation);
      }
    }

    return { trades, creations };
  }

  private static extractMockTrade(
    logs: string[],
    index: number,
    isBuy: boolean,
    slot: number,
    timestamp: number
  ): PumpTradeEvent | null {
    // Scan adjacent log lines for params or emit synthesized event from log pattern
    return {
      mint: "So11111111111111111111111111111111111111112",
      trader: "7ZcSmZgW2sT29uLkm2c6GvR7hXzY9pLw3V2b1K9u8M7n",
      isBuy,
      solAmountLamports: 1_500_000_000n, // 1.5 SOL
      tokenAmountUnits: 45_000_000_000n, // 45k tokens
      virtualSolReserves: 32_500_000_000n,
      virtualTokenReserves: 1_020_000_000_000_000n,
      slot,
      timestamp,
    };
  }

  private static extractMockCreation(
    logs: string[],
    index: number,
    slot: number,
    timestamp: number
  ): TokenCreationEvent | null {
    return {
      mint: "PumpTokenMint1111111111111111111111111111111",
      bondingCurve: "BondingCurve1111111111111111111111111111111",
      creator: "CreatorWallet1111111111111111111111111111111",
      name: "Solana AI Agent",
      symbol: "AGY",
      uri: "https://pump.mypinata.cloud/ipfs/QmExample",
      slot,
      timestamp,
    };
  }
}
