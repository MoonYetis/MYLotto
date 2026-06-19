/**
 * Jerarquía de errores del paquete brc20.
 * Todas las subclases extienden Brc20Error para que el backend
 * pueda atraparlas con un solo instanceof check.
 */
export class Brc20Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Brc20Error";
  }
}

// --- Errores de validación ---
export class InvalidAddressError extends Brc20Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAddressError";
  }
}

// --- Errores de UniSat ---
export class UnisatAuthError extends Brc20Error {
  constructor(message: string) {
    super(message);
    this.name = "UnisatAuthError";
  }
}
export class UnisatRateLimitError extends Brc20Error {
  constructor(message: string) {
    super(message);
    this.name = "UnisatRateLimitError";
  }
}
export class UnisatApiError extends Brc20Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(message);
    this.name = "UnisatApiError";
  }
}
export class UnisatNetworkError extends Brc20Error {
  constructor(message: string) {
    super(message);
    this.name = "UnisatNetworkError";
  }
}
export class UnisatTimeoutError extends Brc20Error {
  constructor(message: string) {
    super(message);
    this.name = "UnisatTimeoutError";
  }
}
export class CircuitOpenError extends Brc20Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}
