import { randomUUID } from "node:crypto";
import type { JsonRpcError, JsonRpcSuccess } from "@myloto/types";
import { createLogger, type Logger } from "@myloto/config";
import { CircuitBreaker } from "./circuit-breaker.js";
import {
  CircuitOpenError,
  FractalRpcError,
  RpcAuthError,
  RpcMethodError,
  RpcNetworkError,
  RpcTimeoutError,
} from "./errors.js";

export type FetchImpl = typeof fetch;

export interface FractalTransportOptions {
  url: string;
  username: string;
  password: string;
  timeoutMs?: number; // default 15000
  maxRetries?: number; // intentos ADICIONALES, default 3 (máx 4 llamadas totales)
  retryBackoffMs?: number; // base backoff exponencial, default 500
  breakerThreshold?: number; // default 5
  breakerResetMs?: number; // default 30000
  /** Inyectar fetch para tests. Default: global fetch (undici). */
  fetchImpl?: FetchImpl;
  /** Inyectar logger para tests. Default: createLogger de @myloto/config. */
  logger?: Logger;
  /**
   * Nombre del wallet al que dirigir las llamadas (añade /wallet/<name> a la URL).
   * Bitcoin Core multi-wallet: si no se especifica, se usa el wallet por defecto.
   * El worker de MYLoto apunta al wallet watch-only para que getreceivedbyaddress
   * reconozca las direcciones derivadas.
   */
  walletName?: string;
}

/** Códigos RPC transitorios que sí merecen reintento (Bitcoin Core convention). */
const TRANSIENT_RPC_CODES = new Set<number>([-28]); // -28 = verifying blocks / loading index

/** Códigos de error de Node que indican problema de red transitorio. */
const TRANSIENT_ERRNO = new Set<string>([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
]);

export class FractalTransport {
  private readonly opts: Required<
    Omit<FractalTransportOptions, "fetchImpl" | "logger">
  >;
  private readonly breaker: CircuitBreaker;
  private readonly fetchImpl: FetchImpl;
  private readonly logger: Logger;
  private readonly authHeader: string;
  /** URL del endpoint RPC, con /wallet/<name> si walletName está definido. */
  private readonly requestUrl: string;

  constructor(options: FractalTransportOptions) {
    this.opts = {
      url: options.url,
      username: options.username,
      password: options.password,
      timeoutMs: options.timeoutMs ?? 15000,
      maxRetries: options.maxRetries ?? 3,
      retryBackoffMs: options.retryBackoffMs ?? 500,
      breakerThreshold: options.breakerThreshold ?? 5,
      breakerResetMs: options.breakerResetMs ?? 30000,
    };
    this.breaker = new CircuitBreaker({
      threshold: this.opts.breakerThreshold,
      resetMs: this.opts.breakerResetMs,
    });
    this.fetchImpl = options.fetchImpl ?? fetch;
    // Pre-calcular la URL: añade /wallet/<name> si se especificó walletName.
    this.requestUrl = options.walletName
      ? `${this.opts.url.replace(/\/+$/, "")}/wallet/${options.walletName}`
      : this.opts.url;
    this.logger = options.logger ?? createLogger("info", "rpc-client");
    const token = Buffer.from(
      `${this.opts.username}:${this.opts.password}`,
    ).toString("base64");
    this.authHeader = `Basic ${token}`;
  }

  /**
   * Ejecuta una llamada JSON-RPC 2.0 con resiliencia completa.
   * @throws FractalRpcError o subclase.
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.breaker.allow()) {
      this.logger.warn("circuit open, rejecting call", { method });
      throw new CircuitOpenError(method);
    }

    const maxAttempts = this.opts.maxRetries + 1;
    let lastError: FractalRpcError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const id = randomUUID();
      const started = Date.now();
      try {
        const result = await this.doFetch<T>(method, params, id);
        const durationMs = Date.now() - started;
        this.breaker.recordSuccess();
        this.logger.debug("rpc ok", { method, id, attempt, durationMs });
        return result;
      } catch (err) {
        const durationMs = Date.now() - started;
        lastError = toRpcError(err, method);
        this.logger.warn("rpc fail", {
          method,
          id,
          attempt,
          durationMs,
          errorCode: lastError.code,
          errorMsg: lastError.message,
        });

        if (!isTransient(lastError) || attempt === maxAttempts - 1) {
          break; // no reintenta
        }
        await sleep(backoffMs(this.opts.retryBackoffMs, attempt));
      }
    }

    this.breaker.recordFailure();
    throw lastError ?? new FractalRpcError("unknown RPC error", undefined, method);
  }

  private async doFetch<T>(
    method: string,
    params: unknown[],
    id: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const response = await this.fetchImpl(this.requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new RpcAuthError(method);
      }
      if (response.status >= 500) {
        throw new FractalRpcError(`HTTP ${response.status}`, response.status, method);
      }
      if (response.status === 429) {
        throw new FractalRpcError("HTTP 429 rate limited", 429, method);
      }
      if (response.status >= 400) {
        throw new FractalRpcError(`HTTP ${response.status}`, response.status, method);
      }

      const payload = (await response.json()) as
        | JsonRpcSuccess<T>
        | JsonRpcError;
      if ("error" in payload && payload.error) {
        throw new RpcMethodError(
          payload.error.message,
          payload.error.code,
          method,
        );
      }
      // Tras descartar error, payload es JsonRpcSuccess<T>
      return (payload as JsonRpcSuccess<T>).result;
    } catch (err) {
      if (err instanceof FractalRpcError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new RpcTimeoutError(method);
      }
      if (err instanceof Error) {
        const errno = (err as NodeJS.ErrnoException).code;
        if (errno && TRANSIENT_ERRNO.has(errno)) {
          throw new RpcNetworkError(`${errno}: ${err.message}`, method);
        }
      }
      throw new FractalRpcError(
        err instanceof Error ? err.message : "fetch error",
        undefined,
        method,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function isTransient(err: FractalRpcError): boolean {
  // Errores de red, timeout y 5xx son transitorios
  if (err instanceof RpcNetworkError) return true;
  if (err instanceof RpcTimeoutError) return true;
  // HTTP 5xx o 429
  if (
    err.code === 500 ||
    err.code === 502 ||
    err.code === 503 ||
    err.code === 504 ||
    err.code === 429
  ) {
    return true;
  }
  // Código RPC -28 (verifying blocks)
  if (
    err instanceof RpcMethodError &&
    err.code !== undefined &&
    TRANSIENT_RPC_CODES.has(err.code)
  ) {
    return true;
  }
  return false;
}

function toRpcError(err: unknown, method: string): FractalRpcError {
  if (err instanceof FractalRpcError) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new RpcTimeoutError(method);
  }
  return new FractalRpcError(
    err instanceof Error ? err.message : "unknown",
    undefined,
    method,
  );
}

function backoffMs(base: number, attempt: number): number {
  const exp = base * Math.pow(2, attempt);
  const jitter = Math.random() * 250;
  return exp + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
