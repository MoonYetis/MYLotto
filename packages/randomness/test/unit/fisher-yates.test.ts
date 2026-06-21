import { describe, it, expect } from "vitest";
import { shuffle } from "../../src/fisher-yates.js";
import { Sha256CounterPrng } from "../../src/prng.js";

describe("shuffle", () => {
  it("preserva los elementos (es una permutación)", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffle(input, prng);
    expect(result.sort((a, b) => a - b)).toEqual(input);
  });

  it("determinista: mismo PRNG → mismo resultado", () => {
    const seed = new Uint8Array(32).fill(7);
    const a = new Sha256CounterPrng(seed);
    const b = new Sha256CounterPrng(seed);
    const input = Array.from({ length: 69 }, (_, i) => i + 1);
    expect(shuffle(input, a)).toEqual(shuffle(input, b));
  });

  it("no rompe con array vacío o de 1 elemento", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    expect(shuffle([], prng)).toEqual([]);
    expect(shuffle([42], prng)).toEqual([42]);
  });
});
