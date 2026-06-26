import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { buildDeps } from "./dependencies.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerTicketRoutes } from "./routes/tickets.js";
import { registerSorteoRoutes } from "./routes/sorteos.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Carga el .env en process.env antes de construir las dependencias.
 * Probusca desde la raíz del repo (apps/backend/../..) y, si no existe,
 * desde ~/MYLotto/.env (deploy en el nodo-desktop).
 * Silencioso si el archivo no existe (las vars pueden venir del entorno).
 */
function loadEnvFile(): void {
  const candidates = [
    resolve(__dirname, "../../.env"),
    resolve(process.cwd(), ".env"),
    resolve(homedir(), "MYLotto/.env"),
  ];
  for (const path of candidates) {
    try {
      process.loadEnvFile(path);
      return;
    } catch {
      // archivo no existe o no legible, probar el siguiente
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  const deps = buildDeps();
  const app = Fastify({
    logger: {
      level: deps.env.LOG_LEVEL,
      redact: {
        paths: [
          "*.password",
          "*.FRACTAL_RPC_PASSWORD",
          "Authorization",
          "*.Authorization",
        ],
        censor: "[REDACTED]",
      },
    },
  });

  // --- CORS: la web (lotto.moonyetis.com) llama al backend (api-lotto.) ---
  // CORS_ORIGINS permite sobreescribir; por defecto permite la web en prod + localhost en dev.
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : ["https://lotto.moonyetis.com", "http://localhost:3001"];
  await app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  registerHealthRoutes(app, deps);
  registerTicketRoutes(app, deps);
  registerSorteoRoutes(app, deps);

  const shutdown = async (signal: string): Promise<void> => {
    deps.logger.info("shutting down", { signal });
    await app.close();
    await deps.db.pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: deps.env.PORT, host: "0.0.0.0" });
    deps.logger.info("MYLoto backend listening", { port: deps.env.PORT });
  } catch (err) {
    deps.logger.error("failed to start", {
      error: err instanceof Error ? err.message : "unknown",
    });
    process.exit(1);
  }
}

main();
