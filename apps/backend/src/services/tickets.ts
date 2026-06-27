import { eq, and } from "drizzle-orm";
import { sorteos, tickets, type Database } from "@myloto/db";
import type { Sorteo, Ticket } from "@myloto/db";

export interface CreateTicketInput {
  sorteoId: number;
  paymentAddress: string;
  /** Precio en FB. Drizzle lo persiste como NUMERIC(18,8). */
  expectedAmount: number;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  powerball: number;
  userReturnAddress?: string;
  walletAddress: string;
}

/** Devuelve el único sorteo ABIERTO, o null si no hay. */
export async function getActiveSorteo(db: Database): Promise<Sorteo | null> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(eq(sorteos.estado, "ABIERTO"))
    .limit(1);
  return (rows[0] as Sorteo | undefined) ?? null;
}

/** Inserta un ticket y devuelve la fila completa (con id generado). */
export async function createTicket(
  db: Database,
  input: CreateTicketInput,
): Promise<Ticket> {
  const [row] = await db
    .insert(tickets)
    .values({
      sorteoId: BigInt(input.sorteoId),
      paymentAddress: input.paymentAddress,
      expectedAmount: String(input.expectedAmount),
      status: "PENDIENTE",
      n1: input.n1,
      n2: input.n2,
      n3: input.n3,
      n4: input.n4,
      n5: input.n5,
      powerball: input.powerball,
      walletAddress: input.walletAddress,
      ...(input.userReturnAddress !== undefined
        ? { userReturnAddress: input.userReturnAddress }
        : {}),
    })
    .returning();
  if (!row) throw new Error("createTicket: INSERT no devolvió fila");
  return row;
}

/** Devuelve un ticket por id, o null. */
export async function getTicketById(db: Database, id: number): Promise<Ticket | null> {
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, BigInt(id)))
    .limit(1);
  return (rows[0] as Ticket | undefined) ?? null;
}

/** Tickets pendientes de pago (para el worker). */
export async function getPendingTickets(db: Database): Promise<Ticket[]> {
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.status, "PENDIENTE"));
  return rows as Ticket[];
}

/** Transición idempotente PENDIENTE → ACTIVO. UPDATE WHERE status='PENDIENTE'. */
export async function markActive(db: Database, id: number): Promise<void> {
  await db
    .update(tickets)
    .set({ status: "ACTIVO", recibidoEn: new Date() })
    .where(and(eq(tickets.id, BigInt(id)), eq(tickets.status, "PENDIENTE")));
}
