/**
 * Tipos de respuesta de los métodos RPC de Fractal Bitcoin que usamos.
 * Solo los campos que extraemos — el resto del payload se ignora.
 */

export interface BlockchainInfo {
  /** Nombre de la red: "main", "test", "regtest", o el nombre de Fractal */
  chain: string;
  /** Altura del bloque más procesado */
  blocks: number;
  /** Número de headers válidos conocidos */
  headers: number;
  /** True si el nodo está en Initial Block Download */
  initialblockdownload: boolean;
  /** Progreso de verificación de encadenamiento (0–1) */
  verificationprogress: number;
}

export interface BlockHeader {
  hash: string;
  confirmations: number;
  height: number;
  /** Tiempo del bloque en segundos UNIX */
  time: number;
  nonce: number;
}

/**
 * Estructura de una respuesta JSON-RPC 2.0 exitosa.
 */
export interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

/**
 * Estructura de una respuesta JSON-RPC 2.0 de error.
 * El código de error sigue la convención de Bitcoin Core.
 */
export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}
