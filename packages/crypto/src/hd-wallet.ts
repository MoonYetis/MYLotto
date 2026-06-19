import { HDKey } from "@scure/bip32";
import { base58check, bech32m } from "@scure/base";
import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2";
import type { Logger } from "@myloto/config";
import { createLogger } from "@myloto/config";
import {
  InvalidXpubError,
  WrongNetworkXpubError,
  WrongBip86DepthError,
  InvalidTicketIdError,
} from "./errors.js";

export interface HdWalletOptions {
  /** XPUB en mainnet (empieza con "xpub"). Nivel m/86'/0'/0'. */
  xpub: string;
  /** Logger inyectable para tests. Default: createLogger("info", "crypto"). */
  logger?: Logger;
}

export interface DerivedAddress {
  /** "bc1p..." — Taproot P2TR, bech32m, 62 chars. */
  address: string;
  /** Ruta completa: "m/86'/0'/0'/0/<ticketId>". */
  path: string;
  /** Echo del ticketId de entrada. */
  index: number;
}

// Límites BIP32 no-endurecido: [0, 2^31-1].
// Incluimos 0 para compatibilidad con vectores BIP86 estándar (índice 0).
// En producción los tickets BIGSERIAL empiezan en 1, pero el paquete crypto
// no impone esa restricción de dominio — es responsabilidad del backend.
const MIN_TICKET_ID = 0;
const MAX_TICKET_ID = 0x7fffffff; // 2^31 - 1

// Profundidad esperada para un XPUB BIP86 nivel m/86'/0'/0'
const BIP86_EXPECTED_DEPTH = 3;

/**
 * BIP341 tagged hash: SHA256(SHA256(tag) || SHA256(tag) || data).
 */
function taggedHash(tag: string, data: Uint8Array): Uint8Array {
  const tagBytes = new TextEncoder().encode(tag);
  const tagHash = sha256(tagBytes);
  const h = sha256.create();
  h.update(tagHash);
  h.update(tagHash);
  h.update(data);
  return h.digest();
}

/**
 * Convierte Uint8Array a hex string (sin prefijo 0x).
 */
function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export class HdWallet {
  private readonly root: HDKey;
  private readonly logger: Logger;

  constructor(opts: HdWalletOptions) {
    if (typeof opts.xpub !== "string") {
      throw new InvalidXpubError("xpub debe ser un string");
    }

    // 1. Validar prefijo de red
    if (!opts.xpub.startsWith("xpub")) {
      if (opts.xpub.startsWith("tpub")) {
        throw new WrongNetworkXpubError(
          "XPUB es testnet (tpub), se esperaba mainnet (xpub)",
        );
      }
      throw new WrongNetworkXpubError(
        `XPUB no empieza con 'xpub' ni 'tpub': ${opts.xpub.slice(0, 8)}...`,
      );
    }

    // 2. Decodificar base58check (valida checksum y longitud)
    // base58check es una factory que requiere un sha256.
    const b58check = base58check(sha256);
    let decoded: Uint8Array;
    try {
      decoded = b58check.decode(opts.xpub);
    } catch (err) {
      throw new InvalidXpubError(
        `XPUB base58check inválido: ${err instanceof Error ? err.message : "decode error"}`,
      );
    }

    // 3. Longitud estándar BIP32 serializada = 78 bytes
    if (decoded.length !== 78) {
      throw new InvalidXpubError(
        `XPUB decodificado debe ser 78 bytes, got ${decoded.length}`,
      );
    }

    // 4. Validar profundidad (byte offset 4)
    const depth = decoded[4] ?? 0;
    if (depth !== BIP86_EXPECTED_DEPTH) {
      throw new WrongBip86DepthError(
        `XPUB tiene depth=${depth}, se esperaba ${BIP86_EXPECTED_DEPTH} (nivel m/86'/0'/0')`,
      );
    }

    // 5. Parseo final con @scure/bip32 (valida versión, clave pública secp256k1, paridad)
    let root: HDKey;
    try {
      root = HDKey.fromExtendedKey(opts.xpub);
    } catch (err) {
      throw new InvalidXpubError(
        `HDKey.fromExtendedKey falló: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }

    if (!root.publicKey) {
      throw new InvalidXpubError("XPUB no contiene clave pública válida");
    }

    this.root = root;
    this.logger = opts.logger ?? createLogger("info", "crypto");
    this.logger.info("XPUB validado", { depth });
  }

  /**
   * Deriva la dirección Taproot para un ticketId dado.
   * Ruta: m/86'/0'/0'/0/ticketId (BIP86, índice no-endurecido).
   *
   * Algoritmo BIP86 + BIP341 (key-path only, sin scripts):
   * 1. Derivar change(0) / ticketId desde el XPUB raíz.
   * 2. Tomar la clave pública compressed (33 bytes).
   * 3. TapTweak: t = taggedHash("TapTweak", Px) donde Px = X de la clave pública.
   * 4. Q = lift_x(Px) + t*G  (suma en la curva secp256k1).
   * 5. Dirección = bech32m(bc, witver=1, Q.x en 32 bytes).
   *
   * @throws InvalidTicketIdError si ticketId < 1 o > 2^31-1.
   */
  deriveAddress(ticketId: number): DerivedAddress {
    if (
      !Number.isInteger(ticketId) ||
      ticketId < MIN_TICKET_ID ||
      ticketId > MAX_TICKET_ID
    ) {
      throw new InvalidTicketIdError(
        `ticketId debe ser entero en [${MIN_TICKET_ID}, ${MAX_TICKET_ID}], got ${ticketId}`,
      );
    }

    // 1. Derivar dos niveles no-endurecidos
    const changeChild = this.root.deriveChild(0);
    const ticketChild = changeChild.deriveChild(ticketId);

    if (!ticketChild.publicKey) {
      throw new InvalidXpubError(
        `derivación de ticketId ${ticketId} no produjo clave pública`,
      );
    }

    const pub = ticketChild.publicKey; // 33 bytes compressed
    const Px = pub.slice(1); // 32 bytes X-only

    // 2. TapTweak (key-path, sin script path)
    const t = taggedHash("TapTweak", Px);
    const tBigint = BigInt("0x" + bytesToHex(t));

    // 3. Q = lift_x(Px) + t*G
    const PxBigint = BigInt("0x" + bytesToHex(Px));
    const P = schnorr.utils.lift_x(PxBigint);
    const tG = schnorr.Point.BASE.multiply(tBigint);
    const Q = P.add(tG);
    const QxAffine = Q.toAffine();
    const QxHex = QxAffine.x.toString(16).padStart(64, "0");
    // Convertir hex a Uint8Array
    const QxBytes = new Uint8Array(QxHex.length / 2);
    for (let i = 0; i < QxHex.length; i += 2) {
      QxBytes[i / 2] = parseInt(QxHex.slice(i, i + 2), 16);
    }

    // 4. Codificar bech32m para Taproot (witver=1)
    const words = bech32m.toWords(QxBytes);
    const address = bech32m.encode("bc", [1, ...words]);

    return {
      address,
      path: `m/86'/0'/0'/0/${ticketId}`,
      index: ticketId,
    };
  }
}
