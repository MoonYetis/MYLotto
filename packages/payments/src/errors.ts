/**
 * Jerarquía de errores del motor de pagos.
 * Hoy solo la base + InsufficientPaymentError (reservada para validaciones futuras).
 */
export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

/** Reservada para validaciones futuras (ej. monto recibido != esperado). */
export class InsufficientPaymentError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPaymentError";
  }
}
