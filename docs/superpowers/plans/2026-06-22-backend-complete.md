# Backend Completo — Gestión de Sorteos + Orquestación — Plan (Ciclo 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar endpoints de gestión de sorteos (CRUD + resultados + admin pago), el 4º worker `lifecycle-verifier` (ABIERTO→CERRADO), y el `orchestrator` que arranca los 4 workers en paralelo. Refactor `buildWorkerDeps` en cada worker.

**Architecture:** Capa de composición pura en el backend: `routes/sorteos.ts` (HTTP) + `services/sorteos.ts` extendido (DB ops) + `workers/lifecycle-verifier.ts` + `orchestrator.ts`. Sin paquetes nuevos (dominio completo en `packages/*`). TDD estricto, un commit por tarea.

**Tech Stack:** TypeScript 5 estricto, Drizzle ORM, Fastify, Zod, Vitest. Reusa todo lo construido en Ciclos 1-6.

**Spec de referencia:** `docs/superpowers/specs/2026-06-21-backend-complete-design.md`

---

## File Structure

```
apps/backend/src/
├── routes/
│   └── sorteos.ts                # NUEVO: POST /admin/sorteos, GET /sorteos/*, GET /jackpot, POST /admin/ganadores/:id/pagar
├── services/
│   └── sorteos.ts                # EXTENDIDO: +createSorteo, getSorteoById, getSorteoAbierto, getGanadores, cerrarVencidos, markPagado
├── workers/
│   ├── lifecycle-verifier.ts     # NUEVO: ABIERTO→CERRADO
│   ├── payment-verifier.ts       # MODIFICADO: extraer buildWorkerDeps
│   ├── draw-verifier.ts          # MODIFICADO: extraer buildWorkerDeps
│   └── scrutiny-verifier.ts      # MODIFICADO: extraer buildWorkerDeps
└── orchestrator.ts               # NUEVO: 4 workers en paralelo
```

**Modifica:**
- `packages/config/src/env.ts` — `DURACION_SORTEO_BLOQUES` + `LIFECYCLE_CHECK_INTERVAL_MS`.
- `packages/config/test/env.test.ts` — tests nuevos.
- `apps/backend/src/server.ts` — registrar `/sorteos` y `/jackpot`.
- `apps/backend/src/routes/tickets.ts` — consolidar `getActiveSorteo` → `getSorteoAbierto`.
- `apps/backend/package.json` — scripts `worker:lifecycle` + `workers`.
- `apps/backend/test/*.test.ts` — mocks de env actualizados.
- `.env.example`.

---

## Task 1: Variables de entorno (TDD)

**Objetivo:** `DURACION_SORTEO_BLOQUES` + `LIFECYCLE_CHECK_INTERVAL_MS`.

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/test/env.test.ts`
- Modify: `.env.example`
- Modify: `apps/backend/test/health.test.ts`, `apps/backend/test/routes-tickets.test.ts`

- [ ] **Step 1: Añadir tests que FALLARÁN en `packages/config/test/env.test.ts`**

Dentro de `describe("loadEnv")`, antes del cierre:

```typescript
  it("acepta DURACION_SORTEO_BLOQUES custom", () => {
    const env = loadEnv({ ...valid, DURACION_SORTEO_BLOQUES: "288" });
    expect(env.DURACION_SORTEO_BLOQUES).toBe(288);
  });

  it("aplica default DURACION_SORTEO_BLOQUES = 144", () => {
    const env = loadEnv({ ...valid });
    expect(env.DURACION_SORTEO_BLOQUES).toBe(144);
  });

  it("acepta LIFECYCLE_CHECK_INTERVAL_MS custom", () => {
    const env = loadEnv({ ...valid, LIFECYCLE_CHECK_INTERVAL_MS: "30000" });
    expect(env.LIFECYCLE_CHECK_INTERVAL_MS).toBe(30000);
  });

  it("aplica default LIFECYCLE_CHECK_INTERVAL_MS = 60000", () => {
    const env = loadEnv({ ...valid });
    expect(env.LIFECYCLE_CHECK_INTERVAL_MS).toBe(60000);
  });
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/config test`
Expected: FAIL — referencian vars que no existen.

- [ ] **Step 3: Añadir a `packages/config/src/env.ts`**

Después del bloque `SCRUTINY_CHECK_INTERVAL_MS`, antes del cierre del `z.object`:

```typescript
  // --- Gestión de sorteos (Ciclo 7) ---
  DURACION_SORTEO_BLOQUES: z.coerce.number().int().positive().default(144),
  LIFECYCLE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
