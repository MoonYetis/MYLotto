/** Función inyectable para consultar el nodo. Desacopla payments de rpc-client. */
export type GetReceivedFn = (
  address: string,
  minconf: number,
) => Promise<number>;

export interface VerifyTicket {
  paymentAddress: string;
  expectedAmount: number;
}

export interface VerifyPaymentInput {
  getReceived: GetReceivedFn;
  ticket: VerifyTicket;
  /** Confirmaciones mínimas. Default 1. */
  minconf?: number;
}

export interface VerifyPaymentResult {
  /** true si received >= expectedAmount. */
  paid: boolean;
  /** Total recibido por la dirección (FB). */
  received: number;
  /** Monto esperado (echo para auditoría). */
  expected: number;
}

/**
 * Verifica si un ticket ha sido pagado consultando getreceivedbyaddress.
 * Sin lógica de red: delega en getReceived inyectable.
 */
export async function verifyPayment(
  input: VerifyPaymentInput,
): Promise<VerifyPaymentResult> {
  const minconf = input.minconf ?? 1;
  const received = await input.getReceived(
    input.ticket.paymentAddress,
    minconf,
  );
  return {
    paid: received >= input.ticket.expectedAmount,
    received,
    expected: input.ticket.expectedAmount,
  };
}
