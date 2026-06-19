import { describe, it, expect } from "vitest";
import { UnisatClient } from "../../src/client.js";
import { UnisatTransport } from "../../src/transport.js";
import { FetchMock } from "./fetch-mock.js";
import { fixtureBrc20BalanceWithTokens } from "./fixtures.js";
import { InvalidAddressError } from "../../src/errors.js";

function makeClient(mock: FetchMock) {
  const transport = new UnisatTransport({
    baseUrl: "https://open-api-fractal.unisat.io",
    apiKey: "test-key",
    retryBackoffMs: 1,
    fetchImpl: mock.fetch,
  });
  return new UnisatClient(transport);
}

const VALID_ADDR = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";

describe("UnisatClient.getBrc20Balance", () => {
  it("devuelve Brc20Balance tipado", async () => {
    const mock = new FetchMock();
    mock.queue({ body: fixtureBrc20BalanceWithTokens });
    const client = makeClient(mock);
    const balance = await client.getBrc20Balance(VALID_ADDR, "Moonyetis");
    expect(balance.ticker).toBe("Moonyetis");
    expect(balance.overallBalance).toBe("1000");
    expect(balance.availableBalance).toBe("950");
  });

  it("llama al path correcto", async () => {
    const mock = new FetchMock();
    mock.queue({ body: fixtureBrc20BalanceWithTokens });
    const client = makeClient(mock);
    await client.getBrc20Balance(VALID_ADDR, "Moonyetis");
    expect(mock.calls[0]?.url).toContain(
      `/v1/indexer/address/${VALID_ADDR}/brc20/Moonyetis/info`,
    );
  });

  it("lanza InvalidAddressError sin llamar a UniSat si la dirección es inválida", async () => {
    const mock = new FetchMock();
    const client = makeClient(mock);
    await expect(client.getBrc20Balance("invalid", "Moonyetis")).rejects.toThrow(
      InvalidAddressError,
    );
    expect(mock.calls).toHaveLength(0);
  });

  it("acepta dirección Legacy", async () => {
    const mock = new FetchMock();
    mock.queue({ body: fixtureBrc20BalanceWithTokens });
    const client = makeClient(mock);
    await client.getBrc20Balance("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "Moonyetis");
    expect(mock.calls[0]?.url).toContain("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2");
  });
});
