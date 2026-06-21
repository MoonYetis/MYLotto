import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/payment-verifier.js";
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

function makeDeps(
  overrides: Partial<{
    getPending: ReturnType<typeof vi.fn>;
    markActive: ReturnType<typeof vi.fn>;
    getReceived: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    getPendingTickets: overrides.getPending ?? vi.fn().mockResolvedValue([]),
    markActive: overrides.markActive ?? vi.fn().mockResolvedValue(undefined),
    getReceived: overrides.getReceived ?? vi.fn().mockResolvedValue(0),
    logger,
    minconf: 1,
  };
}

describe("runRound (worker)", () => {
  it("sin tickets pendientes → checked 0, activated 0", async () => {
    const result = await runRound(makeDeps());
    expect(result).toEqual({ checked: 0, activated: 0 });
  });

  it("ticket pagado (received >= expected) → activado", async () => {
    const getPending = vi.fn().mockResolvedValue([
      { id: 1n, paymentAddress: "bc1q1", expectedAmount: "100" },
    ]);
    const getReceived = vi.fn().mockResolvedValue(100);
    const markActive = vi.fn().mockResolvedValue(undefined);
    const result = await runRound(
      makeDeps({ getPending, getReceived, markActive }),
    );
    expect(result).toEqual({ checked: 1, activated: 1 });
    expect(markActive).toHaveBeenCalledWith(1);
  });

  it("ticket no pagado (received < expected) → no activado", async () => {
    const getPending = vi.fn().mockResolvedValue([
      { id: 2n, paymentAddress: "bc1q2", expectedAmount: "100" },
    ]);
    const getReceived = vi.fn().mockResolvedValue(50);
    const markActive = vi.fn();
    const result = await runRound(
      makeDeps({ getPending, getReceived, markActive }),
    );
    expect(result).toEqual({ checked: 1, activated: 0 });
    expect(markActive).not.toHaveBeenCalled();
  });

  it("error individual no mata el round", async () => {
    const getPending = vi.fn().mockResolvedValue([
      { id: 1n, paymentAddress: "bc1q1", expectedAmount: "100" },
      { id: 2n, paymentAddress: "bc1q2", expectedAmount: "100" },
    ]);
    const getReceived = vi
      .fn()
      .mockRejectedValueOnce(new Error("rpc down")) // ticket 1 falla
      .mockResolvedValueOnce(100); // ticket 2 ok
    const markActive = vi.fn();
    const result = await runRound(
      makeDeps({ getPending, getReceived, markActive }),
    );
    expect(result).toEqual({ checked: 2, activated: 1 });
    expect(markActive).toHaveBeenCalledTimes(1);
    expect(markActive).toHaveBeenCalledWith(2);
    expect(logger.warn).toHaveBeenCalled();
  });
});
