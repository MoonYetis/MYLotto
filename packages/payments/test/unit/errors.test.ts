import { describe, it, expect } from "vitest";
import { PaymentError, InsufficientPaymentError } from "../../src/errors.js";

describe("errores payments", () => {
  it("PaymentError guarda message", () => {
    const err = new PaymentError("boom");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("PaymentError");
  });

  it("InsufficientPaymentError extiende PaymentError", () => {
    const err = new InsufficientPaymentError("falta plata");
    expect(err).toBeInstanceOf(PaymentError);
    expect(err.message).toBe("falta plata");
    expect(err.name).toBe("InsufficientPaymentError");
  });
});
