import { buildDeps } from "./dependencies.js";
import {
  runLoop as lifecycleLoop,
  buildLifecycleDeps,
} from "./workers/lifecycle-verifier.js";
import {
  runLoop as paymentLoop,
  buildWorkerDeps as buildPaymentDeps,
} from "./workers/payment-verifier.js";
import { runLoop as drawLoop, buildDrawDeps } from "./workers/draw-verifier.js";
import {
  runLoop as scrutinyLoop,
  buildScrutinyDeps,
} from "./workers/scrutiny-verifier.js";

async function main(): Promise<void> {
  const deps = buildDeps();

  // Construir los WorkerDeps de cada worker
  const lifecycleDeps = buildLifecycleDeps(deps);
  const paymentDeps = buildPaymentDeps(deps);
  const drawDeps = buildDrawDeps(deps);
  const scrutinyDeps = buildScrutinyDeps(deps);

  // Arrancar los 4 loops en paralelo (cada uno es infinito)
  lifecycleLoop(lifecycleDeps, deps.env.LIFECYCLE_CHECK_INTERVAL_MS);
  paymentLoop(paymentDeps, deps.env.PAYMENT_CHECK_INTERVAL_MS);
  drawLoop(drawDeps, deps.env.DRAW_CHECK_INTERVAL_MS);
  scrutinyLoop(scrutinyDeps, deps.env.SCRUTINY_CHECK_INTERVAL_MS);

  deps.logger.info("orchestrator arrancado: 4 workers en paralelo", {
    lifecycle: deps.env.LIFECYCLE_CHECK_INTERVAL_MS,
    payment: deps.env.PAYMENT_CHECK_INTERVAL_MS,
    draw: deps.env.DRAW_CHECK_INTERVAL_MS,
    scrutiny: deps.env.SCRUTINY_CHECK_INTERVAL_MS,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
