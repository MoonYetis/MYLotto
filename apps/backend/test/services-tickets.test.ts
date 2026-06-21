import { describe, it, expect, vi } from "vitest";
import type { Database } from "@myloto/db";
import {
  getActiveSorteo,
  createTicket,
  getTicketById,
  getPendingTickets,
  markActive,
} from "../src/services/tickets.js";

// Mock del db Drizzle: interceptamos los métodos query builder que usamos.
function mockDb(overrides: Partial<{
  selectFromWhereLimit: ReturnType<typeof vi.fn>;
  insertValuesReturning: ReturnType<typeof vi.fn>;
  updateSetWhere: ReturnType<typeof vi.fn>;
}> = {}): Database {
  const selectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: overrides.selectFromWhereLimit ?? vi.fn().mockResolvedValue([]),
      }),
    }),
  };
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: overrides.insertValuesReturning ?? vi.fn().mockResolvedValue([{ id: 1 }]),
    }),
  };
  const updateChain = {
    set: vi.fn().mockReturnValue({
      where: overrides.updateSetWhere ?? vi.fn().mockResolvedValue(undefined),
    }),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
  } as unknown as Database;
}

describe("services/tickets", () => {
  it("getActiveSorteo devuelve el sorteo ABIERTO", async () => {
    const abierto = { id: 1, estado: "ABIERTO", bloqueCierre: 100 };
    const db = mockDb({ selectFromWhereLimit: vi.fn().mockResolvedValue([abierto]) });
    const result = await getActiveSorteo(db);
    expect(result).toEqual(abierto);
  });

  it("getActiveSorteo devuelve null si no hay ABIERTO", async () => {
    const db = mockDb({ selectFromWhereLimit: vi.fn().mockResolvedValue([]) });
    const result = await getActiveSorteo(db);
    expect(result).toBeNull();
  });

  it("createTicket inserta y devuelve la fila con id", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 42, status: "PENDIENTE" }]);
    const db = mockDb({ insertValuesReturning: returning });
    const result = await createTicket(db, {
      sorteoId: 1,
      paymentAddress: "bc1q...",
      expectedAmount: 100,
      n1: 1, n2: 2, n3: 3, n4: 4, n5: 5,
      powerball: 6,
    });
    expect(result.id).toBe(42);
    expect(result.status).toBe("PENDIENTE");
  });

  it("getTicketById devuelve la fila o null", async () => {
    const db = mockDb({ selectFromWhereLimit: vi.fn().mockResolvedValue([{ id: 7 }]) });
    expect((await getTicketById(db, 7))?.id).toBe(7);
    const db2 = mockDb({ selectFromWhereLimit: vi.fn().mockResolvedValue([]) });
    expect(await getTicketById(db2, 99)).toBeNull();
  });

  it("getPendingTickets devuelve array (posiblemente vacío)", async () => {
    // getPendingTickets usa select().from().where() sin limit; mockeamos el chain
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
        }),
      }),
    } as unknown as Database;
    const result = await getPendingTickets(db);
    expect(result).toHaveLength(2);
  });

  it("markActive llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(markActive(db, 5)).resolves.toBeUndefined();
  });
});
