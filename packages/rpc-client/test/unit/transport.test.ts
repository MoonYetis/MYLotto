import { describe, it, expect, beforeEach } from "vitest";
import { FractalTransport } from "../../src/transport.js";
import { FetchMock } from "./fetch-mock.js";
import { rpcSuccess, rpcError, fixtureBlockchainInfo } from "./fixtures.js";
import {
  RpcAuthError,
  RpcMethodError,
  CircuitOpenError,
  FractalRpcError,
} from "../../src/errors.js";

function makeTransport(mock: FetchMock, overrides: Record<string, unknown> = {}) {
  const transport = new FractalTransport({
    url: "http://100.64.0.1:8332",
    username: "moonyetis_rpc",
    password: "secret",
    timeoutMs: 5000,
    maxRetries: 3,
    retryBackoffMs: 10, // bajo para tests rápidos
    breakerThreshold: 5,
    breakerResetMs: 1000,
    fetchImpl: mock.fetch,
    ...overrides,
  });
  return transport;
}

describe("FractalTransport", () => {
  let mock: FetchMock;
  beforeEach(() => {
    mock = new FetchMock();
  });

  it("parsea una respuesta exitosa", async () => {
    mock.queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock);
    const result = await t.call("getblockchaininfo");
    expect(result).toEqual(fixtureBlockchainInfo);
  });

  it("envía Basic Auth con las credenciales", async () => {
    mock.queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock);
    await t.call("getblockchaininfo");
    const init = mock.calls[0]?.init;
    const auth = (init?.headers ?? {}) as Record<string, string>;
    const authHeader = auth.Authorization ?? "";
    expect(authHeader).toMatch(/^Basic /);
    const decoded = Buffer.from(
      authHeader.replace("Basic ", ""),
      "base64",
    ).toString();
    expect(decoded).toBe("moonyetis_rpc:secret");
  });

  it("lanza RpcAuthError en HTTP 401 sin reintentar", async () => {
    mock.queue({ status: 401, body: {} });
    const t = makeTransport(mock);
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(RpcAuthError);
    expect(mock.calls).toHaveLength(1); // sin reintentos
  });

  it("lanza RpcMethodError en error lógico RPC (-3) sin reintentar", async () => {
    mock.queue({ body: rpcError(-3, "Invalid parameters") });
    const t = makeTransport(mock);
    await expect(t.call("getblock")).rejects.toBeInstanceOf(RpcMethodError);
    expect(mock.calls).toHaveLength(1);
  });

  it("reintenta en HTTP 500 y termina exitosamente", async () => {
    mock
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} })
      .queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock, { retryBackoffMs: 1 });
    const result = await t.call("getblockchaininfo");
    expect(result).toEqual(fixtureBlockchainInfo);
    expect(mock.calls).toHaveLength(3);
  });

  it("agota reintentos y lanza FractalRpcError", async () => {
    mock
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} }); // 4 intentos totales (1 + 3 retries)
    const t = makeTransport(mock, { retryBackoffMs: 1 });
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(
      FractalRpcError,
    );
    expect(mock.calls).toHaveLength(4);
  });

  it("reintenta en error RPC transitorio -28 (verifying blocks)", async () => {
    mock
      .queue({ body: rpcError(-28, "Verifying blocks...") })
      .queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock, { retryBackoffMs: 1 });
    const result = await t.call("getblockchaininfo");
    expect(result).toEqual(fixtureBlockchainInfo);
    expect(mock.calls).toHaveLength(2);
  });

  it("circuito abre tras N fallos consecutivos y rechaza sin red", async () => {
    // threshold 2: 2 fallos abren el circuito
    const t = makeTransport(mock, {
      breakerThreshold: 2,
      retryBackoffMs: 1,
      maxRetries: 0,
    });
    mock.queue({ status: 500, body: {} });
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(
      FractalRpcError,
    );
    mock.queue({ status: 500, body: {} });
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(
      FractalRpcError,
    );
    // ahora circuito abierto
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(mock.calls).toHaveLength(2); // la 3a ni tocó la red
  });
});
