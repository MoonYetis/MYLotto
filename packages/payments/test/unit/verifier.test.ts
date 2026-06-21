import { describe, it, expect, vi } from "vitest";
import { verifyPayment } from "../../src/verifier.js";

describe("verifyPayment", () => {
  const ticket = { paymentAddress: "bc1q...", expectedAmount: 100 };

  it("paid true cuando received >= expected", async () => {
    const getReceived = vi.fn().mockResolvedValue(100);
    const result = await verifyPayment({ getReceived, ticket });
    expect(result.paid).toBe(true);
    expect(result.received).toBe(100);
    expect(result.expected).toBe(100);
  });

  it("paid false cuando received < expected", async () => {
    const getReceived = vi.fn().mockResolvedValue(50);
    const result = await verifyPayment({ getReceived, ticket });
    expect(result.paid).toBe(false);
    expect(result.received).toBe(50);
  });

  it("paid true cuando received > expected (sobrepago)", async () => {
    const getReceived = vi.fn().mockResolvedValue(150);
    const result = await verifyPayment({ getReceived, ticket });
    expect(result.paid).toBe(true);
  });

  it("getReceived recibe address y minconf (default 1)", async () => {
    const getReceived = vi.fn().mockResolvedValue(100);
    await verifyPayment({ getReceived, ticket });
    expect(getReceived).toHaveBeenCalledWith("bc1q...", 1);
  });

  it("respeta minconf custom", async () => {
    const getReceived = vi.fn().mockResolvedValue(100);
    await verifyPayment({ getReceived, ticket, minconf: 3 });
    expect(getReceived).toHaveBeenCalledWith("bc1q...", 3);
  });
});
