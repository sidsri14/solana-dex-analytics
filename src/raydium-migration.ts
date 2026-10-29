import {
  type RaydiumPoolState,
  type SwapSimulationResult,
  RAYDIUM_FEE_BPS,
  RAYDIUM_MIGRATION_FEE_SOL,
  RAYDIUM_MIGRATION_TOKEN_RESERVE,
} from "./types.js";

function integerSquareRoot(n: bigint): bigint {
  if (n < 0n) throw new Error("Square root of negative number");
  if (n === 0n) return 0n;
  let x0 = n / 2n;
  if (x0 !== 0n) {
    let x1 = (x0 + n / x0) / 2n;
    while (x1 < x0) {
      x0 = x1;
      x1 = (x0 + n / x0) / 2n;
    }
    return x0;
  }
  return 1n;
}

export class RaydiumMigrationModel {
  /**
   * Initializes a Raydium CPMM liquidity pool after Pump.fun curve graduation.
   */
  static createMigratedPool(
    mint: string,
    realSolReservesLamports: bigint
  ): RaydiumPoolState {
    if (realSolReservesLamports <= RAYDIUM_MIGRATION_FEE_SOL) {
      throw new Error("Reserves insufficient to cover Raydium migration fee");
    }

    const netSolReserves = realSolReservesLamports - RAYDIUM_MIGRATION_FEE_SOL;
    const tokenReserves = RAYDIUM_MIGRATION_TOKEN_RESERVE;
    const lpSupply = integerSquareRoot(netSolReserves * tokenReserves);

    const priceSolPerToken =
      (Number(netSolReserves) / 1e9) / (Number(tokenReserves) / 1e6);

    return {
      mint,
      solReservesLamports: netSolReserves,
      tokenReservesUnits: tokenReserves,
      lpSupply,
      priceSolPerToken,
    };
  }

  /**
   * Simulates a SOL -> Token buy on the migrated Raydium pool with 0.25% fee and price impact calculation.
   */
  static simulateBuy(
    pool: RaydiumPoolState,
    solInLamports: bigint
  ): SwapSimulationResult {
    if (solInLamports <= 0n) throw new Error("Input amount must be positive");

    const feeAmount = (solInLamports * RAYDIUM_FEE_BPS) / 10000n;
    const netSolIn = solInLamports - feeAmount;

    // deltaToken = (netSolIn * tokenReserves) / (solReserves + netSolIn)
    const newSolReserves = pool.solReservesLamports + netSolIn;
    const amountOut = (netSolIn * pool.tokenReservesUnits) / newSolReserves;
    const newTokenReserves = pool.tokenReservesUnits - amountOut;

    // Spot price before: (solReserves / 1e9) / (tokenReserves / 1e6)
    const spotPriceBefore =
      (Number(pool.solReservesLamports) / 1e9) / (Number(pool.tokenReservesUnits) / 1e6);

    // Effective execution price: (solIn / 1e9) / (amountOut / 1e6)
    const effectivePrice =
      (Number(solInLamports) / 1e9) / (Number(amountOut) / 1e6);

    const priceImpactPercent = Math.max(
      0,
      ((effectivePrice - spotPriceBefore) / spotPriceBefore) * 100
    );

    return {
      amountIn: solInLamports,
      amountOut,
      feeAmount,
      effectivePrice,
      priceImpactPercent: Math.round(priceImpactPercent * 100) / 100,
      newSolReserves: pool.solReservesLamports + solInLamports,
      newTokenReserves,
    };
  }

  /**
   * Simulates a Token -> SOL sell on the migrated Raydium pool with 0.25% fee and price impact calculation.
   */
  static simulateSell(
    pool: RaydiumPoolState,
    tokensInUnits: bigint
  ): SwapSimulationResult {
    if (tokensInUnits <= 0n) throw new Error("Input amount must be positive");

    const feeAmount = (tokensInUnits * RAYDIUM_FEE_BPS) / 10000n;
    const netTokensIn = tokensInUnits - feeAmount;

    // deltaSol = (netTokensIn * solReserves) / (tokenReserves + netTokensIn)
    const newTokenReserves = pool.tokenReservesUnits + netTokensIn;
    const amountOut = (netTokensIn * pool.solReservesLamports) / newTokenReserves;
    const newSolReserves = pool.solReservesLamports - amountOut;

    const spotPriceBefore =
      (Number(pool.solReservesLamports) / 1e9) / (Number(pool.tokenReservesUnits) / 1e6);

    const effectivePrice =
      (Number(amountOut) / 1e9) / (Number(tokensInUnits) / 1e6);

    const priceImpactPercent = Math.max(
      0,
      ((spotPriceBefore - effectivePrice) / spotPriceBefore) * 100
    );

    return {
      amountIn: tokensInUnits,
      amountOut,
      feeAmount,
      effectivePrice,
      priceImpactPercent: Math.round(priceImpactPercent * 100) / 100,
      newSolReserves,
      newTokenReserves: pool.tokenReservesUnits + tokensInUnits,
    };
  }
}