```

- [ ] **Step 4: Añadir a `.env.example`**

Después del bloque de scrutiny:

```bash
# --- Gestión de sorteos (Ciclo 7) ---
DURACION_SORTEO_BLOQUES=144
LIFECYCLE_CHECK_INTERVAL_MS=60000
```

- [ ] **Step 5: Actualizar mocks de env en tests del backend**

En `apps/backend/test/health.test.ts` y `apps/backend/test/routes-tickets.test.ts`, después de `SCRUTINY_CHECK_INTERVAL_MS: 60000,` añadir:

```typescript
      DURACION_SORTEO_BLOQUES: 144,
      LIFECYCLE_CHECK_INTERVAL_MS: 60000,
```

- [ ] **Step 6: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/config test`
Expected: 4 nuevos + existentes PASS.

Run: `pnpm --filter @myloto/backend test`
Expected: 41 PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/config .env.example apps/backend/test
git commit -m "feat(config): DURACION_SORTEO_BLOQUES + LIFECYCLE_CHECK_INTERVAL_MS (Ciclo 7)"
```

---

## Task 2: `services/sorteos.ts` extendido (TDD)

**Objetivo:** Nuevas DB ops: createSorteo, getSorteoById, getSorteoAbierto, getGanadores, cerrarVencidos, markPagado.

**Files:**
- Modify: `apps/backend/test/services-sorteos.test.ts`
- Modify: `apps/backend/src/services/sorteos.ts`
- Modify: `apps/backend/src/services/tickets.ts` (consolidar getActiveSorteo → getSorteoAbierto)
- Modify: `apps/backend/src/routes/tickets.ts` (actualizar import)

- [ ] **Step 1: Añadir tests que FALLARÁN en `apps/backend/test/services-sorteos.test.ts`**

Añadir al final del `describe` existente:

```typescript
  it("createSorteo inserta con estado ABIERTO", async () => {
    const db = mockDb({
      insertValuesReturning: vi.fn().mockResolvedValue([
        { id: 1, bloqueCierre: 200, estado: "ABIERTO" },
      ]),
    });
    const result = await createSorteo(db, 200);
    expect(result.id).toBe(1);
    expect(result.estado).toBe("ABIERTO");
  });

  it("getSorteoById devuelve la fila o null", async () => {
    const db = mockDb({
      selectWhere: vi.fn().mockResolvedValue([{ id: 5, estado: "ABIERTO" }]),
    });
    expect((await getSorteoById(db, 5))?.id).toBe(5);
  });

  it("getSorteoAbierto devuelve el único ABIERTO", async () => {
    const db = mockDb({
      selectWhere: vi.fn().mockResolvedValue([
        { id: 1, estado: "ABIERTO", bloqueCierre: 200 },
      ]),
    });
    const result = await getSorteoAbierto(db);
    expect(result?.id).toBe(1);
  });

  it("getGanadores devuelve lista de ganadores con ticket", async () => {
    const db = mockDb({
      selectWhere: vi.fn().mockResolvedValue([
        { id: 1n, ticketId: 10n, tier: 1, monto: "680", pagado: false },
      ]),
    });
    const result = await getGanadores(db, 1);
    expect(result).toHaveLength(1);
    expect(result[0]?.tier).toBe(1);
  });

  it("cerrarVencidos devuelve cuántos cerró", async () => {
    const db = mockDb({
      updateSetWhere: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    });
    const result = await cerrarVencidos(db, 200);
    expect(result).toBe(2);
  });

  it("markPagado actualiza pagado=true", async () => {
    const db = mockDb({
      updateSetWhere: vi.fn().mockResolvedValue([{ id: 1 }]),
    });
    const result = await markPagado(db, 1);
    expect(result).toBe(true);
  });
```

Añadir los imports al top del archivo:

```typescript
import {
  getActiveSorteo,
  getClosedSorteosReady,
  saveSorteoResult,
  markCalculated,
  createSorteo,
  getSorteoById,
  getSorteoAbierto,
  getGanadores,
  cerrarVencidos,
  markPagado,
} from "../src/services/sorteos.js";
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL — funciones nuevas no existen.

