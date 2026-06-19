import type { UnisatTransport } from "./transport.js";
import { isValidBitcoinAddress } from "./validate-address.js";
import { InvalidAddressError } from "./errors.js";

export interface Brc20Balance {
  ticker: string;
  overallBalance: string;
  availableBalance: string;
  transferableBalance: string;
}

/**
 * Capa de dominio tipada sobre UnisatTransport.
 * Expone métodos de negocio (BRC-20 balances, etc.).
 */
export class UnisatClient {
  constructor(private readonly transport: UnisatTransport) {}

  /**
   * Consulta el balance BRC-20 de un ticker para una dirección.
   * Endpoint: GET /v1/indexer/address/{address}/brc20/{ticker}/info
   *
   * @throws InvalidAddressError si la dirección no es Bitcoin válida.
   * @throws UnisatApiError si UniSat devuelve code !== 0.
   * @throws UnisatNetworkError si hay fallo de red agotando reintentos.
   */
  async getBrc20Balance(
    address: string,
    ticker: string,
  ): Promise<Brc20Balance> {
    if (!isValidBitcoinAddress(address)) {
      throw new InvalidAddressError(
        `dirección Bitcoin inválida: ${address.slice(0, 20)}...`,
      );
    }
    return this.transport.get<Brc20Balance>(
      `/v1/indexer/address/${address}/brc20/${ticker}/info`,
    );
  }
}
