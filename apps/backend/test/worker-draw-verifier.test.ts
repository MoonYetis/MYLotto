import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/draw-verifier.js";
import type { Logger } from "@myloto/config";
import type { Sorteo } from "@myloto/db";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const SORTEO_READY: Sorteo = {
  id: 1n,
  bloqueCierre: 100,
  estado: "CERRADO",
  combinacionGanadora: null,
  seedMaestra: null,
  bloquesSemilla: null,
  creadoEn: new Date(),
  cerradoEn: null,
  calculadoEn: null,
};

function makeDeps(
  overrides: Partial<{
    blockCount: number;
    sorteos: Sorteo[];
    blockHashes: Record<number, string>;
    saveResult: ReturnType<typeof vi.fn>;
    markCalculated: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    getBlockCount: vi.fn().mockResolvedValue(overrides.blockCount ?? 103),
    getReadySorteos: vi.fn().mockResolvedValue(overrides.sorteos ?? []),
    getBlockHash: vi.fn().mockImplementation((h: number) =>
      Promise.resolve(overrides.blockHashes?.[h] ?? `hash-${h}`),
    ),
    saveResult: overrides.saveResult ?? vi.fn().mockResolvedValue(undefined),
    markCalculated:
      overrides.markCalculated ?? vi.fn().mockResolvedValue(undefined),
    logger,
  };
}

describe("runRound (draw-verifier)", () => {
  it("sin sorteos ready → checked 0, drawn 0", async () => {
    const result = await runRound(makeDeps());
    expect(result).toEqual({ checked: 0, drawn: 0 });
  });

  it("sorteo ready → captura hashes, calcula, persiste, marca", async () => {
    const saveResult = vi.fn();
    const markCalculated = vi.fn();
    const deps = makeDeps({
      sorteos: [SORTEO_READY],
      blockHashes: { 101: "h1", 102: "h2", 103: "h3" },
      saveResult,
      markCalculated,
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, drawn: 1 });
    expect(deps.getBlockHash).toHaveBeenCalledWith(101);
    expect(deps.getBlockHash).toHaveBeenCalledWith(102);
    expect(deps.getBlockHash).toHaveBeenCalledWith(103);
    expect(saveResult).toHaveBeenCalledTimes(1);
    expect(markCalculated).toHaveBeenCalledWith(1);
    // La combinación persistida tiene estructura válida
    const saved = saveResult.mock.calls[0]!;
    expect(saved[1].balotas).toHaveLength(5);
    expect(saved[1].powerball).toBeGreaterThanOrEqual(1);
    expect(saved[1].powerball).toBeLessThanOrEqual(26);
  });

  it("error individual no mata el round", async () => {
    const deps = makeDeps({
      sorteos: [
        { ...SORTEO_READY, id: 1n },
        { ...SORTEO_READY, id: 2n, bloqueCierre: 200 },
      ],
      blockHashes: {},
    });
    // Hacer que el primer getBlockHash (101) falle
    deps.getBlockHash = vi
      .fn()
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockResolvedValue("h");
    const result = await runRound(deps);
    expect(result.checked).toBe(2);
    expect(result.drawn).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("idempotente: getReadySorteos solo devuelve CERRADO (no recalcula CALCULADO)", async () => {
    const deps = makeDeps({ sorteos: [] });
    expect(await runRound(deps)).toEqual({ checked: 0, drawn: 0 });
    expect(deps.saveResult).not.toHaveBeenCalled();
  });
});
