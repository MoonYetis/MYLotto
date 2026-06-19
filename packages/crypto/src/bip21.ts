import { bech32m } from "@scure/base";
import { MalformedAddressError, InvalidAmountError } from "./errors.js";

/**
 * Valida que una dirección sea Taproot P2TR en mainnet (bc1p..., bech32m, 32 bytes).
 * @throws MalformedAddressError si no es válida.
 */
function validateTaprootAddress(address: string): void {
  try {
    const decoded = bech32m.decode(address as `${string}1${string}`);
    if (decoded.prefix !== "bc") {
      throw new MalformedAddressError(
        `HRP inválido: esperado 'bc', got '${decoded.prefix}'`,
      );
    }
    // Taproot P2TR: witver=1, witness=32 bytes (X-only tweaked pubkey, BIP341)
    const words = decoded.words;
    if (words.length === 0 || words[0] !== 1) {
      throw new MalformedAddressError("witver debe ser 1 (Taproot P2TR)");
    }
    // Convertir de 5-bit words a bytes
    const witness = bech32m.fromWords(words.slice(1));
    if (witness.length !== 32) {
      throw new MalformedAddressError(
        `witness debe ser 32 bytes, got ${witness.length}`,
      );
    }
  } catch (err) {
    if (err instanceof MalformedAddressError) throw err;
    throw new MalformedAddressError(
      err instanceof Error ? err.message : "dirección bech32m inválida",
    );
  }
}

/**
 * Formatea un amount FB/BTC sin trailing zeros ni notación científica.
 * 0.001 → "0.001", 1.0 → "1", 0.12345678 → "0.12345678"
 */
function formatAmount(amount: number): string {
  const fixed = amount.toFixed(8);
  return fixed.replace(/\.?0+$/, "");
}

/**
 * Construye un URI BIP21 para pagos Bitcoin/Fractal.
 * Formato: bitcoin:<address>?amount=<amount>
 *
 * @param address Dirección bech32m ("bc1p...").
 * @param amountMb Monto en FB (mismo que BTC, 8 decimales).
 * @throws MalformedAddressError si la dirección no es bech32m válida.
 * @throws InvalidAmountError si amount <= 0, NaN, o Infinity.
 */
export function buildBip21Uri(address: string, amountMb: number): string {
  validateTaprootAddress(address);

  if (!Number.isFinite(amountMb) || amountMb <= 0) {
    throw new InvalidAmountError(
      `amount debe ser finito y > 0, got ${amountMb}`,
    );
  }

  const formatted = formatAmount(amountMb);
  return `bitcoin:${address}?amount=${formatted}`;
}
