import { describe, it, expect } from "vitest";
import { isValidBitcoinAddress } from "../../src/validate-address.js";

describe("isValidBitcoinAddress", () => {
  it("acepta Taproot (bc1p)", () => {
    expect(
      isValidBitcoinAddress(
        "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
      ),
    ).toBe(true);
  });

  it("acepta SegWit (bc1q)", () => {
    expect(
      isValidBitcoinAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"),
    ).toBe(true);
  });

  it("acepta Legacy (1...)", () => {
    expect(isValidBitcoinAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2")).toBe(true);
  });

  it("acepta P2SH (3...)", () => {
    expect(isValidBitcoinAddress("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")).toBe(true);
  });

  it("rechaza testnet (tb1q)", () => {
    expect(
      isValidBitcoinAddress("tb1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"),
    ).toBe(false);
  });

  it("rechaza string inválido", () => {
    expect(isValidBitcoinAddress("invalid")).toBe(false);
  });

  it("rechaza string vacío", () => {
    expect(isValidBitcoinAddress("")).toBe(false);
  });

  it("rechaza dirección truncada", () => {
    expect(isValidBitcoinAddress("bc1p5cyxnuxmeuwuvkwfem")).toBe(false);
  });
});
