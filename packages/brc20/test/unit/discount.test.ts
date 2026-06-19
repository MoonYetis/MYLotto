import { describe, it, expect } from "vitest";
import { qualifiesForDiscount } from "../../src/discount.js";

describe("qualifiesForDiscount", () => {
  it("balance > 0 califica", () => {
    expect(qualifiesForDiscount("1000")).toBe(true);
    expect(qualifiesForDiscount("0.5")).toBe(true);
    expect(qualifiesForDiscount("1")).toBe(true);
    expect(qualifiesForDiscount("0.00000001")).toBe(true);
  });

  it("balance = 0 NO califica", () => {
    expect(qualifiesForDiscount("0")).toBe(false);
  });

  it("balance negativo NO califica", () => {
    expect(qualifiesForDiscount("-100")).toBe(false);
  });

  it("string inválido NO califica (fail-closed)", () => {
    expect(qualifiesForDiscount("invalid")).toBe(false);
  });

  it("string vacío NO califica (fail-closed)", () => {
    expect(qualifiesForDiscount("")).toBe(false);
  });

  it("notación científica válida funciona", () => {
    expect(qualifiesForDiscount("1e2")).toBe(true); // 100
  });
});
