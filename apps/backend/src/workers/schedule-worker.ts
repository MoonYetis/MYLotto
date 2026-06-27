import { buildDeps } from "../dependencies.js";
import { getActiveSorteo } from "../services/tickets.js";
import { createSorteo } from "../services/sorteos.js";
import { getNextDrawTime, estimateBlockAtTime } from "../services/schedule.js";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface ScheduleWorkerDeps {
  getActiveSorteo: () => Promise<{ id: bigint } | null>;
  getBlockCount: () => Promise<number>;
  createSorteo: (bloqueCierre: number) => Promise<{ id: bigint }>;
  getNextDrawTime: (now: Date) => Date;
  estimateBlockAtTime: (targetTime: Date, currentHeight: number, now: Date) => number;
  logger: Logger;
}

/**
 * Una ronda del scheduler. Si no hay sorteo ABIERTO, calcula el próximo horario
 * y crea el sorteo con el bloque de cierre estimado. Idempotente: si ya hay
 * ABIERTO, no hace nada. Si createSorteo falla (duplicado), no es fatal.
 */
export async function runRound(
  deps: ScheduleWorkerDeps,
): Promise<{ checked: number; created: number }> {
  const existing = await deps.getActiveSorteo();
  if (existing) {
    return { checked: 1, created: 0 };
  }

  // No hay ABIERTO → crear el próximo
  const now = new Date();
  const nextDraw = deps.getNextDrawTime(now);
  const currentHeight = await deps.getBlockCount();
  const bloqueCierre = deps.estimateBlockAtTime(nextDraw, currentHeight, now);

  try {
    const created = await deps.createSorteo(bloqueCierre);
    deps.logger.info("sorteo creado por scheduler", {
      id: Number(created.id),
      bloqueCierre,
      nextDraw: nextDraw.toISOString(),
    });
    return { checked: 1, created: 1 };
  } catch (err) {
    // Probablemente unique constraint en bloque_cierre (duplicado). No fatal.
    deps.logger.warn("scheduler no pudo crear sorteo (posible duplicado)", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { checked: 1, created: 0 };
  }
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: ScheduleWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("schedule-worker recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("schedule-worker detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      if (stats.created > 0) {
        deps.logger.info("ronda schedule completa", stats);
      }
    } catch (err) {
      deps.logger.error("ronda schedule falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

export function buildScheduleDeps(
  deps: ReturnType<typeof buildDeps>,
): ScheduleWorkerDeps {
  const sortedDays = deps.env.SCHEDULE_DAYS.split(",").map((s) => Number(s.trim()));
  return {
    getActiveSorteo: () => getActiveSorteo(deps.db.db),
    getBlockCount: () => deps.rpc.getBlockCount(),
    createSorteo: (bloqueCierre) => createSorteo(deps.db.db, bloqueCierre),
    getNextDrawTime: (now) =>
      getNextDrawTime(now, sortedDays, deps.env.SCHEDULE_HOUR, deps.env.SCHEDULE_TIMEZONE),
    estimateBlockAtTime: (targetTime, currentHeight, now) =>
      estimateBlockAtTime(targetTime, currentHeight, now, deps.env.BLOCK_TIME_MS),
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps = buildScheduleDeps(deps);
  deps.logger.info("arrancando schedule-worker", {
    intervalMs: deps.env.SCHEDULE_CHECK_INTERVAL_MS,
    days: deps.env.SCHEDULE_DAYS,
    hour: deps.env.SCHEDULE_HOUR,
    timezone: deps.env.SCHEDULE_TIMEZONE,
  });
  runLoop(workerDeps, deps.env.SCHEDULE_CHECK_INTERVAL_MS);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
