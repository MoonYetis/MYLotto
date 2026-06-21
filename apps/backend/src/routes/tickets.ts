import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { tickets } from "@myloto/db";
import { buildBip21Uri, renderQrSvg } from "@myloto/crypto";
import type { AppDeps } from "../dependencies.js";
import {
  getActiveSorteo,
  createTicket,
  getTicketById,
} from "../services/tickets.js";
import { resolveTicketPrice } from "../services/pricing.js";

const TicketBodySchema = z
  .object({
    n1: z.number().int().min(1).max(69),
    n2: z.number().int().min(1).max(69),
    n3: z.number().int().min(1).max(69),
    n4: z.number().int().min(1).max(69),
    n5: z.number().int().min(1).max(69),
    powerball: z.number().int().min(1).max(26),
    returnAddress: z.string().optional(),
    brc20Address: z.string().optional(),
  })
  .refine(
    (d) => d.n1 < d.n2 && d.n2 < d.n3 && d.n3 < d.n4 && d.n4 < d.n5,
    { message: "las balotas deben ir ordenadas de menor a mayor sin repetir" },
  );

/**
 * Registra los endpoints de tickets:
 * - POST /tickets   → compra: valida, deriva dirección HD, calcula precio, inserta
 * - GET  /tickets/:id → estado del ticket
 */
export function registerTicketRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  app.post("/tickets", async (req, reply) => {
    const parsed = TicketBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? "body inválido" };
    }
    const body = parsed.data;

    const sorteo = await getActiveSorteo(deps.db.db);
    if (!sorteo) {
      reply.code(409);
      return { error: "no hay sorteo ABIERTO activo" };
    }

    const brc20 = body.brc20Address ?? null;
    const price = await resolveTicketPrice(brc20, {
      unisatClient: deps.unisat,
      ticker: deps.env.BRC20_TICKER,
      basePrice: deps.env.TICKET_PRICE_FB,
      discountPrice: deps.env.TICKET_DISCOUNT_PRICE_FB,
      logger: deps.logger,
    });

    // INSERT con placeholder; el id generado es el índice de derivación HD.
    const ticket = await createTicket(deps.db.db, {
      sorteoId: Number(sorteo.id),
      paymentAddress: "PLACEHOLDER",
      expectedAmount: price.amount,
      n1: body.n1,
      n2: body.n2,
      n3: body.n3,
      n4: body.n4,
      n5: body.n5,
      powerball: body.powerball,
      ...(body.returnAddress !== undefined
        ? { userReturnAddress: body.returnAddress }
        : {}),
    });

    // Derivar dirección real y actualizar la fila.
    const derived = deps.wallet.deriveAddress(Number(ticket.id));
    await deps.db.db
      .update(tickets)
      .set({ paymentAddress: derived.address })
      .where(eq(tickets.id, ticket.id));

    const bip21Uri = buildBip21Uri(derived.address, price.amount);
    const qrSvg = renderQrSvg(bip21Uri);

    reply.code(201);
    return {
      id: Number(ticket.id),
      sorteoId: Number(ticket.sorteoId),
      status: ticket.status,
      expectedAmount: price.amount,
      hasDiscount: price.hasDiscount,
      paymentAddress: derived.address,
      bip21Uri,
      qrSvg,
    };
  });

  app.get("/tickets/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      reply.code(400);
      return { error: "id inválido" };
    }
    const ticket = await getTicketById(deps.db.db, id);
    if (!ticket) {
      reply.code(404);
      return { error: "ticket no encontrado" };
    }
    return {
      id: Number(ticket.id),
      sorteoId: Number(ticket.sorteoId),
      status: ticket.status,
      expectedAmount: ticket.expectedAmount,
      paymentAddress: ticket.paymentAddress,
      combinacion: {
        n1: ticket.n1,
        n2: ticket.n2,
        n3: ticket.n3,
        n4: ticket.n4,
        n5: ticket.n5,
        powerball: ticket.powerball,
      },
      recibidoEn: ticket.recibidoEn,
    };
  });
}
