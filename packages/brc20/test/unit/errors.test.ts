import { describe, it, expect } from "vitest";
import {
  Brc20Error,
  InvalidAddressError,
  UnisatAuthError,
  UnisatRateLimitError,
  UnisatApiError,
  UnisatNetworkError,
  UnisatTimeoutError,
  CircuitOpenError,
} from "../../src/errors.js";

describe("errores brc20", () => {
  it("Brc20Error guarda message", () => {
    const err = new Brc20Error("boom");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("Brc20Error");
  });

  it("todas las subclases extienden Brc20Error", () => {
    expect(new InvalidAddressError("x")).toBeInstanceOf(Brc20Error);
    expect(new UnisatAuthError("x")).toBeInstanceOf(Brc20Error);
    expect(new UnisatRateLimitError("x")).toBeInstanceOf(Brc20Error);
    expect(new UnisatApiError("x", 1)).toBeInstanceOf(Brc20Error);
    expect(new UnisatNetworkError("x")).toBeInstanceOf(Brc20Error);
    expect(new UnisatTimeoutError("x")).toBeInstanceOf(Brc20Error);
    expect(new CircuitOpenError("x")).toBeInstanceOf(Brc20Error);
  });

  it("UnisatApiError guarda code", () => {
    const err = new UnisatApiError("invalid ticker", 10001);
    expect(err.code).toBe(10001);
    expect(err.message).toBe("invalid ticker");
  });

  it("cada subclase tiene su name correcto", () => {
    expect(new InvalidAddressError("x").name).toBe("InvalidAddressError");
    expect(new UnisatAuthError("x").name).toBe("UnisatAuthError");
    expect(new UnisatRateLimitError("x").name).toBe("UnisatRateLimitError");
    expect(new UnisatApiError("x", 1).name).toBe("UnisatApiError");
    expect(new UnisatNetworkError("x").name).toBe("UnisatNetworkError");
    expect(new UnisatTimeoutError("x").name).toBe("UnisatTimeoutError");
    expect(new CircuitOpenError("x").name).toBe("CircuitOpenError");
  });
});
