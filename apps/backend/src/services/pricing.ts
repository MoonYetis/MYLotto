import type { UnisatClient } from "@myloto/brc20";
import { qualifiesForDiscount } from "@myloto/brc20";
import { calculatePrice, type TicketPrice } from "@myloto/payments";
import type { Logger } from "@myloto/config";

export interface ResolvePriceDeps {
  unisatClient: UnisatClient;
  ticker: string;
  basePrice: number;
  discountPrice: number;
  logger: Logger;
}

/**
 * Resuelve el precio final de un ticket combinando verificación BRC-20
 * (UniSat) y cálculo de precio. Fail-closed: si UniSat falla, precio completo.
 *
 * @param brc20Address dirección Bitcoin del usuario (null = sin descuento).
 */
export async function resolveTicketPrice(
  brc20Address: string | null,
  deps: ResolvePriceDeps,
): Promise<TicketPrice> {
  if (brc20Address === null) {
    return calculatePrice(false, deps.basePrice, deps.discountPrice);
  }
  try {
    const balance = await deps.unisatClient.getBrc20Balance(
      brc20Address,
      deps.ticker,
    );
    const hasDiscount = qualifiesForDiscount(balance.availableBalance);
    return calculatePrice(hasDiscount, deps.basePrice, deps.discountPrice);
  } catch (err) {
    // FAIL-CLOSED: UniSat falló → precio completo, sin descuento.
    deps.logger.warn(
      "UniSat falló al verificar descuento; aplicando precio completo",
      {
        brc20Address: brc20Address.slice(0, 12) + "...",
        error: err instanceof Error ? err.message : "unknown",
      },
    );
    return {
      amount: deps.basePrice,
      hasDiscount: false,
      reason: "UNISAT_FAILED",
    };
  }
}
