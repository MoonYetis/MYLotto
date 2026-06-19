export * from "./errors.js";
export { buildBip21Uri } from "./bip21.js";
export { renderQrSvg } from "./qr-svg.js";
export type { QrSvgOptions } from "./qr-svg.js";
export { HdWallet } from "./hd-wallet.js";
export type { HdWalletOptions, DerivedAddress } from "./hd-wallet.js";

import type { HdWallet } from "./hd-wallet.js";
import type { QrSvgOptions } from "./qr-svg.js";
import { buildBip21Uri } from "./bip21.js";
import { renderQrSvg } from "./qr-svg.js";

export interface GenerateTicketPaymentOptions {
  wallet: HdWallet;
  ticketId: number;
  amountMb: number;
  qrOptions?: QrSvgOptions;
}

export interface TicketPayment {
  address: string;
  bip21Uri: string;
  qrSvg: string;
  path: string;
}

/**
 * Orquesta derivación + BIP21 + QR en una sola llamada.
 * Conveniencia para el consumidor final (Ciclo 4).
 */
export function generateTicketPayment(
  opts: GenerateTicketPaymentOptions,
): TicketPayment {
  const derived = opts.wallet.deriveAddress(opts.ticketId);
  const bip21Uri = buildBip21Uri(derived.address, opts.amountMb);
  const qrSvg = renderQrSvg(bip21Uri, opts.qrOptions);
  return {
    address: derived.address,
    bip21Uri,
    qrSvg,
    path: derived.path,
  };
}
