import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./pool.js";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL no definida");
    process.exit(1);
  }
  const { db, pool } = createDb(url);
  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("Migraciones aplicadas.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
