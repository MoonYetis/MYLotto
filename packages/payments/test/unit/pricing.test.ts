import { describe, it, expect } from "vitest";
import { calculatePrice } from "../../src/pricing.js";

describe("calculatePrice", () => {
  it("con descuento devuelve precio descontado y reason HOLDER", () => {
    const result = calculatePrice(true);
    expect(result.amount).toBe(80);
    expect(result.hasDiscount).toBe(true);
    expect(result.reason).toBe("HOLDER");
  });

  it("sin descuento devuelve precio base y reason NO_HOLDER", () => {
    const result = calculatePrice(false);
    expect(result.amount).toBe(100);
    expect(result.hasDiscount).toBe(false);
    expect(result.reason).toBe("NO_HOLDER");
  });

  it("respeta base y discount custom", () => {
    const result = calculatePrice(false, 50, 40);
    expect(result.amount).toBe(50);
    expect(result.hasDiscount).toBe(false);
  });

  it("con descuento y precios custom aplica el discount custom", () => {
    const result = calculatePrice(true, 50, 40);
    expect(result.amount).toBe(40);
    expect(result.hasDiscount).toBe(true);
  });
});
