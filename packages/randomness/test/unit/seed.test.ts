import { describe, it, expect } from "vitest";
import { deriveSeed } from "../../src/seed.js";
import type { BloquesSemilla } from "@myloto/types";

const HASHES: BloquesSemilla = {
  n1: "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
  n2: "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222",
  n3: "cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333",
};

describe("deriveSeed", () => {
  it("devuelve 32 bytes (SHA-256)", () => {
    const seed = deriveSeed(HASHES);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(32);
  });

  it("misma BloquesSemilla → misma semilla (determinismo)", () => {
    const s1 = deriveSeed(HASHES);
    const s2 = deriveSeed(HASHES);
    expect(Array.from(s1)).toEqual(Array.from(s2));
  });

  it("cambiar un hash → semilla distinta (avalanche)", () => {
    const modified: BloquesSemilla = {
      ...HASHES,
      n3: "ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000",
    };
    const s1 = deriveSeed(HASHES);
    const s2 = deriveSeed(modified);
    expect(Array.from(s1)).not.toEqual(Array.from(s2));
  });
});
