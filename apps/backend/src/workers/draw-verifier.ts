import { buildDeps } from "../dependencies.js";
import {
  getClosedSorteosReady,
  saveSorteoResult,
  markCalculated,
} from "../services/sorteos.js";
import {
  deriveSeed,
  Sha256CounterPrng,
  drawWinningCombination,
} from "@myloto/randomness";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";
import type { Sorteo } from "@myloto/db";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface DrawWorkerDeps {
  getBlockCount: () => Promise<number>;
  getReadySorteos: (height: number) => Promise<Sorteo[]>;
  getBlockHash: (height: number) => Promise<string>;
  saveResult: (
    id: number,
    combinacion: CombinacionGanadora,
    bloques: BloquesSemilla,
  ) => Promise<void>;
  markCalculated: (id: number) => Promise<void>;
  logger: Logger;
}

/** Una ronda del worker. Exportada para tests. */
export async function runRound(
  deps: DrawWorkerDeps,
): Promise<{ checked: number; drawn: number }> {
  const height = await deps.getBlockCount();
  const sorteos = await deps.getReadySorteos(height);
  let drawn = 0;

  for (const sorteo of sorteos) {
    try {
      const base = Number(sorteo.bloqueCierre);
      const n1 = await deps.getBlockHash(base + 1);
      const n2 = await deps.getBlockHash(base + 2);
      const n3 = await deps.getBlockHash(base + 3);

      const seed = deriveSeed({ n1, n2, n3 });
      const prng = new Sha256CounterPrng(seed);
      const combinacion = drawWinningCombination(prng);

      await deps.saveResult(Number(sorteo.id), combinacion, { n1, n2, n3 });
      await deps.markCalculated(Number(sorteo.id));
      drawn++;
      deps.logger.info("sorteo calculado", {
        id: Number(sorteo.id),
        combinacion,
      });
    } catch (err) {
      deps.logger.warn("cálculo de sorteo falló", {
        id: Number(sorteo.id),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return { checked: sorteos.length, drawn };
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: DrawWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("draw-verifier recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("draw-verifier detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda draw completa", stats);
    } catch (err) {
      deps.logger.error("ronda draw falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

export function buildDrawDeps(
  deps: ReturnType<typeof buildDeps>,
): DrawWorkerDeps {
  return {
    getBlockCount: () => deps.rpc.getBlockCount(),
    getReadySorteos: (height) => getClosedSorteosReady(deps.db.db, height),
    getBlockHash: (height) => deps.rpc.getBlockHash(height),
    saveResult: (id, comb, bloques) =>
      saveSorteoResult(deps.db.db, id, comb, bloques),
    markCalculated: (id) => markCalculated(deps.db.db, id),
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps = buildDrawDeps(deps);
  deps.logger.info("arrancando draw-verifier", {
    intervalMs: deps.env.DRAW_CHECK_INTERVAL_MS,
  });
  runLoop(workerDeps, deps.env.DRAW_CHECK_INTERVAL_MS);
}

// Arranca solo cuando se ejecuta directamente.
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
