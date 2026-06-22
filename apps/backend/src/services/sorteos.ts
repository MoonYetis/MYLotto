import { eq, and, lte } from "drizzle-orm";
import {
  sorteos,
  ganadores,
  type Database,
  type Sorteo,
} from "@myloto/db";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";

/**
 * Sorteos en estado CERRADO cuyos 3 bloques post-cierre ya están disponibles.
 * Ready cuando bloque_cierre + 3 <= currentHeight,
 * ie bloque_cierre <= currentHeight - 3.
 */
export async function getClosedSorteosReady(
  db: Database,
  currentHeight: number,
): Promise<Sorteo[]> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(
      and(
        eq(sorteos.estado, "CERRADO"),
        lte(sorteos.bloqueCierre, currentHeight - 3),
      ),
    );
  return rows as Sorteo[];
}

/** Persiste la combinación ganadora + los hashes de los 3 bloques semilla. */
export async function saveSorteoResult(
  db: Database,
  sorteoId: number,
  combinacion: CombinacionGanadora,
  bloques: BloquesSemilla,
): Promise<void> {
  await db
    .update(sorteos)
    .set({
      combinacionGanadora: combinacion,
      bloquesSemilla: bloques,
      calculadoEn: new Date(),
    })
    .where(eq(sorteos.id, BigInt(sorteoId)));
}

/** Transición CERRADO → CALCULADO. Idempotente (WHERE estado='CERRADO'). */
export async function markCalculated(
  db: Database,
  sorteoId: number,
): Promise<void> {
  await db
    .update(sorteos)
    .set({ estado: "CALCULADO" })
    .where(and(eq(sorteos.id, BigInt(sorteoId)), eq(sorteos.estado, "CERRADO")));
}

/** Crea un nuevo sorteo con estado ABIERTO. */
export async function createSorteo(
  db: Database,
  bloqueCierre: number,
): Promise<Sorteo> {
  const [row] = await db
    .insert(sorteos)
    .values({
      bloqueCierre,
      estado: "ABIERTO",
    })
    .returning();
  if (!row) throw new Error("createSorteo: INSERT no devolvió fila");
  return row;
}

/** Devuelve un sorteo por id completo. */
export async function getSorteoById(
  db: Database,
  id: number,
): Promise<Sorteo | null> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(eq(sorteos.id, BigInt(id)))
    .limit(1);
  return (rows[0] as Sorteo | undefined) ?? null;
}

/** Devuelve el sorteo ABIERTO único, o null. */
export async function getSorteoAbierto(db: Database): Promise<Sorteo | null> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(eq(sorteos.estado, "ABIERTO"))
    .limit(1);
  return (rows[0] as Sorteo | undefined) ?? null;
}

/** Devuelve los ganadores de un sorteo. */
export async function getGanadores(
  db: Database,
  sorteoId: number,
): Promise<
  Array<{
    id: bigint;
    ticketId: bigint;
    tier: number;
    monto: string;
    pagado: boolean;
  }>
> {
  const rows = await db
    .select({
      id: ganadores.id,
      ticketId: ganadores.ticketId,
      tier: ganadores.tier,
      monto: ganadores.monto,
      pagado: ganadores.pagado,
    })
    .from(ganadores)
    .where(eq(ganadores.sorteoId, BigInt(sorteoId)));
  return rows;
}

/** Cierra sorteos ABIERTO cuyo bloque_cierre <= currentHeight. Devuelve cuántos cerró. */
export async function cerrarVencidos(
  db: Database,
  currentHeight: number,
): Promise<number> {
  const rows = await db
    .update(sorteos)
    .set({ estado: "CERRADO", cerradoEn: new Date() })
    .where(
      and(
        eq(sorteos.estado, "ABIERTO"),
        lte(sorteos.bloqueCierre, currentHeight),
      ),
    )
    .returning({ id: sorteos.id });
  return rows.length;
}

/** Marca un ganador como pagado. Devuelve true si actualizó, false si no existía. */
export async function markPagado(
  db: Database,
  ganadorId: number,
): Promise<boolean> {
  const rows = await db
    .update(ganadores)
    .set({ pagado: true })
    .where(eq(ganadores.id, BigInt(ganadorId)))
    .returning({ id: ganadores.id });
  return rows.length > 0;
}