- [ ] **Step 3: Implementar las nuevas funciones en `apps/backend/src/services/sorteos.ts`**

Añadir al final del archivo (los imports de `ganadores`, `tickets` ya están disponibles vía `@myloto/db`):

```typescript
import { ganadores } from "@myloto/db";
import { count } from "drizzle-orm";
```

> Nota: estos imports van al top del archivo, junto a los imports existentes.

Añadir las funciones:

```typescript
/** Crea un nuevo sorteo con estado ABIERTO. */
export async function createSorteo(
  db: Database,
  bloqueCierre: number,
): Promise<Sorteo> {
  const [row] = await db
    .insert(sorteos)
    .values({
      bloqueCierre: BigInt(bloqueCierre),
      estado: "ABIERTO",
    })
    .returning();
  if (!row) throw new Error("createSorteo: INSERT no devolvió fila");
  return row;
}

/** Devuelve un sorteo por id completo. */
export async function getSorteoById(
  db: Database,
  id: number,
): Promise<Sorteo | null> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(eq(sorteos.id, BigInt(id)))
    .limit(1);
  return (rows[0] as Sorteo | undefined) ?? null;
}

/** Devuelve el sorteo ABIERTO único, o null. */
export async function getSorteoAbierto(db: Database): Promise<Sorteo | null> {
  return getActiveSorteo(db);
}

/** Devuelve los ganadores de un sorteo. */
export async function getGanadores(
  db: Database,
  sorteoId: number,
): Promise<Array<{ id: bigint; ticketId: bigint; tier: number; monto: string; pagado: boolean }>> {
  const rows = await db
    .select({
      id: ganadores.id,
      ticketId: ganadores.ticketId,
      tier: ganadores.tier,
      monto: ganadores.monto,
      pagado: ganadores.pagado,
    })
    .from(ganadores)
    .where(eq(ganadores.sorteoId, BigInt(sorteoId)));
  return rows;
}

/** Cierra sorteos ABIERTO cuyo bloque_cierre <= currentHeight. Devuelve cuántos cerró. */
export async function cerrarVencidos(
  db: Database,
  currentHeight: number,
): Promise<number> {
  const rows = await db
    .update(sorteos)
    .set({ estado: "CERRADO", cerradoEn: new Date() })
    .where(
      and(
        eq(sorteos.estado, "ABIERTO"),
        lte(sorteos.bloqueCierre, BigInt(currentHeight)),
      ),
    )
    .returning({ id: sorteos.id });
  return rows.length;
}

/** Marca un ganador como pagado. Devuelve true si actualizó, false si no existía. */
export async function markPagado(
  db: Database,
  ganadorId: number,
): Promise<boolean> {
  const rows = await db
    .update(ganadores)
    .set({ pagado: true })
    .where(eq(ganadores.id, BigInt(ganadorId)))
    .returning({ id: ganadores.id });
  return rows.length > 0;
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 6 nuevos + 41 existentes = 47 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): services/sorteos extendido (create, getById, getAbierto, getGanadores, cerrarVencidos, markPagado)"
```

> Nota sobre consolidación: `getSorteoAbierto` delega en `getActiveSorteo` (existente). No rompe `routes/tickets.ts` porque esa ruta sigue usando `getActiveSorteo` directamente. La consolidación es opcional — ambas coexisten sin problema.

---

## Task 3: `routes/sorteos.ts` — Endpoints HTTP (TDD)

**Objetivo:** CRUD + resultados + admin pago.

**Files:**
- Create: `apps/backend/test/routes-sorteos.test.ts`
- Create: `apps/backend/src/routes/sorteos.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
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
  return {
    db: {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 1, bloqueCierre: 200, estado: "ABIERTO" },
          ]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: 1, estado: "ABIERTO", bloqueCierre: 200 },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
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
    // altura(100) + DURACION(144) = 244
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
            where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
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
    expect(JSON.parse(res.body).saldo).toBe(1500);
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
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/routes/sorteos.js'".

- [ ] **Step 3: Implementar `apps/backend/src/routes/sorteos.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../dependencies.js";
import {
  createSorteo,
  getSorteoById,
  getSorteoAbierto,
  getGanadores,
  markPagado,
} from "../services/sorteos.js";
import { getJackpotBalance } from "../services/premios.js";

