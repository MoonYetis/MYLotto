/**
 * Jerarquía de errores del cliente RPC de Fractal Bitcoin.
 * Todas las subclases extienden FractalRpcError para que el backend
 * pueda atraparlas con un solo instanceof check.
 */
export class FractalRpcError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly method?: string,
  ) {
    super(message);
    this.name = "FractalRpcError";
  }
}

/** Timeout de la petición HTTP (AbortController). */
export class RpcTimeoutError extends FractalRpcError {
  constructor(method?: string) {
    super(`RPC timeout llamando a ${method ?? "método"}`, undefined, method);
    this.name = "RpcTimeoutError";
  }
}

/** Circuit breaker abierto — la petición ni siquiera se intentó. */
export class CircuitOpenError extends FractalRpcError {
  constructor(method?: string) {
    super(`Circuit breaker abierto para ${method ?? "método"}`, undefined, method);
    this.name = "CircuitOpenError";
  }
}

/** HTTP 401 — credenciales RPC inválidas. No se reintenta. */
export class RpcAuthError extends FractalRpcError {
  constructor(method?: string) {
    super(`Autenticación RPC fallida (401) en ${method ?? "método"}`, 401, method);
    this.name = "RpcAuthError";
  }
}

/** Error lógico devuelto por el nodo (código RPC negativo, ej. -3 INVALID_PARAMETER). */
export class RpcMethodError extends FractalRpcError {
  constructor(message: string, code?: number, method?: string) {
    super(message, code, method);
    this.name = "RpcMethodError";
  }
}

/** Error de red (ECONNRESET, ECONNREFUSED, ETIMEDOUT, etc.). */
export class RpcNetworkError extends FractalRpcError {
  constructor(message: string, method?: string) {
    super(message, undefined, method);
    this.name = "RpcNetworkError";
  }
}
