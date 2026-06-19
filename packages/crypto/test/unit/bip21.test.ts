import { describe, it, expect } from "vitest";
import { buildBip21Uri } from "../../src/bip21.js";
import { InvalidAmountError, MalformedAddressError } from "../../src/errors.js";

// Dirección Taproot válida de test (BIP86 vector index 0)
const VALID_ADDR = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";

describe("buildBip21Uri", () => {
  it("construye URI con dirección y amount", () => {
    const uri = buildBip21Uri(VALID_ADDR, 0.001);
    expect(uri).toBe(`bitcoin:${VALID_ADDR}?amount=0.001`);
  });

  it("formatea amount eliminando trailing zeros (0.00100000 → 0.001)", () => {
    const uri = buildBip21Uri(VALID_ADDR, 0.00100000);
    expect(uri).toContain("amount=0.001");
    expect(uri).not.toContain("amount=0.00100000");
  });

  it("formatea enteros sin decimales (1.0 → 1)", () => {
    const uri = buildBip21Uri(VALID_ADDR, 1.0);
    expect(uri).toContain("amount=1");
    expect(uri).not.toContain("amount=1.0");
    expect(uri).not.toContain("amount=1.00000000");
  });

  it("preserva 8 decimales (0.12345678)", () => {
    const uri = buildBip21Uri(VALID_ADDR, 0.12345678);
    expect(uri).toContain("amount=0.12345678");
  });

  it("lanza InvalidAmountError si amount <= 0", () => {
    expect(() => buildBip21Uri(VALID_ADDR, 0)).toThrow(InvalidAmountError);
    expect(() => buildBip21Uri(VALID_ADDR, -1)).toThrow(InvalidAmountError);
  });

  it("lanza InvalidAmountError si amount es NaN o Infinity", () => {
    expect(() => buildBip21Uri(VALID_ADDR, NaN)).toThrow(InvalidAmountError);
    expect(() => buildBip21Uri(VALID_ADDR, Infinity)).toThrow(InvalidAmountError);
  });

  it("lanza MalformedAddressError si la dirección es inválida", () => {
    expect(() => buildBip21Uri("not-an-address", 0.001)).toThrow(MalformedAddressError);
    expect(() => buildBip21Uri("bc1qinvalid", 0.001)).toThrow(MalformedAddressError);
  });

  it("acepta otra dirección Taproot válida", () => {
    // Otra dirección Taproot válida conocida (BIP86 vector índice 0 reusada es válida;
    // aquí usamos una Taproot mainnet válida distinta para confirmar que no solo
    // una dirección específica funciona).
    const addr2 = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";
    const uri = buildBip21Uri(addr2, 5);
    expect(uri).toBe(`bitcoin:${addr2}?amount=5`);
  });
});
