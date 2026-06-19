import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, type CircuitState } from "../../src/circuit-breaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("empieza en CLOSED", () => {
    const cb = new CircuitBreaker({ threshold: 5, resetMs: 30000 });
    expect(cb.state).toBe<CircuitState>("CLOSED");
  });

  it("pasa a OPEN tras threshold fallos consecutivos", () => {
    const cb = new CircuitBreaker({ threshold: 3, resetMs: 30000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("CLOSED");
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
  });

  it("allow() retorna true en CLOSED, false en OPEN", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    expect(cb.allow()).toBe(true);
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
    expect(cb.allow()).toBe(false);
  });

  it("pasa a HALF_OPEN tras resetMs", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
    vi.advanceTimersByTime(30000);
    expect(cb.allow()).toBe(true);
    expect(cb.state).toBe("HALF_OPEN");
  });

  it("HALF_OPEN → CLOSED si la petición de prueba tiene éxito", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    cb.recordFailure();
    vi.advanceTimersByTime(30000);
    cb.allow();
    cb.recordSuccess();
    expect(cb.state).toBe("CLOSED");
  });

  it("HALF_OPEN → OPEN si la petición de prueba falla", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    cb.recordFailure();
    vi.advanceTimersByTime(30000);
    cb.allow();
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
  });

  it("recordSuccess resetea el contador en CLOSED", () => {
    const cb = new CircuitBreaker({ threshold: 3, resetMs: 30000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("CLOSED");
  });
});
