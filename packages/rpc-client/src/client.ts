import type { BlockchainInfo, BlockHeader } from "@myloto/types";
import type { FractalTransport } from "./transport.js";

/**
 * Capa de dominio tipada sobre FractalTransport.
 * Cada método envuelve exactamente un método RPC y devuelve un tipo estricto.
 * Cero lógica de red aquí — solo mapeo de tipos.
 */
export class FractalRpcClient {
  constructor(private readonly transport: FractalTransport) {}

  /** Salud del nodo: cadena, altura, IBD, progreso. */
  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.transport.call<BlockchainInfo>("getblockchaininfo");
  }

  /** Altura actual del mejor bloque. */
  async getBlockCount(): Promise<number> {
    return this.transport.call<number>("getblockcount");
  }

  /** Hash del bloque a la altura dada (hex de 64 chars). */
  async getBlockHash(height: number): Promise<string> {
    return this.transport.call<string>("getblockhash", [height]);
  }

  /** Header + metadata del bloque. */
  async getBlock(hash: string): Promise<BlockHeader> {
    return this.transport.call<BlockHeader>("getblock", [hash]);
  }

  /**
   * Total recibido por una dirección en FB.
   * NOTA: consulta direcciones ya conocidas por el backend; NO usa scantxoutset
   * ni expone la XPUB al nodo.
   */
  async getReceivedByAddress(address: string, minconf = 1): Promise<number> {
    return this.transport.call<number>("getreceivedbyaddress", [address, minconf]);
  }
}
