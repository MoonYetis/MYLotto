/** Defaults de precio (FB). Configurables vía env en el backend. */
export const DEFAULT_TICKET_PRICE_BASE = 100;
export const DEFAULT_TICKET_PRICE_DISCOUNTED = 80;

export type PricingReason = "HOLDER" | "NO_HOLDER" | "UNISAT_FAILED";

export interface TicketPrice {
  /** Monto en FB que el usuario debe pagar. */
  amount: number;
  hasDiscount: boolean;
  /** Auditoría del fail-closed: por qué se eligió este precio. */
  reason: PricingReason;
}

/**
 * Calcula el precio de un boleto.
 * @param hasDiscount si el usuario califica (balance Moonyetis > 0)
 * @param base precio sin descuento (default 100)
 * @param discount precio con descuento (default 80)
 */
export function calculatePrice(
  hasDiscount: boolean,
  base: number = DEFAULT_TICKET_PRICE_BASE,
  discount: number = DEFAULT_TICKET_PRICE_DISCOUNTED,
): TicketPrice {
  return hasDiscount
    ? { amount: discount, hasDiscount: true, reason: "HOLDER" }
    : { amount: base, hasDiscount: false, reason: "NO_HOLDER" };
}
