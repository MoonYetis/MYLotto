import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";

export interface JwtPayload {
  address: string;
}

/**
 * Genera un nonce aleatorio de 32 bytes (64 hex chars) para BIP-322.
 */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Firma un JWT con el payload y secreto dados.
 */
export function signJwt(payload: JwtPayload, secret: string, expiresInSec: number): string {
  return jwt.sign(payload, secret, { expiresIn: expiresInSec });
}

/**
 * Verifica un JWT. Devuelve el payload si es válido, null si no.
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return { address: decoded.address };
  } catch {
    return null;
  }
}

/**
 * Extrae y verifica el JWT de la cookie de una request Fastify.
 * Devuelve la wallet address si hay sesión válida, null si no.
 */
export function requireAuth(request: FastifyRequest, secret: string): string | null {
  const token = (request as any).cookies?.session;
  if (!token) return null;
  const payload = verifyJwt(token, secret);
  return payload?.address ?? null;
}
