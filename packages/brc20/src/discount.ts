/**
 * Determina si un balance BRC-20 califica para el descuento Hold-to-Earn.
 * Regla: availableBalance > 0.
 *
 * @param availableBalance El availableBalance como string (BRC-20 usa
 *   decimales arbitrarios, por eso string, no number).
 * @returns true si el usuario tiene > 0 tokens disponibles.
 *
 * Fail-closed: strings inválidos o NaN → false.
 */
export function qualifiesForDiscount(availableBalance: string): boolean {
  const n = Number(availableBalance);
  return Number.isFinite(n) && n > 0;
}
