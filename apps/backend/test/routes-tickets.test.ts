import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { registerTicketRoutes } from "../src/routes/tickets.js";
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

function mockDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const db = {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: 1, estado: "ABIERTO", bloqueCierre: 100 },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              sorteoId: 1,
              status: "PENDIENTE",
              expectedAmount: "100",
              paymentAddress: "PLACEHOLDER",
            },
          ]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      }),
    },
    pool: { end: vi.fn() },
  } as unknown as DbHandle;
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
      UNISAT_API_KEY: "k",
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
    },
    logger,
    db,
    rpc: {} as unknown as FractalRpcClient,
    wallet: {
      deriveAddress: vi.fn().mockReturnValue({
        address: VALID_TAPROOT_ADDR,
        path: "m/86'/0'/0'/0/1",
      }),
    } as unknown as HdWallet,
    unisat: { getBrc20Balance: vi.fn() } as unknown as UnisatClient,
    ...overrides,
  };
}

async function buildApp(deps: AppDeps) {
  const app = Fastify();
  registerTicketRoutes(app, deps);
  await app.ready();
  return app;
}

const validBody = { n1: 1, n2: 2, n3: 3, n4: 4, n5: 5, powerball: 6 };

// Dirección Taproot BIP86 idx 0 (vector oficial). buildBip21Uri valida que
// sea bech32m bc1p válida, así que el mock del wallet debe devolver una real.
const VALID_TAPROOT_ADDR =
  "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";

describe("POST /tickets", () => {
  it("201 con body válido (sin brc20Address → precio completo)", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({
      method: "POST",
      url: "/tickets",
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(1);
    expect(body.status).toBe("PENDIENTE");
    expect(body.expectedAmount).toBe(100);
    expect(body.paymentAddress).toBe(VALID_TAPROOT_ADDR);
    expect(body.bip21Uri).toContain(VALID_TAPROOT_ADDR);
    expect(body.qrSvg).toContain("<svg");
    await app.close();
  });

  it("400 si balotas fuera de rango", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({
      method: "POST",
      url: "/tickets",
      payload: { ...validBody, n5: 200 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("400 si balotas no ordenadas", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({
      method: "POST",
      url: "/tickets",
      payload: { n1: 5, n2: 4, n3: 3, n4: 2, n5: 1, powerball: 6 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("409 si no hay sorteo ABIERTO", async () => {
    const db = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({
      method: "POST",
      url: "/tickets",
      payload: validBody,
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });
});

describe("GET /tickets/:id", () => {
  it("200 si el ticket existe", async () => {
    const db = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 7,
                  sorteoId: 1,
                  status: "ACTIVO",
                  expectedAmount: "100",
                  paymentAddress: "bc1q...",
                  n1: 1,
                  n2: 2,
                  n3: 3,
                  n4: 4,
                  n5: 5,
                  powerball: 6,
                  userReturnAddress: null,
                  recibidoEn: null,
                },
              ]),
            }),
          }),
        }),
      },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "GET", url: "/tickets/7" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(7);
    await app.close();
  });

  it("404 si no existe", async () => {
    const db = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "GET", url: "/tickets/999" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
