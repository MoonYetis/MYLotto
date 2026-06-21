import type { CombinacionGanadora } from "@myloto/types";

export const TIER_COUNT = 9;

/** Porcentaje del pool que recibe cada tier (sobre el total recaudado). */
export const TIER_PERCENTAGES: readonly number[] = [
  68, 8, 4, 1, 1.6, 1.4, 1, 1, 1, // tiers 1-9
] as const;

/** Reserva del operador (13% del pool). */
export const OPERATOR_RESERVE_PERCENT = 13;

/** Tier 0 = sin premio. Tiers 1-9 = ganadores. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0;

/**
 * Clasifica un ticket contra la combinación ganadora.
 * @returns tier (1-9) o 0 si no gana nada.
 *
 * Tabla de tiers de Powerball (matches = balotas acertadas):
 *   5+PB=1, 5=2, 4+PB=3, 4=4, 3+PB=5, 3=6, 2+PB=7, 1+PB=8, 0+PB=9
 */
export function classifyTicket(
  ticket: { balotas: readonly number[]; powerball: number },
  ganadora: CombinacionGanadora,
): Tier {
  const balotasGanadoras = new Set(ganadora.balotas);
  const matches = ticket.balotas.filter((b) => balotasGanadoras.has(b)).length;
  const pbMatch = ticket.powerball === ganadora.powerball;

  if (matches === 5 && pbMatch) return 1;
  if (matches === 5) return 2;
  if (matches === 4 && pbMatch) return 3;
  if (matches === 4) return 4;
  if (matches === 3 && pbMatch) return 5;
  if (matches === 3) return 6;
  if (matches === 2 && pbMatch) return 7;
  if (matches === 1 && pbMatch) return 8;
  if (matches === 0 && pbMatch) return 9;
  return 0;
}
