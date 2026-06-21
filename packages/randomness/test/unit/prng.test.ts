import { describe, it, expect } from "vitest";
import { Sha256CounterPrng } from "../../src/prng.js";

describe("Sha256CounterPrng", () => {
  it("randomInt(n) produce valores en [0, n)", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    for (let i = 0; i < 10000; i++) {
      const v = prng.randomInt(69);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(69);
    }
  });

  it("misma semilla → misma secuencia (determinismo)", () => {
    const seed = new Uint8Array(32).fill(42);
    const a = new Sha256CounterPrng(seed);
    const b = new Sha256CounterPrng(seed);
    const seqA = Array.from({ length: 100 }, () => a.randomInt(69));
    const seqB = Array.from({ length: 100 }, () => b.randomInt(69));
    expect(seqA).toEqual(seqB);
  });

  it("distinta semilla → secuencia distinta", () => {
    const a = new Sha256CounterPrng(new Uint8Array(32).fill(1));
    const b = new Sha256CounterPrng(new Uint8Array(32).fill(2));
    const seqA = Array.from({ length: 10 }, () => a.randomInt(69));
    const seqB = Array.from({ length: 10 }, () => b.randomInt(69));
    expect(seqA).not.toEqual(seqB);
  });

  it("distribución uniforme (69000 samples en [0,69))", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    const counts = new Array(69).fill(0);
    for (let i = 0; i < 69000; i++) counts[prng.randomInt(69)]!;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    // Cada bucket debería tener ~1000 ± 10% (rejection sampling).
    expect(max - min).toBeLessThan(100);
  });
});
