import { createLogger, type Logger } from "@myloto/config";
import {
  CircuitOpenError,
  Brc20Error,
  UnisatAuthError,
  UnisatRateLimitError,
  UnisatApiError,
  UnisatNetworkError,
  UnisatTimeoutError,
} from "./errors.js";
import { CircuitBreaker } from "./circuit-breaker.js";

export type FetchImpl = typeof fetch;

export interface UnisatTransportOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  breakerThreshold?: number;
  breakerResetMs?: number;
  fetchImpl?: FetchImpl;
  logger?: Logger;
}

const TRANSIENT_ERRNO = new Set<string>([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
]);

export class UnisatTransport {
  private readonly opts: Required<
    Omit<UnisatTransportOptions, "fetchImpl" | "logger">
  >;
  private readonly breaker: CircuitBreaker;
  private readonly fetchImpl: FetchImpl;
  private readonly logger: Logger;

  constructor(options: UnisatTransportOptions) {
    this.opts = {
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
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
    this.logger = options.logger ?? createLogger("info", "brc20");
  }

  /**
   * GET a un path con query params. Devuelve el JSON parseado.
   * @throws Brc20Error o subclase.
   */
  async get<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    if (!this.breaker.allow()) {
      this.logger.warn("circuit open, rejecting call", { path });
      throw new CircuitOpenError(`circuit breaker abierto para ${path}`);
    }

    const maxAttempts = this.opts.maxRetries + 1;
    let lastError: Brc20Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const started = Date.now();
      try {
        const result = await this.doFetch<T>(path, params);
        const durationMs = Date.now() - started;
        this.breaker.recordSuccess();
        this.logger.debug("unisat ok", { path, attempt, durationMs });
        return result;
      } catch (err) {
        const durationMs = Date.now() - started;
        lastError = toBrc20Error(err, path);
        this.logger.warn("unisat fail", {
          path,
          attempt,
          durationMs,
          errorMsg: lastError.message,
        });

        if (!isTransient(lastError) || attempt === maxAttempts - 1) {
          break;
        }
        await sleep(backoffMs(this.opts.retryBackoffMs, attempt));
      }
    }

    this.breaker.recordFailure();
    throw (
      lastError ?? new Brc20Error(`unknown error en ${path}`)
    );
  }

  private async doFetch<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(this.opts.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new UnisatAuthError(`401 Unauthorized en ${path}`);
      }
      if (response.status === 429) {
        throw new UnisatRateLimitError(`429 Too Many Requests en ${path}`);
      }
      if (response.status >= 500) {
        throw new Brc20Error(`HTTP ${response.status} en ${path}`);
      }
      if (response.status >= 400) {
        throw new Brc20Error(`HTTP ${response.status} en ${path}`);
      }

      const payload = (await response.json()) as {
        code: number;
        msg: string;
        data: T;
      };
      if (payload.code !== 0) {
        throw new UnisatApiError(payload.msg, payload.code);
      }
      return payload.data;
    } catch (err) {
      if (err instanceof Brc20Error) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new UnisatTimeoutError(`timeout en ${path}`);
      }
      if (err instanceof Error) {
        const errno = (err as NodeJS.ErrnoException).code;
        if (errno && TRANSIENT_ERRNO.has(errno)) {
          throw new UnisatNetworkError(`${errno}: ${err.message}`);
        }
      }
      throw new Brc20Error(
        err instanceof Error ? err.message : "fetch error",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

function isTransient(err: Brc20Error): boolean {
  if (err instanceof UnisatNetworkError) return true;
  if (err instanceof UnisatTimeoutError) return true;
  // 5xx (reconocemos por el prefijo del mensaje)
  if (/^HTTP 5\d\d/.test(err.message)) return true;
  return false;
}

function toBrc20Error(err: unknown, path: string): Brc20Error {
  if (err instanceof Brc20Error) return err;
  if (err instanceof Error && err.name === "AbortError") {
    return new UnisatTimeoutError(`timeout en ${path}`);
  }
  return new Brc20Error(err instanceof Error ? err.message : "unknown");
}

function backoffMs(base: number, attempt: number): number {
  return base * Math.pow(2, attempt) + Math.random() * 250;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
