import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Verifier } from "bip322-js";
import type { AppDeps } from "../dependencies.js";
import { generateNonce, signJwt, requireAuth } from "../services/auth.js";
import { createNonce, consumeNonce } from "../services/wallet-sessions.js";

const NonceBody = z.object({ address: z.string().min(1) });
const VerifyBody = z.object({
  address: z.string().min(1),
  message: z.string().min(1),
  signature: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): void {
  // POST /auth/nonce — pide un nonce para firmar
  app.post("/auth/nonce", async (req, reply) => {
    const parsed = NonceBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "address requerida" };
    }
    const { address } = parsed.data;
    const nonce = generateNonce();
    const message = `Inicia sesión en MYLoto.\nWallet: ${address}\nNonce: ${nonce}`;
    await createNonce(deps.db.db, address, nonce);
    return { nonce, message };
  });

  // POST /auth/verify — verifica la firma BIP-322 y emite JWT
  app.post("/auth/verify", async (req, reply) => {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "address, message y signature requeridos" };
    }
    const { address, message, signature } = parsed.data;

    // Extraer el nonce del mensaje para validarlo
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
    const nonce = nonceMatch?.[1];
    if (!nonce) {
      reply.code(400);
      return { error: "mensaje sin nonce válido" };
    }

    // Verificar que el nonce existe y no se ha usado
    const validNonce = await consumeNonce(deps.db.db, address, nonce);
    if (!validNonce) {
      reply.code(401);
      return { error: "nonce inválido o expirado" };
    }

    // Verificar la firma BIP-322 con bip322-js (Verifier.verifySignature)
    let signatureValid = false;
    try {
      signatureValid = Verifier.verifySignature(address, message, signature);
    } catch (err) {
      deps.logger.error("BIP-322 verification error", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    if (!signatureValid) {
      reply.code(401);
      return { error: "firma inválida" };
    }

    // Emitir JWT en cookie httpOnly
    const token = signJwt({ address }, deps.env.JWT_SECRET, deps.env.JWT_EXPIRES_IN);
    reply.setCookie("session", token, {
      httpOnly: true,
      secure: deps.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: deps.env.JWT_EXPIRES_IN,
    });
    return { ok: true, address };
  });

  // POST /auth/logout — limpia la cookie
  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });

  // GET /auth/me — devuelve la wallet si hay sesión
  app.get("/auth/me", async (req, reply) => {
    const address = requireAuth(req, deps.env.JWT_SECRET);
    if (!address) {
      reply.code(401);
      return { error: "no autenticado" };
    }
    return { address };
  });
}