/** Registra los endpoints de gestión de sorteos y resultados. */
export function registerSorteoRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  // POST /admin/sorteos — Crear sorteo
  app.post("/admin/sorteos", async (_req, reply) => {
    const height = await deps.rpc.getBlockCount();
    const bloqueCierre = height + deps.env.DURACION_SORTEO_BLOQUES;
    const sorteo = await createSorteo(deps.db.db, bloqueCierre);
    reply.code(201);
    return {
      id: Number(sorteo.id),
      bloqueCierre: Number(sorteo.bloqueCierre),
      estado: sorteo.estado,
      creadoEn: sorteo.creadoEn,
    };
  });

  // GET /sorteos/abierto — Sorteo ABIERTO activo
  app.get("/sorteos/abierto", async (_req, reply) => {
    const sorteo = await getSorteoAbierto(deps.db.db);
    if (!sorteo) {
      reply.code(404);
      return { error: "no hay sorteo ABIERTO" };
    }
    return {
      id: Number(sorteo.id),
      bloqueCierre: Number(sorteo.bloqueCierre),
      estado: sorteo.estado,
      creadoEn: sorteo.creadoEn,
    };
  });

  // GET /sorteos/:id — Estado completo del sorteo
  app.get("/sorteos/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const sorteo = await getSorteoById(deps.db.db, id);
    if (!sorteo) {
      reply.code(404);
      return { error: "sorteo no encontrado" };
    }
    return {
      id: Number(sorteo.id),
      bloqueCierre: Number(sorteo.bloqueCierre),
      estado: sorteo.estado,
      combinacionGanadora: sorteo.combinacionGanadora,
      bloquesSemilla: sorteo.bloquesSemilla,
      creadoEn: sorteo.creadoEn,
      cerradoEn: sorteo.cerradoEn,
      calculadoEn: sorteo.calculadoEn,
    };
  });

  // GET /sorteos/:id/ganadores — Ganadores del sorteo
  app.get("/sorteos/:id/ganadores", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const ganadores = await getGanadores(deps.db.db, id);
    return ganadores.map((g) => ({
      id: Number(g.id),
      ticketId: Number(g.ticketId),
      tier: g.tier,
      monto: g.monto,
      pagado: g.pagado,
    }));
  });

  // GET /jackpot — Saldo del jackpot acumulado
  app.get("/jackpot", async (_req, _reply) => {
    const saldo = await getJackpotBalance(deps.db.db);
    return { saldo };
  });

  // POST /admin/ganadores/:id/pagar — Marcar premio pagado
  app.post("/admin/ganadores/:id/pagar", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const updated = await markPagado(deps.db.db, id);
    if (!updated) {
      reply.code(404);
      return { error: "ganador no encontrado" };
    }
    return { id, pagado: true };
  });
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 6 routes-sorteos + 47 existentes = 53 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): routes/sorteos CRUD + resultados + admin pago"
```

---

## Task 4: Worker `lifecycle-verifier` (TDD)

**Objetivo:** 4º worker (ABIERTO→CERRADO).

**Files:**
- Create: `apps/backend/test/worker-lifecycle-verifier.test.ts`
- Create: `apps/backend/src/workers/lifecycle-verifier.ts`
- Modify: `apps/backend/package.json` (script `worker:lifecycle`)

- [ ] **Step 1: Añadir script a `apps/backend/package.json`**

Después de `"worker:scrutiny"`:
```json
    "worker:lifecycle": "tsx src/workers/lifecycle-verifier.ts"
```

- [ ] **Step 2: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/lifecycle-verifier.js";
import type { Logger } from "@myloto/config";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function makeDeps(overrides: Partial<{
  blockCount: number;
  closed: number;
}> = {}) {
  return {
    getBlockCount: vi.fn().mockResolvedValue(overrides.blockCount ?? 200),
    cerrarVencidos: vi.fn().mockResolvedValue(overrides.closed ?? 0),
    logger,
  };
}

describe("runRound (lifecycle-verifier)", () => {
  it("cierra sorteos vencidos", async () => {
    const deps = makeDeps({ blockCount: 200, closed: 3 });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 3, closed: 3 });
    expect(deps.cerrarVencidos).toHaveBeenCalledWith(200);
  });

  it("sin vencidos → 0", async () => {
    const deps = makeDeps({ closed: 0 });
    expect(await runRound(deps)).toEqual({ checked: 0, closed: 0 });
  });

  it("error de RPC no mata el round", async () => {
    const deps = makeDeps();
    deps.getBlockCount = vi.fn().mockRejectedValue(new Error("rpc down"));
    await expect(runRound(deps)).rejects.toThrow("rpc down");
    // El runLoop exterior captura esto; runRound la propaga para que se loguee.
  });
});
```

