import {
  type BondingCurveState,
  GRADUATION_REAL_SOL_TARGET,
  INITIAL_REAL_TOKEN_RESERVES,
} from "./types.js";

export class BondingCurveModel {
  /**
   * Computes instant token price in SOL from virtual reserves.
   */
  static computePrice(virtualSol: bigint, virtualToken: bigint): number {
    if (virtualToken === 0n) return 0;
    // Price = (virtualSol / 1e9) / (virtualToken / 1e6) = (virtualSol * 1e6) / (virtualToken * 1e9)
    // = virtualSol / (virtualToken * 1000)
    const solScaled = Number(virtualSol);
    const tokenScaled = Number(virtualToken);
    return solScaled / (tokenScaled * 1000);
  }

  /**
   * Computes implied fully diluted valuation (market cap) in SOL.
   * Total supply is constant 1,000,000,000 tokens (1B * 1e6 units).
   */
  static computeMarketCapSol(virtualSol: bigint, virtualToken: bigint): number {
    const price = this.computePrice(virtualSol, virtualToken);
    return price * 1_000_000_000;
  }

  /**
   * Calculates graduation progress toward Raydium liquidity migration (target: ~85 SOL).
   */
  static computeProgressPercent(realSolReserves: bigint): number {
    if (realSolReserves <= 0n) return 0;
    const progress = (Number(realSolReserves) / Number(GRADUATION_REAL_SOL_TARGET)) * 100;
    return Math.min(100, Math.max(0, Math.round(progress * 100) / 100));
  }

  /**
   * Evaluates exact bonding curve state.
   */
  static evaluateState(
    mint: string,
    virtualSol: bigint,
    virtualToken: bigint,
    realSol: bigint,
    realToken: bigint
  ): BondingCurveState {
    const progressPercent = this.computeProgressPercent(realSol);
    const isComplete = progressPercent >= 100 || realSol >= GRADUATION_REAL_SOL_TARGET;
    const priceSolPerToken = this.computePrice(virtualSol, virtualToken);
    const marketCapSol = this.computeMarketCapSol(virtualSol, virtualToken);

    return {
      mint,
      virtualSolReserves: virtualSol,
      virtualTokenReserves: virtualToken,
      realSolReserves: realSol,
      realTokenReserves: realToken,
      isComplete,
      progressPercent,
      priceSolPerToken,
      marketCapSol,
    };
  }

  /**
   * Constant product buy simulation:
   * deltaToken = (deltaSol * virtualToken) / (virtualSol + deltaSol)
   */
  static simulateBuy(
    virtualSol: bigint,
    virtualToken: bigint,
    deltaSolLamports: bigint
  ): { tokenAmountUnits: bigint; newVirtualSol: bigint; newVirtualToken: bigint } {
    if (deltaSolLamports <= 0n) throw new Error("Buy amount must be positive");
    const newVirtualSol = virtualSol + deltaSolLamports;
    const tokenAmountUnits = (deltaSolLamports * virtualToken) / newVirtualSol;
    const newVirtualToken = virtualToken - tokenAmountUnits;

    return {
      tokenAmountUnits,
      newVirtualSol,
      newVirtualToken,
    };
  }

  /**
   * Constant product sell simulation:
   * deltaSol = (deltaToken * virtualSol) / (virtualToken + deltaToken)
   */
  static simulateSell(
    virtualSol: bigint,
    virtualToken: bigint,
    deltaTokenUnits: bigint
  ): { solAmountLamports: bigint; newVirtualSol: bigint; newVirtualToken: bigint } {
    if (deltaTokenUnits <= 0n) throw new Error("Sell amount must be positive");
    const newVirtualToken = virtualToken + deltaTokenUnits;
    const solAmountLamports = (deltaTokenUnits * virtualSol) / newVirtualToken;
    const newVirtualSol = virtualSol - solAmountLamports;

    return {
      solAmountLamports,
      newVirtualSol,
      newVirtualToken,
    };
  }
}
