import pino, {
  type Logger as PinoLogger,
  type DestinationStream,
} from "pino";

export interface Logger {
  trace(msg: string, data?: object): void;
  debug(msg: string, data?: object): void;
  info(msg: string, data?: object): void;
  warn(msg: string, data?: object): void;
  error(msg: string, data?: object): void;
  fatal(msg: string, data?: object): void;
  child(bindings: { service: string }): Logger;
}

export interface LoggerOptions {
  /** Permite inyectar un destino custom (útil para tests). Si no se da, usa stdout. */
  destination?: DestinationStream;
}

const REDACT_PATHS = [
  "password",
  "*.password",
  "FRACTAL_RPC_PASSWORD",
  "*.FRACTAL_RPC_PASSWORD",
  "Authorization",
  "*.Authorization",
];

export function createLogger(
  level: string,
  service: string,
  opts: LoggerOptions = {},
): Logger {
  const pinoLogger = pino(
    {
      level,
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    },
    opts.destination ?? undefined,
  );
  return wrapPino(pinoLogger.child({ service }));
}

function wrapPino(p: PinoLogger): Logger {
  return {
    trace: (msg, data) => p.trace(data ?? {}, msg),
    debug: (msg, data) => p.debug(data ?? {}, msg),
    info: (msg, data) => p.info(data ?? {}, msg),
    warn: (msg, data) => p.warn(data ?? {}, msg),
    error: (msg, data) => p.error(data ?? {}, msg),
    fatal: (msg, data) => p.fatal(data ?? {}, msg),
    child: (bindings) => wrapPino(p.child(bindings)),
  };
}