- [ ] **Step 3: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/workers/lifecycle-verifier.js'".

- [ ] **Step 4: Implementar `apps/backend/src/workers/lifecycle-verifier.ts`**

```typescript
import { buildDeps } from "../dependencies.js";
import { cerrarVencidos } from "../services/sorteos.js";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface LifecycleWorkerDeps {
  getBlockCount: () => Promise<number>;
  cerrarVencidos: (currentHeight: number) => Promise<number>;
  logger: Logger;
}

/** Una ronda del worker. Exportada para tests. */
export async function runRound(
  deps: LifecycleWorkerDeps,
): Promise<{ checked: number; closed: number }> {
  const height = await deps.getBlockCount();
  const closed = await deps.cerrarVencidos(height);
  if (closed > 0) {
    deps.logger.info("sorteos cerrados", { count: closed });
  }
  return { checked: closed, closed };
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: LifecycleWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("lifecycle-verifier recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("lifecycle-verifier detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda lifecycle completa", stats);
    } catch (err) {
      deps.logger.error("ronda lifecycle falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

export function buildLifecycleDeps(deps: ReturnType<typeof buildDeps>): LifecycleWorkerDeps {
  return {
    getBlockCount: () => deps.rpc.getBlockCount(),
    cerrarVencidos: (height) => cerrarVencidos(deps.db.db, height),
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps = buildLifecycleDeps(deps);
  deps.logger.info("arrancando lifecycle-verifier", {
    intervalMs: deps.env.LIFECYCLE_CHECK_INTERVAL_MS,
  });
  runLoop(workerDeps, deps.env.LIFECYCLE_CHECK_INTERVAL_MS);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 3 lifecycle + 53 existentes = 56 PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): worker lifecycle-verifier (ABIERTO→CERRADO) + buildLifecycleDeps"
```

---

## Task 5: Refactor `buildWorkerDeps` en los 3 workers existentes

**Objetivo:** Extraer la construcción de WorkerDeps para reutilizar en el orquestador.

**Files:**
- Modify: `apps/backend/src/workers/payment-verifier.ts`
- Modify: `apps/backend/src/workers/draw-verifier.ts`
- Modify: `apps/backend/src/workers/scrutiny-verifier.ts`

- [ ] **Step 1: En `payment-verifier.ts`, extraer `buildWorkerDeps`**

Reemplazar el cuerpo de `main()` que construye `workerDeps` por una función exportada. La función `main()` queda:

```typescript
export function buildWorkerDeps(
  deps: ReturnType<typeof buildDeps>,
): WorkerDeps {
  const walletName = deps.env.FRACTAL_RPC_WALLET;
  const rpc =
    walletName === ""
      ? deps.rpc
      : new FractalRpcClient(
          new FractalTransport({
            url: deps.env.FRACTAL_RPC_URL,
            username: deps.env.FRACTAL_RPC_USER,
            password: deps.env.FRACTAL_RPC_PASSWORD,
            timeoutMs: deps.env.FRACTAL_RPC_TIMEOUT_MS,
            walletName,
            logger: deps.logger,
          }),
        );

  return {
    getPendingTickets: () => getPendingTickets(deps.db.db),
    markActive: (id) => markActive(deps.db.db, id),
    getReceived: (addr, minconf) => rpc.getReceivedByAddress(addr, minconf),
    logger: deps.logger,
    minconf: deps.env.PAYMENT_MIN_CONFIRMATIONS,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  runLoop(buildWorkerDeps(deps), deps.env.PAYMENT_CHECK_INTERVAL_MS);
}
```

- [ ] **Step 2: En `draw-verifier.ts`, extraer `buildDrawDeps`**

```typescript
export function buildDrawDeps(
  deps: ReturnType<typeof buildDeps>,
): DrawWorkerDeps {
  return {
    getBlockCount: () => deps.rpc.getBlockCount(),
    getReadySorteos: (height) => getClosedSorteosReady(deps.db.db, height),
    getBlockHash: (height) => deps.rpc.getBlockHash(height),
    saveResult: (id, comb, bloques) =>
      saveSorteoResult(deps.db.db, id, comb, bloques),
    markCalculated: (id) => markCalculated(deps.db.db, id),
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  runLoop(buildDrawDeps(deps), deps.env.DRAW_CHECK_INTERVAL_MS);
}
```

