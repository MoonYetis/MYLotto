import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

/** Tipo de la instancia Drizzle configurada con nuestro schema. */
export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Database;
  pool: Pool;
}

/**
 * Crea el pool de conexiones y la instancia de Drizzle.
 * max=10: backend ligero (8 GB RAM), el cron de pagos + API no requieren más.
 */
export function createDb(databaseUrl: string): DbHandle {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
