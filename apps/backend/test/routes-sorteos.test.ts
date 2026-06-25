import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { registerSorteoRoutes } from "../src/routes/sorteos.js";
import type { AppDeps } from "../src/dependencies.js";
import type { Logger } from "@myloto/config";
import type { DbHandle } from "@myloto/db";
import type { FractalRpcClient } from "@myloto/rpc-client";
import type { HdWallet } from "@myloto/crypto";
import type { UnisatClient } from "@myloto/brc20";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function mockDb() {
  const selectResult = vi.fn().mockResolvedValue([
    { id: 1, estado: "ABIERTO", bloqueCierre: 200 },
  ]);
  const updateReturning = vi.fn().mockResolvedValue([{ id: 1 }]);
  const selectWhere = vi.fn().mockImplementation(() => {
    return Object.assign(selectResult(), { limit: () => selectResult() });
  });
  const updateWhere = vi.fn().mockImplementation(() => {
    return Object.assign(vi.fn().mockResolvedValue(undefined)(), {
      returning: updateReturning,
    });
  });
  return {
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 1, bloqueCierre: 244, estado: "ABIERTO", creadoEn: new Date() },
          ]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where: selectWhere }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhere }),
      }),
    },
    pool: { end: vi.fn() },
  } as unknown as DbHandle;
}

function mockDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    env: {
      NODE_ENV: "test",
      FRACTAL_RPC_URL: "http://127.0.0.1:8332",
      FRACTAL_RPC_USER: "u",
      FRACTAL_RPC_PASSWORD: "p",
      FRACTAL_RPC_TIMEOUT_MS: 15000,
      DATABASE_URL: "postgresql://u:p@localhost:5432/x",
      PORT: 3000,
      LOG_LEVEL: "info",
      UNISAT_BASE_URL: "https://open-api-fractal.unisat.io",
      UNISAT_API_KEY: "k",
      UNISAT_TIMEOUT_MS: 15000,
      BRC20_TICKER: "Moonyetis",
      XPUB_BIP86:
        "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ",
      TICKET_PRICE_FB: 1,
      TICKET_DISCOUNT_PRICE_FB: 0.8,
      JACKPOT_BASE_FB: 1000,
      PAYMENT_CHECK_INTERVAL_MS: 30000,
      PAYMENT_MIN_CONFIRMATIONS: 1,
      FRACTAL_RPC_WALLET: "",
      DRAW_CHECK_INTERVAL_MS: 30000,
      SCRUTINY_CHECK_INTERVAL_MS: 60000,
      DURACION_SORTEO_BLOQUES: 144,
      LIFECYCLE_CHECK_INTERVAL_MS: 60000,
    },
    logger,
    db: mockDb(),
    rpc: {
      getBlockCount: vi.fn().mockResolvedValue(100),
    } as unknown as FractalRpcClient,
    wallet: { deriveAddress: vi.fn() } as unknown as HdWallet,
    unisat: { getBrc20Balance: vi.fn() } as unknown as UnisatClient,
    ...overrides,
  };
}

async function buildApp(deps: AppDeps) {
  const app = Fastify();
  registerSorteoRoutes(app, deps);
  await app.ready();
  return app;
}

describe("POST /admin/sorteos", () => {
  it("201 crea sorteo con bloqueCierre = altura + DURACION", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "POST", url: "/admin/sorteos" });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.estado).toBe("ABIERTO");
    expect(body.bloqueCierre).toBe(244);
    await app.close();
  });
});

describe("GET /sorteos/abierto", () => {
  it("200 devuelve sorteo ABIERTO", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "GET", url: "/sorteos/abierto" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).estado).toBe("ABIERTO");
    await app.close();
  });

  it("404 si no hay ABIERTO", async () => {
    const db = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              const r = vi.fn().mockResolvedValue([])();
              return Object.assign(r, { limit: () => r });
            }),
          }),
        }),
      },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "GET", url: "/sorteos/abierto" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("GET /sorteos/:id", () => {
  it("200 devuelve sorteo", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "GET", url: "/sorteos/5" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe(1);
    await app.close();
  });
});

describe("GET /sorteos/:id/ganadores", () => {
  it("200 devuelve lista de ganadores", async () => {
    const db = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 1n, ticketId: 10n, tier: 1, monto: "680", pagado: false },
            ]),
          }),
        }),
      },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "GET", url: "/sorteos/1/ganadores" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0].tier).toBe(1);
    await app.close();
  });
});

describe("GET /jackpot", () => {
  it("200 devuelve saldo", async () => {
    const db = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ saldo: "1500" }]),
          }),
        }),
      },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "GET", url: "/jackpot" });
    expect(res.statusCode).toBe(200);
    // saldo = JACKPOT_BASE_FB (1000) + acumulado (1500) = 2500
    const body = JSON.parse(res.body);
    expect(body.saldo).toBe(2500);
    expect(body.base).toBe(1000);
    expect(body.acumulado).toBe(1500);
    await app.close();
  });
});

describe("POST /admin/ganadores/:id/pagar", () => {
  it("200 marca ganador como pagado", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({
      method: "POST",
      url: "/admin/ganadores/1/pagar",
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).pagado).toBe(true);
    await app.close();
  });
});
