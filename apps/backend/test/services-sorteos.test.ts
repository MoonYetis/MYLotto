import { describe, it, expect, vi } from "vitest";
import type { Database } from "@myloto/db";
import {
  getClosedSorteosReady,
  saveSorteoResult,
  markCalculated,
  createSorteo,
  getSorteoById,
  getSorteoAbierto,
  getGanadores,
  cerrarVencidos,
  markPagado,
} from "../src/services/sorteos.js";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";

function mockDb(
  overrides: Partial<{
    selectResult: ReturnType<typeof vi.fn>;
    updateWhereResult: ReturnType<typeof vi.fn>;
    updateReturningResult: ReturnType<typeof vi.fn>;
    insertReturningResult: ReturnType<typeof vi.fn>;
  }> = {},
): Database {
  const selectResult = overrides.selectResult ?? vi.fn().mockResolvedValue([]);
  const updateWhereResult =
    overrides.updateWhereResult ?? vi.fn().mockResolvedValue(undefined);
  const updateReturningResult =
    overrides.updateReturningResult ?? vi.fn().mockResolvedValue([]);
  const insertReturningResult =
    overrides.insertReturningResult ?? vi.fn().mockResolvedValue([{ id: 1 }]);

  // where() devuelve un thenable que también tiene .limit().
  // select usa .limit(), update usa .returning().
  const selectWhere = vi.fn().mockImplementation(() => {
    const thenable = selectResult();
    // Añadir .limit al thenable (Promise) para encadenar.
    return Object.assign(thenable, { limit: () => selectResult() });
  });
  const updateWhere = vi.fn().mockImplementation(() => {
    const thenable = updateWhereResult();
    return Object.assign(thenable, { returning: updateReturningResult });
  });

  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: selectWhere }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: updateWhere }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: insertReturningResult }),
    }),
  } as unknown as Database;
}

describe("services/sorteos", () => {
  it("getClosedSorteosReady devuelve sorteos filtrados", async () => {
    const sorteo = { id: 1n, bloqueCierre: 100, estado: "CERRADO" };
    const db = mockDb({ selectResult: vi.fn().mockResolvedValue([sorteo]) });
    const result = await getClosedSorteosReady(db, 103);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1n);
  });

  it("getClosedSorteosReady devuelve [] si ninguno listo", async () => {
    const db = mockDb();
    expect(await getClosedSorteosReady(db, 103)).toEqual([]);
  });

  it("saveSorteoResult llama a update sin lanzar", async () => {
    const db = mockDb();
    const comb: CombinacionGanadora = {
      balotas: [1, 2, 3, 4, 5],
      powerball: 6,
    };
    const bloques: BloquesSemilla = { n1: "h1", n2: "h2", n3: "h3" };
    await expect(saveSorteoResult(db, 1, comb, bloques)).resolves.toBeUndefined();
  });

  it("markCalculated llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(markCalculated(db, 1)).resolves.toBeUndefined();
  });

  it("createSorteo inserta con estado ABIERTO", async () => {
    const db = mockDb({
      insertReturningResult: vi.fn().mockResolvedValue([
        { id: 1, bloqueCierre: 200, estado: "ABIERTO" },
      ]),
    });
    const result = await createSorteo(db, 200);
    expect(result.id).toBe(1);
    expect(result.estado).toBe("ABIERTO");
  });

  it("getSorteoById devuelve la fila o null", async () => {
    const db = mockDb({
      selectResult: vi.fn().mockResolvedValue([{ id: 5, estado: "ABIERTO" }]),
    });
    expect((await getSorteoById(db, 5))?.id).toBe(5);
  });

  it("getSorteoAbierto devuelve el único ABIERTO", async () => {
    const db = mockDb({
      selectResult: vi.fn().mockResolvedValue([
        { id: 1, estado: "ABIERTO", bloqueCierre: 200 },
      ]),
    });
    const result = await getSorteoAbierto(db);
    expect(result?.id).toBe(1);
  });

  it("getGanadores devuelve lista de ganadores", async () => {
    const db = mockDb({
      selectResult: vi.fn().mockResolvedValue([
        { id: 1n, ticketId: 10n, tier: 1, monto: "680", pagado: false },
      ]),
    });
    const result = await getGanadores(db, 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.tier).toBe(1);
  });

  it("cerrarVencidos devuelve cuántos cerró", async () => {
    const db = mockDb({
      updateReturningResult: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    });
    const result = await cerrarVencidos(db, 200);
    expect(result).toBe(2);
  });

  it("markPagado actualiza pagado=true", async () => {
    const db = mockDb({
      updateReturningResult: vi.fn().mockResolvedValue([{ id: 1 }]),
    });
    const result = await markPagado(db, 1);
    expect(result).toBe(true);
  });
});
