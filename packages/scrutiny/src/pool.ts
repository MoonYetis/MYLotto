import {
  TIER_PERCENTAGES,
  OPERATOR_RESERVE_PERCENT,
  type Tier,
} from "./tiers.js";

export interface TierResult {
  tier: Tier;
  winnerCount: number;
  /** Monto total destinado a este tier. */
  tierPool: number;
  /** Monto por ganador (tierPool / winnerCount), o 0 si no hay ganadores. */
  perWinner: number;
}

export interface DistributionResult {
  tiers: TierResult[];
  /** Monto a la reserva del operador. */
  operatorReserve: number;
  /** Monto sin reclamar que rueda al jackpot acumulable. */
  rolloverToJackpot: number;
}

/**
 * Distribuye el pool del sorteo entre los 9 tiers + reserva + jackpot.
 *
 * @param poolAmount total recaudado por boletos (FB)
 * @param tierCounts cuántos ganadores hay en cada tier [t1, t2, ..., t9]
 * @param jackpotCarryover saldo acumulado de sorteos anteriores (FB)
 *
 * Reglas:
 * - Cada tier recibe su % del pool. El tier 1 (jackpot) también recibe el carryover.
 * - Si un tier tiene 0 ganadores, su monto rueda al jackpot acumulable.
 * - La reserva del operador es fija (13% del pool).
 */
export function distributePool(
  poolAmount: number,
  tierCounts: readonly number[],
  jackpotCarryover: number,
): DistributionResult {
  const tiers: TierResult[] = [];
  let rolloverToJackpot = 0;

  for (let i = 0; i < TIER_PERCENTAGES.length; i++) {
    const tier = (i + 1) as Tier;
    const percent = TIER_PERCENTAGES[i]!;
    const tierPool = (poolAmount * percent) / 100;
    const isJackpot = tier === 1;
    const effectivePool = isJackpot ? tierPool + jackpotCarryover : tierPool;
    const winnerCount = tierCounts[i]!;

    if (winnerCount === 0) {
      rolloverToJackpot += effectivePool;
      tiers.push({ tier, winnerCount: 0, tierPool: effectivePool, perWinner: 0 });
    } else {
      tiers.push({
        tier,
        winnerCount,
        tierPool: effectivePool,
        perWinner: effectivePool / winnerCount,
      });
    }
  }

  const operatorReserve = (poolAmount * OPERATOR_RESERVE_PERCENT) / 100;

  return { tiers, operatorReserve, rolloverToJackpot };
}
