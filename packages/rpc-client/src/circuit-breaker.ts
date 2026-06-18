export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Fallos consecutivos para abrir el circuito */
  threshold: number;
  /** Milisegundos en OPEN antes de pasar a HALF_OPEN */
  resetMs: number;
}

/**
 * Implementa el patrón Circuit Breaker con 3 estados.
 *
 * - CLOSED: peticiones permitidas. Cada fallo incrementa el contador.
 *   Al alcanzar threshold → OPEN.
 * - OPEN: peticiones rechazadas inmediatamente. Tras resetMs → HALF_OPEN.
 * - HALF_OPEN: se permite UNA petición de prueba. Éxito → CLOSED. Fallo → OPEN.
 */
export class CircuitBreaker {
  private _state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  get state(): CircuitState {
    return this._state;
  }

  /**
   * ¿Se permite una petición? En HALF_OPEN consume el "token" de prueba.
   * Debe llamarse antes de cada call al RPC.
   */
  allow(now: number = Date.now()): boolean {
    if (this._state === "OPEN") {
      if (now - this.openedAt >= this.opts.resetMs) {
        this._state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    // CLOSED y HALF_OPEN permiten
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this._state = "CLOSED";
  }

  recordFailure(now: number = Date.now()): void {
    this.failureCount++;
    if (this._state === "HALF_OPEN") {
      this.trip(now);
      return;
    }
    if (this.failureCount >= this.opts.threshold) {
      this.trip(now);
    }
  }

  private trip(now: number): void {
    this._state = "OPEN";
    this.openedAt = now;
    this.failureCount = 0;
  }
}
