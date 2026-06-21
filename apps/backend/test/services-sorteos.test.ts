import { describe, it, expect, vi } from "vitest";
import type { Database } from "@myloto/db";
import {
  getClosedSorteosReady,
  saveSorteoResult,
  markCalculated,
} from "../src/services/sorteos.js";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";

function mockDb(overrides: Partial<{
  selectWhere: ReturnType<typeof vi.fn>;
  updateSetWhere: ReturnType<typeof vi.fn>;
}> = {}): Database {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: overrides.selectWhere ?? vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: overrides.updateSetWhere ?? vi.fn().mockResolvedValue(undefined),
      }),
    }),
  } as unknown as Database;
}

describe("services/sorteos", () => {
  it("getClosedSorteosReady devuelve sorteos filtrados", async () => {
    const sorteo = { id: 1n, bloqueCierre: 100, estado: "CERRADO" };
    const db = mockDb({ selectWhere: vi.fn().mockResolvedValue([sorteo]) });
    const result = await getClosedSorteosReady(db, 103);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1n);
  });

  it("getClosedSorteosReady devuelve [] si ninguno listo", async () => {
    const db = mockDb({ selectWhere: vi.fn().mockResolvedValue([]) });
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
});
