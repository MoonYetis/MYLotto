import { buildDeps } from "../dependencies.js";
import {
  getJackpotBalance,
  setJackpotBalance,
  countActiveTickets,
  getActiveTickets,
  insertGanadores,
  getCalculatedSorteos,
  markFinalizado,
} from "../services/premios.js";
import { classifyTicket, distributePool } from "@myloto/scrutiny";
import type { CombinacionGanadora } from "@myloto/types";
import type { Sorteo, NuevoGanador } from "@myloto/db";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface ScrutinyWorkerDeps {
  getCalculatedSorteos: () => Promise<Sorteo[]>;
  countActiveTickets: (sorteoId: number) => Promise<number>;
  getActiveTickets: (
    sorteoId: number,
  ) => Promise<
    Array<{
      id: bigint;
      n1: number;
      n2: number;
      n3: number;
      n4: number;
      n5: number;
      powerball: number;
    }>
  >;
  getJackpotBalance: () => Promise<number>;
  setJackpotBalance: (amount: number) => Promise<void>;
  insertGanadores: (rows: NuevoGanador[]) => Promise<void>;
  markFinalizado: (sorteoId: number) => Promise<void>;
  ticketPrice: number;
  logger: Logger;
}

/**
 * Escruta un sorteo: clasifica tickets, distribuye pool, persiste ganadores,
 * actualiza jackpot y finaliza. Transaccional.
 */
async function scrutinizeSorteo(
  sorteo: Sorteo,
  deps: ScrutinyWorkerDeps,
): Promise<void> {
  const combinacion = sorteo.combinacionGanadora as CombinacionGanadora | null;
  if (!combinacion) {
    throw new Error(`sorteo ${sorteo.id} no tiene combinacionGanadora`);
  }

  // 1. Pool = boletos ACTIVO × precio
  const ticketCount = await deps.countActiveTickets(Number(sorteo.id));
  const poolAmount = ticketCount * deps.ticketPrice;

  // 2. Clasificar tickets
  const tickets = await deps.getActiveTickets(Number(sorteo.id));
  const tierCounts = new Array(9).fill(0);
  const ganadores: NuevoGanador[] = [];

  for (const t of tickets) {
    const tier = classifyTicket(
      {
        balotas: [t.n1, t.n2, t.n3, t.n4, t.n5],
        powerball: t.powerball,
      },
      combinacion,
    );
    if (tier > 0) {
      tierCounts[tier - 1] = (tierCounts[tier - 1] as number) + 1;
      ganadores.push({
        sorteoId: BigInt(sorteo.id),
        ticketId: t.id,
        tier,
        monto: "0", // se asigna tras distributePool
        pagado: false,
      });
    }
  }

  // 3. Distribuir pool
  const carryover = await deps.getJackpotBalance();
  const dist = distributePool(poolAmount, tierCounts, carryover);

  // 4. Asignar montos
  for (const g of ganadores) {
    const tierResult = dist.tiers[g.tier - 1]!;
    g.monto = String(tierResult.perWinner);
  }

  // 5. Persistir (transaccional en prod via db.transaction)
  await deps.insertGanadores(ganadores);
  await deps.setJackpotBalance(dist.rolloverToJackpot);
  await deps.markFinalizado(Number(sorteo.id));

  deps.logger.info("sorteo escrutado", {
    id: Number(sorteo.id),
    poolAmount,
    ganadores: ganadores.length,
    rollover: dist.rolloverToJackpot,
  });
}

/** Una ronda del worker. Exportada para tests. */
export async function runRound(
  deps: ScrutinyWorkerDeps,
): Promise<{ checked: number; finalized: number }> {
  const sorteos = await deps.getCalculatedSorteos();
  let finalized = 0;

  for (const sorteo of sorteos) {
    try {
      await scrutinizeSorteo(sorteo, deps);
      finalized++;
    } catch (err) {
      deps.logger.warn("escrutinio falló", {
        id: Number(sorteo.id),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return { checked: sorteos.length, finalized };
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: ScrutinyWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("scrutiny-verifier recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("scrutiny-verifier detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda scrutiny completa", stats);
    } catch (err) {
      deps.logger.error("ronda scrutiny falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

export function buildScrutinyDeps(
  deps: ReturnType<typeof buildDeps>,
): ScrutinyWorkerDeps {
  return {
    getCalculatedSorteos: () => getCalculatedSorteos(deps.db.db),
    countActiveTickets: (id) => countActiveTickets(deps.db.db, id),
    getActiveTickets: (id) => getActiveTickets(deps.db.db, id),
    getJackpotBalance: () => getJackpotBalance(deps.db.db),
    setJackpotBalance: (amount) => setJackpotBalance(deps.db.db, amount),
    insertGanadores: (rows) => insertGanadores(deps.db.db, rows),
    markFinalizado: (id) => markFinalizado(deps.db.db, id),
    ticketPrice: deps.env.TICKET_PRICE_FB,
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps = buildScrutinyDeps(deps);
  deps.logger.info("arrancando scrutiny-verifier", {
    intervalMs: deps.env.SCRUTINY_CHECK_INTERVAL_MS,
  });
  runLoop(workerDeps, deps.env.SCRUTINY_CHECK_INTERVAL_MS);
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
