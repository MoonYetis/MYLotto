import { buildDeps } from "../dependencies.js";
import { cerrarVencidos } from "../services/sorteos.js";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface LifecycleWorkerDeps {
  getBlockCount: () => Promise<number>;
  cerrarVencidos: (currentHeight: number) => Promise<number>;
  logger: Logger;
}

/** Una ronda del worker. Exportada para tests. */
export async function runRound(
  deps: LifecycleWorkerDeps,
): Promise<{ checked: number; closed: number }> {
  const height = await deps.getBlockCount();
  const closed = await deps.cerrarVencidos(height);
  if (closed > 0) {
    deps.logger.info("sorteos cerrados", { count: closed });
  }
  return { checked: closed, closed };
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: LifecycleWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("lifecycle-verifier recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("lifecycle-verifier detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda lifecycle completa", stats);
    } catch (err) {
      deps.logger.error("ronda lifecycle falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

export function buildLifecycleDeps(
  deps: ReturnType<typeof buildDeps>,
): LifecycleWorkerDeps {
  return {
    getBlockCount: () => deps.rpc.getBlockCount(),
    cerrarVencidos: (height) => cerrarVencidos(deps.db.db, height),
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps = buildLifecycleDeps(deps);
  deps.logger.info("arrancando lifecycle-verifier", {
    intervalMs: deps.env.LIFECYCLE_CHECK_INTERVAL_MS,
  });
  runLoop(workerDeps, deps.env.LIFECYCLE_CHECK_INTERVAL_MS);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
