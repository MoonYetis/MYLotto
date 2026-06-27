import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../dependencies.js";
import { requireAuth } from "../services/auth.js";
import { getTicketsByWallet } from "../services/me.js";

export function registerMeRoutes(app: FastifyInstance, deps: AppDeps): void {
  // GET /me/tickets — boletos del usuario autenticado
  app.get("/me/tickets", async (req, reply) => {
    const address = requireAuth(req, deps.env.JWT_SECRET);
    if (!address) {
      reply.code(401);
      return { error: "debes iniciar sesión" };
    }
    const result = await getTicketsByWallet(deps.db.db, address);
    return result;
  });
}
