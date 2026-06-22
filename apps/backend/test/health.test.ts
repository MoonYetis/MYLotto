import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { registerHealthRoutes } from "../src/routes/health.js";
import type { AppDeps } from "../src/dependencies.js";
import type { Logger } from "@myloto/config";
import type { DbHandle } from "@myloto/db";
import type { FractalRpcClient } from "@myloto/rpc-client";
import type { HdWallet } from "@myloto/crypto";
import type { UnisatClient } from "@myloto/brc20";

function mockDeps(
  overrides: Partial<{ rpc: FractalRpcClient; db: DbHandle }> = {},
): AppDeps {
  const logger: Logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  const rpc =
    overrides.rpc ??
    ({
      getBlockchainInfo: vi.fn().mockResolvedValue({
        chain: "fractal",
        blocks: 100,
        headers: 100,
        initialblockdownload: false,
        verificationprogress: 1,
      }),
    } as unknown as FractalRpcClient);
  const db =
    overrides.db ??
    ({
      db: { execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]) },
      pool: { end: vi.fn() },
    } as unknown as DbHandle);
  return {
    env: {
      NODE_ENV: "test",
      FRACTAL_RPC_URL: "http://100.0.0.1:8332",
      FRACTAL_RPC_USER: "u",
      FRACTAL_RPC_PASSWORD: "p",
      FRACTAL_RPC_TIMEOUT_MS: 15000,
      DATABASE_URL: "postgresql://u:p@localhost:5432/x",
      PORT: 3000,
      LOG_LEVEL: "info",
      UNISAT_BASE_URL: "https://open-api-fractal.unisat.io",
      UNISAT_API_KEY: "test-key",
      UNISAT_TIMEOUT_MS: 15000,
      BRC20_TICKER: "Moonyetis",
      XPUB_BIP86:
        "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ",
      TICKET_PRICE_FB: 100,
      TICKET_DISCOUNT_PRICE_FB: 80,
      PAYMENT_CHECK_INTERVAL_MS: 30000,
      PAYMENT_MIN_CONFIRMATIONS: 1,
      FRACTAL_RPC_WALLET: "",
      DRAW_CHECK_INTERVAL_MS: 30000,
      SCRUTINY_CHECK_INTERVAL_MS: 60000,
      DURACION_SORTEO_BLOQUES: 144,
      LIFECYCLE_CHECK_INTERVAL_MS: 60000,
    },
    logger,
    rpc,
    db,
    wallet: { deriveAddress: vi.fn() } as unknown as HdWallet,
    unisat: { getBrc20Balance: vi.fn() } as unknown as UnisatClient,
  };
}

async function buildApp(deps: AppDeps) {
  const app = Fastify();
  registerHealthRoutes(app, deps);
  await app.ready();
  return app;
}

describe("GET /health", () => {
  it("responde ok con info del nodo", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.node.chain).toBe("fractal");
    expect(body.node.blocks).toBe(100);
    await app.close();
  });

  it("responde 503 si el RPC falla", async () => {
    const rpc = {
      getBlockchainInfo: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as FractalRpcClient;
    const app = await buildApp(mockDeps({ rpc }));
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("error");
    expect(body.error).toBe("connection refused");
    await app.close();
  });
});

describe("GET /health/db", () => {
  it("responde ok si SELECT 1 funciona", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "GET", url: "/health/db" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("reachable");
    await app.close();
  });

  it("responde 503 si la DB falla", async () => {
    const db = {
      db: { execute: vi.fn().mockRejectedValue(new Error("connection refused")) },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "GET", url: "/health/db" });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("error");
    await app.close();
  });
});