- [ ] **Step 3: En `scrutiny-verifier.ts`, extraer `buildScrutinyDeps`**

```typescript
export function buildScrutinyDeps(
  deps: ReturnType<typeof buildDeps>,
): ScrutinyWorkerDeps {
  return {
    getCalculatedSorteos: () => getCalculatedSorteos(deps.db.db),
    countActiveTickets: (id) => countActiveTickets(deps.db.db, id),
    getActiveTickets: (id) => getActiveTickets(deps.db.db, id),
    getJackpotBalance: () => getJackpotBalance(deps.db.db),
    setJackpotBalance: (amount) => setJackpotBalance(deps.db.db, amount),
    insertGanadores: (rows) => insertGanadores(deps.db.db, rows),
    markFinalizado: (id) => markFinalizado(deps.db.db, id),
    ticketPrice: deps.env.TICKET_PRICE_FB,
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  runLoop(buildScrutinyDeps(deps), deps.env.SCRUTINY_CHECK_INTERVAL_MS);
}
```

> Nota: los imports de cada worker ya están presentes (cada worker importa las funciones de services que usa). El refactor solo mueve el código existente de `main()` a una función exportada.

- [ ] **Step 4: Verificar typecheck y tests**

Run: `pnpm --filter @myloto/backend typecheck`
Expected: exit 0.

Run: `pnpm --filter @myloto/backend test`
Expected: 56 PASS (sin cambios — el refactor no altera comportamiento).

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "refactor(backend): extraer buildWorkerDeps/buildDrawDeps/buildScrutinyDeps para orquestador"
```

---

## Task 6: Orquestador + wire-up servidor

**Objetivo:** `orchestrator.ts` + registrar `/sorteos` en servidor.

**Files:**
- Create: `apps/backend/src/orchestrator.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `apps/backend/package.json` (script `workers`)

- [ ] **Step 1: Crear `apps/backend/src/orchestrator.ts`**

```typescript
import { buildDeps } from "./dependencies.js";
import { runLoop as lifecycleLoop, buildLifecycleDeps } from "./workers/lifecycle-verifier.js";
import { runLoop as paymentLoop, buildWorkerDeps as buildPaymentDeps } from "./workers/payment-verifier.js";
import { runLoop as drawLoop, buildDrawDeps } from "./workers/draw-verifier.js";
import { runLoop as scrutinyLoop, buildScrutinyDeps } from "./workers/scrutiny-verifier.js";

async function main(): Promise<void> {
  const deps = buildDeps();

  // Construir los WorkerDeps de cada worker
  const lifecycleDeps = buildLifecycleDeps(deps);
  const paymentDeps = buildPaymentDeps(deps);
  const drawDeps = buildDrawDeps(deps);
  const scrutinyDeps = buildScrutinyDeps(deps);

  // Arrancar los 4 loops en paralelo (cada uno es infinito)
  lifecycleLoop(lifecycleDeps, deps.env.LIFECYCLE_CHECK_INTERVAL_MS);
  paymentLoop(paymentDeps, deps.env.PAYMENT_CHECK_INTERVAL_MS);
  drawLoop(drawDeps, deps.env.DRAW_CHECK_INTERVAL_MS);
  scrutinyLoop(scrutinyDeps, deps.env.SCRUTINY_CHECK_INTERVAL_MS);

  deps.logger.info("orchestrator arrancado: 4 workers en paralelo", {
    lifecycle: deps.env.LIFECYCLE_CHECK_INTERVAL_MS,
    payment: deps.env.PAYMENT_CHECK_INTERVAL_MS,
    draw: deps.env.DRAW_CHECK_INTERVAL_MS,
    scrutiny: deps.env.SCRUTINY_CHECK_INTERVAL_MS,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Modificar `apps/backend/src/server.ts`**

Añadir import y registro:

```typescript
import { registerSorteoRoutes } from "./routes/sorteos.js";
```

Después de `registerTicketRoutes(app, deps);`:

```typescript
  registerSorteoRoutes(app, deps);
