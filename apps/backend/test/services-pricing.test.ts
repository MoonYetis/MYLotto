import { describe, it, expect, vi } from "vitest";
import { resolveTicketPrice } from "../src/services/pricing.js";
import type { UnisatClient } from "@myloto/brc20";
import type { Logger } from "@myloto/config";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function deps(unisatClient: UnisatClient) {
  return {
    unisatClient,
    ticker: "Moonyetis",
    basePrice: 100,
    discountPrice: 80,
    logger,
  };
}

describe("resolveTicketPrice", () => {
  it("sin brc20Address devuelve precio completo NO_HOLDER", async () => {
    const unisat = { getBrc20Balance: vi.fn() } as unknown as UnisatClient;
    const result = await resolveTicketPrice(null, deps(unisat));
    expect(result.amount).toBe(100);
    expect(result.reason).toBe("NO_HOLDER");
    expect(unisat.getBrc20Balance).not.toHaveBeenCalled();
  });

  it("holder con balance > 0 obtiene descuento", async () => {
    const unisat = {
      getBrc20Balance: vi.fn().mockResolvedValue({ availableBalance: "950" }),
    } as unknown as UnisatClient;
    const result = await resolveTicketPrice("bc1q...", deps(unisat));
    expect(result.amount).toBe(80);
    expect(result.hasDiscount).toBe(true);
    expect(result.reason).toBe("HOLDER");
  });

  it("holder con balance 0 no obtiene descuento", async () => {
    const unisat = {
      getBrc20Balance: vi.fn().mockResolvedValue({ availableBalance: "0" }),
    } as unknown as UnisatClient;
    const result = await resolveTicketPrice("bc1q...", deps(unisat));
    expect(result.amount).toBe(100);
    expect(result.hasDiscount).toBe(false);
  });

  it("fail-closed: UniSat falla → precio completo UNISAT_FAILED", async () => {
    const unisat = {
      getBrc20Balance: vi.fn().mockRejectedValue(new Error("network down")),
    } as unknown as UnisatClient;
    const result = await resolveTicketPrice("bc1q...", deps(unisat));
    expect(result.amount).toBe(100);
    expect(result.hasDiscount).toBe(false);
    expect(result.reason).toBe("UNISAT_FAILED");
  });
});
