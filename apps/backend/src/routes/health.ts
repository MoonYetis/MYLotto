import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../dependencies.js";

/**
 * Registra los endpoints de salud:
 * - GET /health       → valida RPC contra el nodo Fractal
 * - GET /health/db    → valida conectividad a Postgres con SELECT 1
 */
export function registerHealthRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  app.get("/health", async (_req, reply) => {
    try {
      const info = await deps.rpc.getBlockchainInfo();
      return {
        status: "ok",
        node: {
          chain: info.chain,
          blocks: info.blocks,
          headers: info.headers,
        },
      };
    } catch (err) {
      deps.logger.error("health RPC failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      reply.code(503);
      return {
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      };
    }
  });

  app.get("/health/db", async (_req, reply) => {
    try {
      await deps.db.db.execute("SELECT 1");
      return { status: "ok", db: "reachable" };
    } catch (err) {
      deps.logger.error("health DB failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      reply.code(503);
      return {
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      };
    }
  });
}
