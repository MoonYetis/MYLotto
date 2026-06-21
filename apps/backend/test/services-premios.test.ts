import { describe, it, expect, vi } from "vitest";
import type { Database } from "@myloto/db";
import {
  getJackpotBalance,
  setJackpotBalance,
  countActiveTickets,
  insertGanadores,
  getCalculatedSorteos,
  markFinalizado,
} from "../src/services/premios.js";

function mockDb(
  overrides: Partial<{
    selectWhere: ReturnType<typeof vi.fn>;
    updateSetWhere: ReturnType<typeof vi.fn>;
    insertValues: ReturnType<typeof vi.fn>;
  }> = {},
): Database {
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
    insert: vi.fn().mockReturnValue({
      values: overrides.insertValues ?? vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as Database;
}

describe("services/premios", () => {
  it("getJackpotBalance devuelve saldo (default 0)", async () => {
    const db = mockDb({
      selectWhere: vi.fn().mockResolvedValue([{ saldo: "500" }]),
    });
    expect(await getJackpotBalance(db)).toBe(500);
  });

  it("setJackpotBalance llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(setJackpotBalance(db, 1000)).resolves.toBeUndefined();
  });

  it("countActiveTickets devuelve número", async () => {
    const db = mockDb({
      selectWhere: vi.fn().mockResolvedValue([{ count: 42n }]),
    });
    expect(await countActiveTickets(db, 1)).toBe(42);
  });

  it("insertGanadores llama a insert batch", async () => {
    const db = mockDb();
    const ganadores = [
      { sorteoId: 1, ticketId: 1, tier: 1, monto: "680" },
    ];
    await expect(insertGanadores(db, ganadores)).resolves.toBeUndefined();
  });

  it("markFinalizado llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(markFinalizado(db, 1)).resolves.toBeUndefined();
  });
});
