import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";

const shouldRun = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!shouldRun)("Schema DB — integración con testcontainers", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const url = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}`;
    pool = new Pool({ connectionString: url });
    const db = drizzle(pool);
    // El CWD al ejecutar vitest es packages/db, por eso la ruta es relativa aquí.
    await migrate(db, { migrationsFolder: "./migrations" });
  }, 120000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  it("inserta un sorteo válido", async () => {
    const result = await pool.query(
      "INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING *",
      [850100],
    );
    expect(result.rows[0].bloque_cierre).toBe(850100);
    expect(result.rows[0].estado).toBe("ABIERTO");
  });

  it("rechaza estado inválido", async () => {
    await expect(
      pool.query(
        "INSERT INTO sorteos (bloque_cierre, estado) VALUES ($1, $2)",
        [850101, "INVALIDO"],
      ),
    ).rejects.toThrow();
  });

  it("rechaza bloque_cierre duplicado (unique)", async () => {
    await pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1)", [850200]);
    await expect(
      pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1)", [850200]),
    ).rejects.toThrow();
  });

  it("rechaza balotas desordenadas", async () => {
    const { rows } = await pool.query(
      "INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id",
      [850300],
    );
    const sorteoId = rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [sorteoId, "bc1q", "1.0", 5, 3, 10, 20, 30, 1], // n1>n2 viola sorted
      ),
    ).rejects.toThrow();
  });

  it("rechaza balota fuera de rango", async () => {
    const { rows } = await pool.query(
      "INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id",
      [850400],
    );
    const sorteoId = rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [sorteoId, "bc1q", "1.0", 1, 2, 3, 4, 70, 1], // n5=70 > 69
      ),
    ).rejects.toThrow();
  });

  it("rechaza powerball fuera de rango", async () => {
    const { rows } = await pool.query(
      "INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id",
      [850500],
    );
    const sorteoId = rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [sorteoId, "bc1q", "1.0", 1, 2, 3, 4, 5, 27], // powerball=27 > 26
      ),
    ).rejects.toThrow();
  });

  it("acepta ticket válido completo", async () => {
    const { rows } = await pool.query(
      "INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id",
      [850600],
    );
    const sorteoId = rows[0].id;
    const result = await pool.query(
      "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball, user_return_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [sorteoId, "bc1qxyz", "5.0", 5, 12, 23, 45, 67, 13, "bc1qreturn"],
    );
    expect(result.rows[0].status).toBe("PENDIENTE");
    expect(result.rows[0].n1).toBe(5);
    expect(result.rows[0].powerball).toBe(13);
  });

  it("los índices existen tras migrar", async () => {
    const result = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename IN ('sorteos','tickets') ORDER BY indexname",
    );
    const names = result.rows.map((r: { indexname: string }) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "sorteos_bloque_cierre_unique",
        "tickets_sorteo_status",
        "tickets_payment_address",
        "tickets_sorteo_combinacion",
      ]),
    );
  });
});
