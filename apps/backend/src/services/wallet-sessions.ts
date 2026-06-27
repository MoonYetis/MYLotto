import { eq, lt } from "drizzle-orm";
import { walletSessions, type Database } from "@myloto/db";

/** Crea un nonce para una address. Borra nonces anteriores de la misma address. */
export async function createNonce(db: Database, address: string, nonce: string): Promise<void> {
  // Borrar nonces anteriores de esta address (un solo nonce activo por wallet)
  await db.delete(walletSessions).where(eq(walletSessions.address, address));
  await db.insert(walletSessions).values({ address, nonce });
}

/** Verifica si un nonce es válido para una address. Lo borra (uso único). */
export async function consumeNonce(db: Database, address: string, nonce: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(walletSessions)
    .where(eq(walletSessions.address, address))
    .limit(1);
  const row = rows[0];
  if (!row || row.nonce !== nonce) return false;
  // Nonce válido → borrarlo (uso único)
  await db.delete(walletSessions).where(eq(walletSessions.id, row.id));
  return true;
}

/** Borra nonces expirados (mayores a 5 minutos). Limpieza periódica. */
export async function cleanExpiredNonces(db: Database, maxAgeMs = 300_000): Promise<void> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  await db.delete(walletSessions).where(lt(walletSessions.creadoEn, cutoff));
}
