import { sha256 } from "@noble/hashes/sha2";
import type { BloquesSemilla } from "@myloto/types";

/**
 * Deriva una semilla de 32 bytes a partir de los hashes de los 3 bloques
 * post-cierre del sorteo.
 *
 * Semilla = SHA-256(hex(N+1) || hex(N+2) || hex(N+3))
 *
 * La concatenación de hexstrings (192 chars = 3 × 64) se hashea con SHA-256.
 * Determinista: los mismos 3 hashes producen siempre la misma semilla.
 */
export function deriveSeed(hashes: BloquesSemilla): Uint8Array {
  const data = hashes.n1 + hashes.n2 + hashes.n3;
  return sha256(new TextEncoder().encode(data));
}
