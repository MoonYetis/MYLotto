import type { CombinacionGanadora } from "@myloto/types";
import type { Sha256CounterPrng } from "./prng.js";

/**
 * Fisher-Yates (variante Durstenfeld) shuffle sobre una copia.
 * Produce una permutación uniforme usando el PRNG inyectado.
 */
export function shuffle<T>(
  arr: readonly T[],
  prng: Sha256CounterPrng,
): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = prng.randomInt(i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * Genera la combinación ganadora de un sorteo.
 *
 * 1. Fisher-Yates shuffle de [1..69].
 * 2. Primeras 5 posiciones → balotas (ordenadas asc).
 * 3. Powerball = siguiente randomInt(26) + 1 → [1..26].
 */
export function drawWinningCombination(
  prng: Sha256CounterPrng,
): CombinacionGanadora {
  const pool = Array.from({ length: 69 }, (_, i) => i + 1);
  const shuffled = shuffle(pool, prng);
  const balotas = shuffled.slice(0, 5).sort((a, b) => a - b);
  const powerball = prng.randomInt(26) + 1;
  return {
    balotas: [balotas[0]!, balotas[1]!, balotas[2]!, balotas[3]!, balotas[4]!],
    powerball,
  };
}
