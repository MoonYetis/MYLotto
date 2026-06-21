import { eq, and, lte } from "drizzle-orm";
import { sorteos, type Database, type Sorteo } from "@myloto/db";
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
