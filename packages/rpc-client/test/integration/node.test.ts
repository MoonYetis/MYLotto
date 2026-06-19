import { describe, it, expect } from "vitest";
import { config } from "dotenv";
import { FractalTransport } from "../../src/transport.js";
import { FractalRpcClient } from "../../src/client.js";

// Cargar .env de la raíz del proyecto para credenciales
config({ path: "../../.env" });

const shouldRun = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!shouldRun)(
  "FractalRpcClient — integración contra nodo real",
  () => {
    function makeClient(): FractalRpcClient {
      const url = process.env.FRACTAL_RPC_URL;
      const username = process.env.FRACTAL_RPC_USER;
      const password = process.env.FRACTAL_RPC_PASSWORD;
      if (!url || !username || !password) {
        throw new Error(
          "Faltan FRACTAL_RPC_URL/USER/PASSWORD en .env para tests de integración",
        );
      }
      const transport = new FractalTransport({ url, username, password });
      return new FractalRpcClient(transport);
    }

    it(
      "getBlockchainInfo devuelve chain y blocks > 0",
      async () => {
        const client = makeClient();
        const info = await client.getBlockchainInfo();
        expect(typeof info.chain).toBe("string");
        expect(info.chain.length).toBeGreaterThan(0);
        expect(info.blocks).toBeGreaterThan(0);
        console.log("    chain:", info.chain, "| blocks:", info.blocks,
          "| headers:", info.headers, "| IBD:", info.initialblockdownload);
      },
      30000,
    );

    it(
      "getBlockCount coincide con info.blocks",
      async () => {
        const client = makeClient();
        const [info, count] = await Promise.all([
          client.getBlockchainInfo(),
          client.getBlockCount(),
        ]);
        expect(count).toBe(info.blocks);
        console.log("    getBlockCount:", count);
      },
      30000,
    );

    it(
      "getBlockHash devuelve hex de 64 chars",
      async () => {
        const client = makeClient();
        const count = await client.getBlockCount();
        const hash = await client.getBlockHash(count);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        console.log("    hash del bloque", count, ":", hash);
      },
      30000,
    );

    it(
      "getBlock devuelve confirmaciones >= 1",
      async () => {
        const client = makeClient();
        const count = await client.getBlockCount();
        const hash = await client.getBlockHash(count);
        const block = await client.getBlock(hash);
        expect(block.confirmations).toBeGreaterThanOrEqual(1);
        expect(block.hash).toBe(hash);
        console.log("    block height:", block.height,
          "| confirmations:", block.confirmations);
      },
      30000,
    );
  },
);
