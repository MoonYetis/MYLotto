import Fastify from "fastify";
import { buildDeps } from "./dependencies.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerTicketRoutes } from "./routes/tickets.js";

async function main(): Promise<void> {
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

  registerHealthRoutes(app, deps);
  registerTicketRoutes(app, deps);

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
