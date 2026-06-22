import { eq, and, count } from "drizzle-orm";
import {
  sorteos,
  tickets,
  ganadores,
  jackpotPool,
  type Database,
  type Sorteo,
  type NuevoGanador,
} from "@myloto/db";

/** Lee el saldo del jackpot acumulado (singleton, default 0). */
export async function getJackpotBalance(db: Database): Promise<number> {
  const rows = await db
    .select({ saldo: jackpotPool.saldo })
    .from(jackpotPool)
    .where(eq(jackpotPool.id, 1));
  const saldo = rows[0]?.saldo ?? "0";
  return Number(saldo);
}

/** Sobrescribe el saldo del jackpot. */
export async function setJackpotBalance(
  db: Database,
  amount: number,
): Promise<void> {
  await db
    .update(jackpotPool)
    .set({ saldo: String(amount), actualizadoEn: new Date() })
    .where(eq(jackpotPool.id, 1));
}

/** Cuenta boletos ACTIVO de un sorteo. */
export async function countActiveTickets(
  db: Database,
  sorteoId: number,
): Promise<number> {
  const rows = await db
    .select({ c: count() })
    .from(tickets)
    .where(
      and(eq(tickets.sorteoId, BigInt(sorteoId)), eq(tickets.status, "ACTIVO")),
    );
  return Number(rows[0]?.c ?? 0);
}

/** Devuelve los tickets ACTIVO de un sorteo (para clasificar). */
export async function getActiveTickets(
  db: Database,
  sorteoId: number,
): Promise<
  Array<{
    id: bigint;
    n1: number;
    n2: number;
    n3: number;
    n4: number;
    n5: number;
    powerball: number;
  }>
> {
  const rows = await db
    .select({
      id: tickets.id,
      n1: tickets.n1,
      n2: tickets.n2,
      n3: tickets.n3,
      n4: tickets.n4,
      n5: tickets.n5,
      powerball: tickets.powerball,
    })
    .from(tickets)
    .where(
      and(eq(tickets.sorteoId, BigInt(sorteoId)), eq(tickets.status, "ACTIVO")),
    );
  return rows;
}

/** Inserta los ganadores de un sorteo (batch). */
export async function insertGanadores(
  db: Database,
  rows: NuevoGanador[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(ganadores).values(rows);
}

/** Sorteos en CALCULADO sin escrutar. */
export async function getCalculatedSorteos(db: Database): Promise<Sorteo[]> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(eq(sorteos.estado, "CALCULADO"));
  return rows as Sorteo[];
}

/** Transición CALCULADO → FINALIZADO. Idempotente (WHERE estado='CALCULADO'). */
export async function markFinalizado(
  db: Database,
  sorteoId: number,
): Promise<void> {
  await db
    .update(sorteos)
    .set({ estado: "FINALIZADO" })
    .where(
      and(eq(sorteos.id, BigInt(sorteoId)), eq(sorteos.estado, "CALCULADO")),
    );
}
