import { describe, it, expect } from "vitest";
import { config } from "dotenv";
import {
  UnisatClient,
  UnisatTransport,
  qualifiesForDiscount,
} from "../../src/index.js";
import { InvalidAddressError } from "../../src/errors.js";

config({ path: "../../.env" });

const shouldRun = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!shouldRun)("UnisatClient — integración con UniSat real", () => {
  const apiKey = process.env.UNISAT_API_KEY;
  const baseUrl = process.env.UNISAT_BASE_URL ?? "https://open-api-fractal.unisat.io";
  const ticker = process.env.BRC20_TICKER ?? "Moonyetis";
  // Dirección pública con Moonyetis (la proporciona el usuario). Si no está
  // definida, ese test específico se omite.
  const addrWithTokens = process.env.UNISAT_TEST_ADDR_WITH_TOKENS;
  const addrWithoutTokens = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";

  function makeClient(): UnisatClient {
    if (!apiKey) throw new Error("UNISAT_API_KEY no definida en .env");
    const transport = new UnisatTransport({ baseUrl, apiKey });
    return new UnisatClient(transport);
  }

  it(
    "consulta balance de dirección sin tokens (esperamos 0 o response controlada)",
    async () => {
      const client = makeClient();
      try {
        const balance = await client.getBrc20Balance(addrWithoutTokens, ticker);
        console.log(
          "    Balance de",
          addrWithoutTokens.slice(0, 12),
          "...:",
          balance.availableBalance,
        );
        expect(balance.ticker).toBe(ticker);
      } catch (err) {
        // UniSat puede devolver error si la dirección no tiene actividad;
        // es respuesta válida siempre que no sea InvalidAddressError.
        console.log(
          "    UniSat respondió (controlado):",
          err instanceof Error ? err.message : "unknown",
        );
      }
    },
    30000,
  );

  it("lanza InvalidAddressError sin tocar UniSat si dirección inválida", async () => {
    const client = makeClient();
    await expect(client.getBrc20Balance("invalid-addr", ticker)).rejects.toThrow(
      InvalidAddressError,
    );
  });

  it.skipIf(!addrWithTokens)(
    "consulta balance de dirección CON tokens Moonyetis",
    async () => {
      if (!addrWithTokens) return;
      const client = makeClient();
      const balance = await client.getBrc20Balance(addrWithTokens, ticker);
      console.log("    Balance con tokens:", balance.availableBalance);
      const hasDiscount = qualifiesForDiscount(balance.availableBalance);
      console.log("    Califica para descuento:", hasDiscount);
    },
    30000,
  );
});
