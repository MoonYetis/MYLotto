import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/scrutiny-verifier.js";
import type { Logger } from "@myloto/config";
import type { Sorteo } from "@myloto/db";
import type { CombinacionGanadora } from "@myloto/types";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const COMB: CombinacionGanadora = {
  balotas: [10, 20, 30, 40, 50],
  powerball: 5,
};

const SORTEO_CALCULADO: Sorteo = {
  id: 1n,
  bloqueCierre: 100,
  estado: "CALCULADO",
  combinacionGanadora: COMB,
  seedMaestra: null,
  bloquesSemilla: null,
  creadoEn: new Date(),
  cerradoEn: null,
  calculadoEn: null,
};

const TICKETS = [
  { id: 1n, n1: 10, n2: 20, n3: 30, n4: 40, n5: 50, powerball: 5 }, // tier 1 (jackpot)
  { id: 2n, n1: 11, n2: 22, n3: 33, n4: 44, n5: 55, powerball: 9 }, // tier 0 (sin premio)
  { id: 3n, n1: 10, n2: 20, n3: 30, n4: 45, n5: 60, powerball: 5 }, // tier 5 (3+PB)
];

function makeDeps(
  overrides: Partial<{
    sorteos: Sorteo[];
    ticketCount: number;
    tickets: typeof TICKETS;
    jackpot: number;
    insertGanadores: ReturnType<typeof vi.fn>;
    setJackpot: ReturnType<typeof vi.fn>;
    markFinalizado: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    getCalculatedSorteos: vi.fn().mockResolvedValue(overrides.sorteos ?? []),
    countActiveTickets: vi.fn().mockResolvedValue(overrides.ticketCount ?? 0),
    getActiveTickets: vi.fn().mockResolvedValue(overrides.tickets ?? []),
    getJackpotBalance: vi.fn().mockResolvedValue(overrides.jackpot ?? 0),
    setJackpotBalance:
      overrides.setJackpot ?? vi.fn().mockResolvedValue(undefined),
    insertGanadores:
      overrides.insertGanadores ?? vi.fn().mockResolvedValue(undefined),
    markFinalizado:
      overrides.markFinalizado ?? vi.fn().mockResolvedValue(undefined),
    ticketPrice: 100,
    logger,
  };
}

describe("runRound (scrutiny-verifier)", () => {
  it("sin sorteos CALCULADO → checked 0, finalized 0", async () => {
    const result = await runRound(makeDeps());
    expect(result).toEqual({ checked: 0, finalized: 0 });
  });

  it("sorteo con tickets → clasifica, distribuye, persiste, finaliza", async () => {
    const insertGanadores = vi.fn();
    const setJackpot = vi.fn();
    const markFinalizado = vi.fn();
    const deps = makeDeps({
      sorteos: [SORTEO_CALCULADO],
      ticketCount: 3,
      tickets: TICKETS,
      jackpot: 0,
      insertGanadores,
      setJackpot,
      markFinalizado,
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, finalized: 1 });
    // 2 ganadores (tier 1 y tier 5)
    expect(insertGanadores).toHaveBeenCalledTimes(1);
    const ganadoresInserted = insertGanadores.mock.calls[0]![0] as Array<{
      tier: number;
      monto: string;
    }>;
    expect(ganadoresInserted).toHaveLength(2);
    expect(ganadoresInserted.map((g) => g.tier).sort()).toEqual([1, 5]);
    // Montos > 0
    expect(ganadoresInserted[0]!.monto).toMatch(/[^0]/);
    // Finalizado
    expect(markFinalizado).toHaveBeenCalledWith(1);
  });

  it("error individual no mata el round", async () => {
    const deps = makeDeps({
      sorteos: [
        SORTEO_CALCULADO,
        { ...SORTEO_CALCULADO, id: 2n },
      ],
      ticketCount: 3,
      tickets: TICKETS,
    });
    // Hacer que el primer sorteo falle en getActiveTickets
    deps.getActiveTickets = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(TICKETS);
    const result = await runRound(deps);
    expect(result.checked).toBe(2);
    expect(result.finalized).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("idempotente: no recalcula sorteo FINALIZADO", async () => {
    const deps = makeDeps({ sorteos: [] });
    expect(await runRound(deps)).toEqual({ checked: 0, finalized: 0 });
    expect(deps.insertGanadores).not.toHaveBeenCalled();
  });
});
