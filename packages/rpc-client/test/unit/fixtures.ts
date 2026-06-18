/**
 * Respuestas JSON-RPC capturadas/representativas para tests.
 * Mantener deterministas — nunca llaman a la red real.
 */

import type {
  JsonRpcSuccess,
  JsonRpcError,
  BlockchainInfo,
  BlockHeader,
} from "@myloto/types";

export const fixtureBlockchainInfo: BlockchainInfo = {
  chain: "fractal",
  blocks: 850000,
  headers: 850000,
  initialblockdownload: false,
  verificationprogress: 0.99998,
};

export const fixtureBlockHeader: BlockHeader = {
  hash: "0000000000000000000123456789abcdef0123456789abcdef0123456789abcdef",
  confirmations: 5,
  height: 850000,
  time: 1718700000,
  nonce: 1234567890,
};

export const fixtureBlockHash =
  "0000000000000000000123456789abcdef0123456789abcdef0123456789abcdef";

export function rpcSuccess<T>(result: T, id = "test-id"): JsonRpcSuccess<T> {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(
  code: number,
  message: string,
  id = "test-id",
): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
