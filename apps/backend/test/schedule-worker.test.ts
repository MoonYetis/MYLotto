import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/schedule-worker.js";
import type { ScheduleWorkerDeps } from "../src/workers/schedule-worker.js";

function mockDeps(overrides: Partial<ScheduleWorkerDeps> = {}): ScheduleWorkerDeps {
  return {
    getActiveSorteo: vi.fn().mockResolvedValue({ id: 1n }),
    getBlockCount: vi.fn().mockResolvedValue(1000),
    createSorteo: vi.fn().mockResolvedValue({ id: 2n }),
    getNextDrawTime: vi.fn().mockReturnValue(new Date("2026-01-30T01:00:00Z")),
    estimateBlockAtTime: vi.fn().mockReturnValue(1500),
    logger: {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
      trace: vi.fn(), fatal: vi.fn(), child: vi.fn().mockReturnThis(),
    },
    ...overrides,
  };
}

describe("schedule-worker runRound", () => {
  it("no crea sorteo si ya hay uno ABIERTO", async () => {
    const deps = mockDeps();
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, created: 0 });
    expect(deps.createSorteo).not.toHaveBeenCalled();
  });

  it("crea sorteo si no hay ninguno ABIERTO", async () => {
    const deps = mockDeps({
      getActiveSorteo: vi.fn().mockResolvedValue(null),
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, created: 1 });
    expect(deps.createSorteo).toHaveBeenCalledWith(1500);
  });

  it("no falla si createSorteo lanza error de constraint (duplicado)", async () => {
    const deps = mockDeps({
      getActiveSorteo: vi.fn().mockResolvedValue(null),
      createSorteo: vi.fn().mockRejectedValue(new Error("unique constraint")),
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, created: 0 });
    expect(deps.logger.warn).toHaveBeenCalled();
  });
});
