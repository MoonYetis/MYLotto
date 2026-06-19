import {
  loadEnv,
  createLogger,
  type Env,
  type Logger,
} from "@myloto/config";
import { createDb, type DbHandle } from "@myloto/db";
import { FractalRpcClient, FractalTransport } from "@myloto/rpc-client";

export interface AppDeps {
  env: Env;
  logger: Logger;
  db: DbHandle;
  rpc: FractalRpcClient;
}

/**
 * Construye las dependencias de la aplicación desde variables de entorno.
 * Único punto donde se cablean config + db + rpc-client.
 * En tests se inyectan mocks en lugar de llamar a esta función.
 */
export function buildDeps(): AppDeps {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, "backend");
  const db = createDb(env.DATABASE_URL);
  const transport = new FractalTransport({
    url: env.FRACTAL_RPC_URL,
    username: env.FRACTAL_RPC_USER,
    password: env.FRACTAL_RPC_PASSWORD,
    timeoutMs: env.FRACTAL_RPC_TIMEOUT_MS,
  });
  const rpc = new FractalRpcClient(transport);
  return { env, logger, db, rpc };
}
