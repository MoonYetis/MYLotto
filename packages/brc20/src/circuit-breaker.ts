// TODO: extraer a @myloto/http-utils cuando haya 3+ consumidores (regla de tres).
// Hoy: rpc-client (Ciclo 1) y brc20 (Ciclo 3) = 2 consumidores.

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  threshold: number;
  resetMs: number;
}

export class CircuitBreaker {
  private _state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  get state(): CircuitState {
    return this._state;
  }

  allow(now: number = Date.now()): boolean {
    if (this._state === "OPEN") {
      if (now - this.openedAt >= this.opts.resetMs) {
        this._state = "HALF_OPEN";
        return true;
      }
      return false;
    }
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
