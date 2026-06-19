import { bech32, bech32m, base58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";

/**
 * Valida cualquier dirección Bitcoin/Fractal mainnet:
 * Legacy (1...), P2SH (3...), SegWit (bc1q...), Taproot (bc1p...).
 * Rechaza testnet (tb1..., m..., n...).
 *
 * @returns true si es válida, false si no (nunca lanza).
 */
export function isValidBitcoinAddress(address: string): boolean {
  if (typeof address !== "string" || address.length === 0) {
    return false;
  }

  // 1. Intentar bech32m (Taproot bc1p)
  if (address.startsWith("bc1p")) {
    try {
      const decoded = bech32m.decode(address as `${string}1${string}`);
      if (decoded.prefix !== "bc") return false;
      if (decoded.words.length === 0 || decoded.words[0] !== 1) return false;
      const witness = bech32m.fromWords(decoded.words.slice(1));
      return witness.length === 32;
    } catch {
      return false;
    }
  }

  // 2. Intentar bech32 (SegWit v0 bc1q)
  if (address.startsWith("bc1q")) {
    try {
      const decoded = bech32.decode(address as `${string}1${string}`);
      if (decoded.prefix !== "bc") return false;
      if (decoded.words.length === 0 || decoded.words[0] !== 0) return false;
      // witness de 20 bytes (P2WPKH) o 32 bytes (P2WSH)
      const witness = bech32.fromWords(decoded.words.slice(1));
      return witness.length === 20 || witness.length === 32;
    } catch {
      return false;
    }
  }

  // 3. Intentar base58check (Legacy 1... / P2SH 3...)
  if (address.startsWith("1") || address.startsWith("3")) {
    try {
      const b58 = base58check(sha256);
      const decoded = b58.decode(address);
      if (decoded.length !== 21) return false;
      const version = decoded[0];
      // 0x00 = Legacy, 0x05 = P2SH
      return version === 0x00 || version === 0x05;
    } catch {
      return false;
    }
  }

  // 4. No reconocido (incluye testnet tb1..., m..., n...)
  return false;
}
