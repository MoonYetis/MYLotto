import { describe, it, expect } from "vitest";
import { FractalRpcClient } from "../../src/client.js";
import { FractalTransport } from "../../src/transport.js";
import { FetchMock } from "./fetch-mock.js";
import {
  rpcSuccess,
  fixtureBlockchainInfo,
  fixtureBlockHeader,
  fixtureBlockHash,
} from "./fixtures.js";

function makeClient(mock: FetchMock) {
  const transport = new FractalTransport({
    url: "http://100.64.0.1:8332",
    username: "user",
    password: "pass",
    retryBackoffMs: 1,
    fetchImpl: mock.fetch,
  });
  return new FractalRpcClient(transport);
}

describe("FractalRpcClient", () => {
  it("getBlockchainInfo devuelve BlockchainInfo tipado", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const client = makeClient(mock);
    const info = await client.getBlockchainInfo();
    expect(info.chain).toBe("fractal");
    expect(info.blocks).toBe(850000);
  });

  it("getBlockCount devuelve número", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(850000) });
    const client = makeClient(mock);
    const count = await client.getBlockCount();
    expect(count).toBe(850000);
    // verificar que llamó al método correcto
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getblockcount");
  });

  it("getBlockHash devuelve hex string", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(fixtureBlockHash) });
    const client = makeClient(mock);
    const hash = await client.getBlockHash(850000);
    expect(hash).toBe(fixtureBlockHash);
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getblockhash");
    expect(body.params).toEqual([850000]);
  });

  it("getBlock devuelve BlockHeader", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(fixtureBlockHeader) });
    const client = makeClient(mock);
    const block = await client.getBlock(fixtureBlockHash);
    expect(block.hash).toBe(fixtureBlockHash);
    expect(block.confirmations).toBe(5);
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getblock");
  });

  it("getReceivedByAddress pasa address y minconf", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(0.5) });
    const client = makeClient(mock);
    const amount = await client.getReceivedByAddress("bc1q...", 1);
    expect(amount).toBe(0.5);
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getreceivedbyaddress");
    expect(body.params).toEqual(["bc1q...", 1]);
  });

  it("getReceivedByAddress default minconf = 1", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(0) });
    const client = makeClient(mock);
    await client.getReceivedByAddress("bc1q...");
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.params).toEqual(["bc1q...", 1]);
  });
});
