import { buildDeps } from "../dependencies.js";
import { getPendingTickets, markActive } from "../services/tickets.js";
import { verifyPayment } from "@myloto/payments";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface WorkerDeps {
  getPendingTickets: () => Promise<
    { id: bigint; paymentAddress: string; expectedAmount: string }[]
  >;
  markActive: (id: number) => Promise<void>;
  getReceived: (address: string, minconf: number) => Promise<number>;
  logger: Logger;
  minconf: number;
}

/**
 * Una ronda de verificación. Exportada para tests.
 */
export async function runRound(
  deps: WorkerDeps,
): Promise<{ checked: number; activated: number }> {
  const pending = await deps.getPendingTickets();
  let activated = 0;
  for (const ticket of pending) {
    try {
      const expected = Number(ticket.expectedAmount);
      const result = await verifyPayment({
        getReceived: deps.getReceived,
        ticket: {
          paymentAddress: ticket.paymentAddress,
          expectedAmount: expected,
        },
        minconf: deps.minconf,
      });
      if (result.paid) {
        await deps.markActive(Number(ticket.id));
        activated++;
        deps.logger.info("ticket activado", {
          id: Number(ticket.id),
          received: result.received,
        });
      }
    } catch (err) {
      // Error individual no mata el round.
      deps.logger.warn("verificación fallida", {
        id: Number(ticket.id),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return { checked: pending.length, activated };
}

/**
 * Loop infinito con shutdown graceful (SIGTERM/SIGINT).
 */
export function runLoop(deps: WorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info(
      "worker recibió señal de shutdown, esperando ronda actual",
    );
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("worker detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda completa", stats);
    } catch (err) {
      deps.logger.error("ronda falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps: WorkerDeps = {
    getPendingTickets: () => getPendingTickets(deps.db.db),
    markActive: (id) => markActive(deps.db.db, id),
    getReceived: (addr, minconf) =>
      deps.rpc.getReceivedByAddress(addr, minconf),
    logger: deps.logger,
    minconf: deps.env.PAYMENT_MIN_CONFIRMATIONS,
  };
  deps.logger.info("arrancando worker de verificación de pagos", {
    intervalMs: deps.env.PAYMENT_CHECK_INTERVAL_MS,
    minconf: deps.env.PAYMENT_MIN_CONFIRMATIONS,
  });
  runLoop(workerDeps, deps.env.PAYMENT_CHECK_INTERVAL_MS);
}

// Arranca solo cuando se ejecuta directamente (no al ser importado en tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
