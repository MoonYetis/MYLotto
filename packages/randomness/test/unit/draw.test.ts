import { describe, it, expect } from "vitest";
import { drawWinningCombination } from "../../src/fisher-yates.js";
import { deriveSeed } from "../../src/seed.js";
import { Sha256CounterPrng } from "../../src/prng.js";
import type { BloquesSemilla } from "@myloto/types";

const HASHES: BloquesSemilla = {
  n1: "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
  n2: "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222",
  n3: "cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333",
};

function drawFromHashes(h: BloquesSemilla) {
  return drawWinningCombination(new Sha256CounterPrng(deriveSeed(h)));
}

describe("drawWinningCombination", () => {
  it("balotas en rango [1,69], ordenadas asc, sin repetir", () => {
    const { balotas } = drawFromHashes(HASHES);
    expect(balotas.length).toBe(5);
    for (const b of balotas) {
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(69);
    }
    for (let i = 1; i < 5; i++) {
      expect(balotas[i]).toBeGreaterThan(balotas[i - 1]!);
    }
  });

  it("powerball en rango [1,26]", () => {
    const { powerball } = drawFromHashes(HASHES);
    expect(powerball).toBeGreaterThanOrEqual(1);
    expect(powerball).toBeLessThanOrEqual(26);
  });

  it("determinista: misma semilla → misma combinación", () => {
    expect(drawFromHashes(HASHES)).toEqual(drawFromHashes(HASHES));
  });

  it("avalanche: cambiar un hash → combinación distinta", () => {
    const modified: BloquesSemilla = {
      ...HASHES,
      n3: "ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000",
    };
    expect(drawFromHashes(HASHES)).not.toEqual(drawFromHashes(modified));
  });

  it("GOLDEN VECTOR: hashes conocidos → combinación esperada exacta", () => {
    // PROTEGER: cualquier cambio al algoritmo (seed/prng/shuffle/draw) debe romper este test.
    // Vector congelado el 2026-06-21. Si se modifica el motor, recalcular y actualizar.
    const result = drawFromHashes(HASHES);
    expect(result).toEqual({
      balotas: [20, 29, 30, 32, 46],
      powerball: 22,
    });
  });
});