```

- [ ] **Step 3: Añadir script `workers` a `apps/backend/package.json`**

Después de `"worker:lifecycle"`:

```json
    "workers": "tsx src/orchestrator.ts"
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @myloto/backend typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): orchestrator (4 workers en paralelo) + wire-up /sorteos en servidor"
```

---

## Task 7: Verificación global

**Objetivo:** Confirmar workspace verde.

- [ ] **Step 1: Typecheck global**

Run: `pnpm -r typecheck`
Expected: todos los paquetes Done, exit 0.

- [ ] **Step 2: Tests unitarios globales**

Run: `pnpm -r test`
Expected: todo verde (backend 56 + el resto sin cambios).

- [ ] **Step 3: Confirmar orquestador importa sin error**

Run: `cd apps/backend && npx tsx -e "import('./src/orchestrator.js').then(() => console.log('OK')).catch(e => { console.error(e); process.exit(1); })"`
Expected: "OK" (el import funciona; el main() se ejecuta pero como process.argv[1] no coincide, no arranca el loop).

> Si el one-liner ESM falla, alternativa: verificar que `tsx src/orchestrator.ts` arranca y muestra "orchestrator arrancado" antes de Ctrl-C.

Entregables verificados (spec §10):
1. ✅ `pnpm install` sin errores
2. ✅ `pnpm --filter @myloto/backend typecheck` exit 0
3. ✅ `pnpm --filter @myloto/backend test` todo verde (56)
4. ✅ `pnpm -r test` todo verde
5. ✅ `pnpm -r typecheck` todo verde
6. ✅ GET /sorteos/abierto funciona (test de ruta)
7. ✅ POST /admin/sorteos crea sorteo (test de ruta)
8. ✅ Worker lifecycle cierra sorteos (test de worker)
9. ✅ Orquestador importa sin error
10. ⏳ Demo E2E — pendiente IBD

---

## Self-Review del Plan

### Especificación cubierta

| Sección del spec | Tarea que lo implementa |
|---|---|
| §4.1 POST /admin/sorteos | Task 3 |
| §4.2 GET /sorteos/abierto | Task 3 |
| §4.3 GET /sorteos/:id | Task 3 |
| §4.4 GET /sorteos/:id/ganadores | Task 3 |
| §4.5 GET /jackpot | Task 3 |
| §4.6 POST /admin/ganadores/:id/pagar | Task 3 |
| §5.1 services/sorteos.ts extendido | Task 2 |
| §6 worker lifecycle-verifier | Task 4 |
| §7.1 refactor buildWorkerDeps | Task 5 |
| §7.2 orchestrator.ts | Task 6 |
| §8 config (DURACION_SORTEO_BLOQUES, LIFECYCLE_CHECK_INTERVAL_MS) | Task 1 |
| §9 Tests | Tasks 2, 3, 4 |
| Wire-up servidor (/sorteos) | Task 6 |

Todas las secciones del spec tienen al menos una tarea. ✓

### Placeholder scan

- Task 5 Steps 1-3 muestran el código del refactor completo para cada worker. Sin "similar a Task N". ✓
- Sin "TBD", "implement later", ni "add appropriate error handling". ✓

### Type consistency

- `createSorteo(db, bloqueCierre: number): Promise<Sorteo>` — Task 2, usado en Task 3. ✓
- `getSorteoById(db, id: number): Promise<Sorteo | null>` — Task 2, usado en Task 3. ✓
- `getSorteoAbierto(db): Promise<Sorteo | null>` — Task 2, usado en Task 3. ✓
- `getGanadores(db, sorteoId): Promise<Array<...>>` — Task 2, usado en Task 3. ✓
- `cerrarVencidos(db, currentHeight): Promise<number>` — Task 2, usado en Task 4. ✓
- `markPagado(db, ganadorId): Promise<boolean>` — Task 2, usado en Task 3. ✓
- `LifecycleWorkerDeps` interfaz — Task 4 (consistente entre impl y test). ✓
- `buildWorkerDeps` / `buildDrawDeps` / `buildScrutinyDeps` / `buildLifecycleDeps` — Tasks 4, 5, usados en Task 6. ✓
- `DURACION_SORTEO_BLOQUES`, `LIFECYCLE_CHECK_INTERVAL_MS` — Task 1, usados en Tasks 3, 4, 6. ✓

Sin inconsistencias. ✓
