import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../dependencies.js";
import {
  createSorteo,
  getSorteoById,
  getSorteoAbierto,
  getGanadores,
  markPagado,
} from "../services/sorteos.js";
import { getJackpotBalance } from "../services/premios.js";

/** Registra los endpoints de gestión de sorteos y resultados. */
export function registerSorteoRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  // POST /admin/sorteos — Crear sorteo
  app.post("/admin/sorteos", async (_req, reply) => {
    const height = await deps.rpc.getBlockCount();
    const bloqueCierre = height + deps.env.DURACION_SORTEO_BLOQUES;
    const sorteo = await createSorteo(deps.db.db, bloqueCierre);
    reply.code(201);
    return {
      id: Number(sorteo.id),
      bloqueCierre: Number(sorteo.bloqueCierre),
      estado: sorteo.estado,
      creadoEn: sorteo.creadoEn,
    };
  });

  // GET /sorteos/abierto — Sorteo ABIERTO activo
  app.get("/sorteos/abierto", async (_req, reply) => {
    const sorteo = await getSorteoAbierto(deps.db.db);
    if (!sorteo) {
      reply.code(404);
      return { error: "no hay sorteo ABIERTO" };
    }
    return {
      id: Number(sorteo.id),
      bloqueCierre: Number(sorteo.bloqueCierre),
      estado: sorteo.estado,
      creadoEn: sorteo.creadoEn,
    };
  });

  // GET /sorteos/:id — Estado completo del sorteo
  app.get("/sorteos/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const sorteo = await getSorteoById(deps.db.db, id);
    if (!sorteo) {
      reply.code(404);
      return { error: "sorteo no encontrado" };
    }
    return {
      id: Number(sorteo.id),
      bloqueCierre: Number(sorteo.bloqueCierre),
      estado: sorteo.estado,
      combinacionGanadora: sorteo.combinacionGanadora,
      bloquesSemilla: sorteo.bloquesSemilla,
      creadoEn: sorteo.creadoEn,
      cerradoEn: sorteo.cerradoEn,
      calculadoEn: sorteo.calculadoEn,
    };
  });

  // GET /sorteos/:id/ganadores — Ganadores del sorteo
  app.get("/sorteos/:id/ganadores", async (req, _reply) => {
    const id = Number((req.params as { id: string }).id);
    const ganadores = await getGanadores(deps.db.db, id);
    return ganadores.map((g) => ({
      id: Number(g.id),
      ticketId: Number(g.ticketId),
      tier: g.tier,
      monto: g.monto,
      pagado: g.pagado,
    }));
  });

  // GET /jackpot — Jackpot total (base garantizado + acumulado)
  app.get("/jackpot", async (_req, _reply) => {
    const acumulado = await getJackpotBalance(deps.db.db);
    const total = deps.env.JACKPOT_BASE_FB + acumulado;
    return { saldo: total, base: deps.env.JACKPOT_BASE_FB, acumulado };
  });

  // POST /admin/ganadores/:id/pagar — Marcar premio pagado
  app.post("/admin/ganadores/:id/pagar", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const updated = await markPagado(deps.db.db, id);
    if (!updated) {
      reply.code(404);
      return { error: "ganador no encontrado" };
    }
    return { id, pagado: true };
  });
}
