import { describe, it, expect, beforeEach } from "vitest";
import { UnisatTransport } from "../../src/transport.js";
import { FetchMock } from "./fetch-mock.js";
import { fixtureBrc20BalanceWithTokens, fixtureApiError } from "./fixtures.js";
import {
  UnisatAuthError,
  UnisatRateLimitError,
  UnisatApiError,
  CircuitOpenError,
  Brc20Error,
} from "../../src/errors.js";

function makeTransport(mock: FetchMock, overrides: Record<string, unknown> = {}) {
  return new UnisatTransport({
    baseUrl: "https://open-api-fractal.unisat.io",
    apiKey: "test-api-key",
    timeoutMs: 5000,
    maxRetries: 3,
    retryBackoffMs: 1,
    breakerThreshold: 5,
    breakerResetMs: 1000,
    fetchImpl: mock.fetch,
    ...overrides,
  });
}

describe("UnisatTransport", () => {
  let mock: FetchMock;
  beforeEach(() => {
    mock = new FetchMock();
  });

  it("parsea una respuesta code=0 exitosa", async () => {
    mock.queue({ body: fixtureBrc20BalanceWithTokens });
    const t = makeTransport(mock);
    const result = await t.get("/v1/indexer/test");
    // El transport devuelve solo .data, no el envelope completo
    expect(result).toEqual(fixtureBrc20BalanceWithTokens.data);
  });

  it("envía Bearer auth", async () => {
    mock.queue({ body: fixtureBrc20BalanceWithTokens });
    const t = makeTransport(mock);
    await t.get("/test");
    const init = mock.calls[0]?.init;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-api-key");
  });

  it("construye query string desde params", async () => {
    mock.queue({ body: fixtureBrc20BalanceWithTokens });
    const t = makeTransport(mock);
    await t.get("/test", { foo: "bar", baz: "qux" });
    expect(mock.calls[0]?.url).toContain("foo=bar");
    expect(mock.calls[0]?.url).toContain("baz=qux");
  });

  it("lanza UnisatApiError en code != 0 sin reintento", async () => {
    mock.queue({ body: fixtureApiError });
    const t = makeTransport(mock);
    await expect(t.get("/test")).rejects.toBeInstanceOf(UnisatApiError);
    expect(mock.calls).toHaveLength(1);
  });

  it("lanza UnisatAuthError en 401 sin reintentar", async () => {
    mock.queue({ status: 401, body: {} });
    const t = makeTransport(mock);
    await expect(t.get("/test")).rejects.toBeInstanceOf(UnisatAuthError);
    expect(mock.calls).toHaveLength(1);
  });

  it("lanza UnisatRateLimitError en 429 sin reintentar", async () => {
    mock.queue({ status: 429, body: {} });
    const t = makeTransport(mock);
    await expect(t.get("/test")).rejects.toBeInstanceOf(UnisatRateLimitError);
    expect(mock.calls).toHaveLength(1);
  });

  it("reintenta en 500 y termina exitosamente", async () => {
    mock
      .queue({ status: 500, body: {} })
      .queue({ body: fixtureBrc20BalanceWithTokens });
    const t = makeTransport(mock);
    const result = await t.get("/test");
    expect(result).toEqual(fixtureBrc20BalanceWithTokens.data);
    expect(mock.calls).toHaveLength(2);
  });

  it("circuito abre tras N fallos consecutivos", async () => {
    const t = makeTransport(mock, { breakerThreshold: 2, maxRetries: 0 });
    mock.queue({ status: 500, body: {} });
    await expect(t.get("/test")).rejects.toBeInstanceOf(Brc20Error);
    mock.queue({ status: 500, body: {} });
    await expect(t.get("/test")).rejects.toBeInstanceOf(Brc20Error);
    // Circuito abierto
    await expect(t.get("/test")).rejects.toBeInstanceOf(CircuitOpenError);
    expect(mock.calls).toHaveLength(2);
  });
});
