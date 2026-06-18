import { describe, it, expect } from "vitest";
import {
  FractalRpcError,
  RpcTimeoutError,
  CircuitOpenError,
  RpcAuthError,
  RpcMethodError,
  RpcNetworkError,
} from "../../src/errors.js";

describe("errores RPC", () => {
  it("FractalRpcError guarda message, code y method", () => {
    const err = new FractalRpcError("boom", -32600, "getblock");
    expect(err.message).toBe("boom");
    expect(err.code).toBe(-32600);
    expect(err.method).toBe("getblock");
    expect(err.name).toBe("FractalRpcError");
  });

  it("todas las subclases extienden FractalRpcError", () => {
    expect(new RpcTimeoutError("t")).toBeInstanceOf(FractalRpcError);
    expect(new CircuitOpenError("c")).toBeInstanceOf(FractalRpcError);
    expect(new RpcAuthError("a")).toBeInstanceOf(FractalRpcError);
    expect(new RpcMethodError("m", -3)).toBeInstanceOf(FractalRpcError);
    expect(new RpcNetworkError("n")).toBeInstanceOf(FractalRpcError);
  });

  it("RpcMethodError acepta code RPC opcional", () => {
    const err = new RpcMethodError("invalid param", -3);
    expect(err.code).toBe(-3);
  });
});
