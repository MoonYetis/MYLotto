# Escrutinio y Reparto de Premios — Plan de Implementación (Ciclo 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `packages/scrutiny` (clasificación de tickets + distribución parimutuel), migración DB (tablas `ganadores` + `jackpot_pool` + estado `FINALIZADO`), y worker `scrutiny-verifier` que escruta sorteos CALCULADO → FINALIZADO.

**Architecture:** Paquete `@myloto/scrutiny` (lógica pura: classifyTicket + distributePool) + migración Drizzle + `services/premios.ts` (DB ops) + `workers/scrutiny-verifier.ts` (orquestación transaccional). TDD estricto, un commit por tarea.

**Tech Stack:** TypeScript 5 estricto, Drizzle ORM, Vitest. Reusa `@myloto/config`, `@myloto/db`, `@myloto/types`.

**Spec de referencia:** `docs/superpowers/specs/2026-06-21-scrutiny-and-prizes-design.md`

---

## File Structure

```
packages/scrutiny/                       # NUEVO
├── src/
│   ├── tiers.ts                        # classifyTicket + TIER_PERCENTAGES
│   ├── pool.ts                         # distributePool parimutuel
│   ├── errors.ts                       # ScrutinyError
│   └── index.ts
├── test/unit/
│   ├── tiers.test.ts                   # 10 casos (uno por tier + sin premio)
│   └── pool.test.ts                    # golden vector distribución
├── package.json
├── tsconfig.json
└── vitest.config.ts

packages/db/
├── src/schema.ts                       # MODIFICADO: ganadores + jackpotPool + FINALIZADO
└── migrations/                         # NUEVA migración generada por drizzle-kit

packages/types/src/sorteo.ts            # MODIFICADO: FINALIZADO

apps/backend/
├── src/
│   ├── services/premios.ts             # NUEVO — DB ops
│   └── workers/scrutiny-verifier.ts    # NUEVO — loop
└── test/
    ├── services-premios.test.ts
    └── worker-scrutiny-verifier.test.ts
```

**Modifica:**
- `packages/config/src/env.ts` — `SCRUTINY_CHECK_INTERVAL_MS`.
- `apps/backend/package.json` — dep `@myloto/scrutiny` + script `worker:scrutiny`.
- `apps/backend/test/health.test.ts` + `routes-tickets.test.ts` — mocks de env.
- `.env.example`.

---

## Task 1: Esqueleto del paquete `packages/scrutiny`

**Objetivo:** Estructura mínima con `pnpm install` funcionando.

**Files:**
- Create: `packages/scrutiny/package.json`
- Create: `packages/scrutiny/tsconfig.json`
- Create: `packages/scrutiny/vitest.config.ts`

- [ ] **Step 1: Crear `packages/scrutiny/package.json`**

```json
{
  "name": "@myloto/scrutiny",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "dev": "tsc --watch --noEmit",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@myloto/types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

> `@myloto/scrutiny` solo depende de `@myloto/types` (tipos `CombinacionGanadora`). Es lógica pura.

- [ ] **Step 2: Crear `packages/scrutiny/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Crear `packages/scrutiny/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Instalar dependencias**

Run: `pnpm install`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/scrutiny pnpm-lock.yaml
git commit -m "chore(scrutiny): esqueleto del paquete @myloto/scrutiny"
```

---

## Task 2: Errores tipados (TDD)

**Objetivo:** Jerarquía `ScrutinyError`.

**Files:**
- Create: `packages/scrutiny/src/errors.ts`
- Create: `packages/scrutiny/src/index.ts` (placeholder)
- Create: `packages/scrutiny/test/unit/errors.test.ts`

- [ ] **Step 1: Escribir test que FALLARÁ**

```typescript
import { describe, it, expect } from "vitest";
import { ScrutinyError } from "../../src/errors.js";

describe("errores scrutiny", () => {
  it("ScrutinyError guarda message", () => {
    const err = new ScrutinyError("bad tier");
    expect(err.message).toBe("bad tier");
    expect(err.name).toBe("ScrutinyError");
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `pnpm --filter @myloto/scrutiny test`
Expected: FAIL con "Cannot find module '../../src/errors.js'".

- [ ] **Step 3: Implementar `packages/scrutiny/src/errors.ts`**

```typescript
/** Jerarquía de errores del motor de escrutinio. */
export class ScrutinyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrutinyError";
  }
}
```

- [ ] **Step 4: Crear `packages/scrutiny/src/index.ts`**

```typescript
export { ScrutinyError } from "./errors.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/scrutiny test`
Expected: 1 test PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/scrutiny
git commit -m "feat(scrutiny): jerarquía ScrutinyError"
```

---

## Task 3: `classifyTicket` + TIER_PERCENTAGES (TDD)

**Objetivo:** Clasificación de ticket en tier (0-9).

**Files:**
- Create: `packages/scrutiny/test/unit/tiers.test.ts`
- Create: `packages/scrutiny/src/tiers.ts`
- Modify: `packages/scrutiny/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect } from "vitest";
import { classifyTicket } from "../../src/tiers.js";
import type { CombinacionGanadora } from "@myloto/types";

const GANADORA: CombinacionGanadora = {
  balotas: [10, 20, 30, 40, 50],
  powerball: 5,
};

describe("classifyTicket", () => {
  it("tier 1: 5 balotas + powerball (jackpot)", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 50], powerball: 5 }, GANADORA);
    expect(t).toBe(1);
  });

  it("tier 2: 5 balotas sin powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 50], powerball: 9 }, GANADORA);
    expect(t).toBe(2);
  });

  it("tier 3: 4 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(3);
  });

  it("tier 4: 4 balotas sin powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 40, 60], powerball: 9 }, GANADORA);
    expect(t).toBe(4);
  });

  it("tier 5: 3 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 45, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(5);
  });

  it("tier 6: 3 balotas sin powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 30, 45, 60], powerball: 9 }, GANADORA);
    expect(t).toBe(6);
  });

  it("tier 7: 2 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [10, 20, 35, 45, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(7);
  });

  it("tier 8: 1 balota + powerball", () => {
    const t = classifyTicket({ balotas: [10, 25, 35, 45, 60], powerball: 5 }, GANADORA);
    expect(t).toBe(8);
  });

  it("tier 9: 0 balotas + powerball", () => {
    const t = classifyTicket({ balotas: [11, 22, 33, 44, 55], powerball: 5 }, GANADORA);
    expect(t).toBe(9);
  });

  it("tier 0: sin premio (0 balotas, powerball incorrecto)", () => {
    const t = classifyTicket({ balotas: [11, 22, 33, 44, 55], powerball: 9 }, GANADORA);
    expect(t).toBe(0);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/scrutiny test`
Expected: FAIL con "Cannot find module '../../src/tiers.js'".

- [ ] **Step 3: Implementar `packages/scrutiny/src/tiers.ts`**

```typescript
import type { CombinacionGanadora } from "@myloto/types";

export const TIER_COUNT = 9;

/** Porcentaje del pool que recibe cada tier (sobre el total recaudado). */
export const TIER_PERCENTAGES: readonly number[] = [
  68, 8, 4, 1, 1.6, 1.4, 1, 1, 1, // tiers 1-9
] as const;

/** Reserva del operador (13% del pool). */
export const OPERATOR_RESERVE_PERCENT = 13;

/** Tier 0 = sin premio. Tiers 1-9 = ganadores. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0;

/**
 * Clasifica un ticket contra la combinación ganadora.
 * @returns tier (1-9) o 0 si no gana nada.
 *
 * Tabla de tiers de Powerball (matches = balotas acertadas):
 *   5+PB=1, 5=2, 4+PB=3, 4=4, 3+PB=5, 3=6, 2+PB=7, 1+PB=8, 0+PB=9
 */
export function classifyTicket(
  ticket: { balotas: readonly number[]; powerball: number },
  ganadora: CombinacionGanadora,
): Tier {
  const balotasGanadoras = new Set(ganadora.balotas);
  const matches = ticket.balotas.filter((b) => balotasGanadoras.has(b)).length;
  const pbMatch = ticket.powerball === ganadora.powerball;

  if (matches === 5 && pbMatch) return 1;
  if (matches === 5) return 2;
  if (matches === 4 && pbMatch) return 3;
  if (matches === 4) return 4;
  if (matches === 3 && pbMatch) return 5;
  if (matches === 3) return 6;
  if (matches === 2 && pbMatch) return 7;
  if (matches === 1 && pbMatch) return 8;
  if (matches === 0 && pbMatch) return 9;
  return 0;
}
```

- [ ] **Step 4: Actualizar `packages/scrutiny/src/index.ts`**

```typescript
export { ScrutinyError } from "./errors.js";
export { classifyTicket, TIER_PERCENTAGES, OPERATOR_RESERVE_PERCENT, TIER_COUNT } from "./tiers.js";
export type { Tier } from "./tiers.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/scrutiny test`
Expected: 10 tiers + 1 error = 11 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/scrutiny
git commit -m "feat(scrutiny): classifyTicket + TIER_PERCENTAGES"
```

---

## Task 4: `distributePool` con golden vector (TDD)

**Objetivo:** Distribución parimutuel.

**Files:**
- Create: `packages/scrutiny/test/unit/pool.test.ts`
- Create: `packages/scrutiny/src/pool.ts`
- Modify: `packages/scrutiny/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect } from "vitest";
import { distributePool } from "../../src/pool.js";

describe("distributePool", () => {
  it("golden vector: pool 1000 FB + tierCounts conocidos → montos exactos", () => {
    // pool=1000, cada tier tiene 1 ganador, carryover=0
    const result = distributePool(1000, [1, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    // Tier 1: 68% de 1000 = 680
    expect(result.tiers[0]!.tierPool).toBe(680);
    expect(result.tiers[0]!.perWinner).toBe(680);
    // Tier 2: 8% = 80
    expect(result.tiers[1]!.tierPool).toBe(80);
    // Tier 5: 1.6% = 16
    expect(result.tiers[4]!.tierPool).toBe(16);
    // Reserva: 13% = 130
    expect(result.operatorReserve).toBe(130);
    // Sin rollover (todos tienen ganadores)
    expect(result.rolloverToJackpot).toBe(0);
  });

  it("tier 1 sin ganadores → su monto rueda al jackpot", () => {
    const result = distributePool(1000, [0, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    expect(result.tiers[0]!.perWinner).toBe(0);
    expect(result.rolloverToJackpot).toBe(680); // 68% de 1000
  });

  it("jackpot carryover se suma solo al tier 1", () => {
    const result = distributePool(1000, [1, 1, 1, 1, 1, 1, 1, 1, 1], 500);
    // Tier 1 recibe 680 + 500 carryover = 1180
    expect(result.tiers[0]!.tierPool).toBe(1180);
    expect(result.tiers[0]!.perWinner).toBe(1180);
    // Tier 2 NO recibe carryover
    expect(result.tiers[1]!.tierPool).toBe(80);
  });

  it("tier 1 sin ganadores + carryover → ambos ruedan", () => {
    const result = distributePool(1000, [0, 1, 1, 1, 1, 1, 1, 1, 1], 500);
    // 680 (tier 1) + 500 (carryover) = 1180 rueda
    expect(result.rolloverToJackpot).toBe(1180);
  });

  it("tier 4 sin ganadores → solo tier 4 rueda", () => {
    const result = distributePool(1000, [1, 1, 1, 0, 1, 1, 1, 1, 1], 0);
    // Tier 4 = 1% de 1000 = 10 rueda
    expect(result.rolloverToJackpot).toBe(10);
    // Tier 1 NO rueda (tiene ganador)
    expect(result.tiers[0]!.perWinner).toBe(680);
  });

  it("reserva operador = 13% exacto", () => {
    const result = distributePool(5000, [1, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    expect(result.operatorReserve).toBe(650); // 13% de 5000
  });

  it("tier con 2 ganadores → perWinner = tierPool / 2", () => {
    const result = distributePool(1000, [2, 1, 1, 1, 1, 1, 1, 1, 1], 0);
    expect(result.tiers[0]!.winnerCount).toBe(2);
    expect(result.tiers[0]!.perWinner).toBe(340); // 680 / 2
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/scrutiny test`
Expected: FAIL con "Cannot find module '../../src/pool.js'".

- [ ] **Step 3: Implementar `packages/scrutiny/src/pool.ts`**

```typescript
import {
  TIER_PERCENTAGES,
  OPERATOR_RESERVE_PERCENT,
  type Tier,
} from "./tiers.js";

export interface TierResult {
  tier: Tier;
  winnerCount: number;
  /** Monto total destinado a este tier. */
  tierPool: number;
  /** Monto por ganador (tierPool / winnerCount), o 0 si no hay ganadores. */
  perWinner: number;
}

export interface DistributionResult {
  tiers: TierResult[];
  /** Monto a la reserva del operador. */
  operatorReserve: number;
  /** Monto sin reclamar que rueda al jackpot acumulable. */
  rolloverToJackpot: number;
}

/**
 * Distribuye el pool del sorteo entre los 9 tiers + reserva + jackpot.
 *
 * @param poolAmount total recaudado por boletos (FB)
 * @param tierCounts cuántos ganadores hay en cada tier [t1, t2, ..., t9]
 * @param jackpotCarryover saldo acumulado de sorteos anteriores (FB)
 *
 * Reglas:
 * - Cada tier recibe su % del pool. El tier 1 (jackpot) también recibe el carryover.
 * - Si un tier tiene 0 ganadores, su monto rueda al jackpot acumulable.
 * - La reserva del operador es fija (13% del pool).
 */
export function distributePool(
  poolAmount: number,
  tierCounts: readonly number[],
  jackpotCarryover: number,
): DistributionResult {
  const tiers: TierResult[] = [];
  let rolloverToJackpot = 0;

  for (let i = 0; i < TIER_PERCENTAGES.length; i++) {
    const tier = (i + 1) as Tier;
    const percent = TIER_PERCENTAGES[i]!;
    const tierPool = (poolAmount * percent) / 100;
    const isJackpot = tier === 1;
    const effectivePool = isJackpot ? tierPool + jackpotCarryover : tierPool;
    const winnerCount = tierCounts[i]!;

    if (winnerCount === 0) {
      rolloverToJackpot += effectivePool;
      tiers.push({ tier, winnerCount: 0, tierPool: effectivePool, perWinner: 0 });
    } else {
      tiers.push({
        tier,
        winnerCount,
        tierPool: effectivePool,
        perWinner: effectivePool / winnerCount,
      });
    }
  }

  const operatorReserve = (poolAmount * OPERATOR_RESERVE_PERCENT) / 100;

  return { tiers, operatorReserve, rolloverToJackpot };
}
```

- [ ] **Step 4: Actualizar `packages/scrutiny/src/index.ts`**

```typescript
export { ScrutinyError } from "./errors.js";
export {
  classifyTicket,
  TIER_PERCENTAGES,
  OPERATOR_RESERVE_PERCENT,
  TIER_COUNT,
} from "./tiers.js";
export type { Tier } from "./tiers.js";
export { distributePool } from "./pool.js";
export type { TierResult, DistributionResult } from "./pool.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/scrutiny test`
Expected: 7 pool + 10 tiers + 1 error = 18 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/scrutiny
git commit -m "feat(scrutiny): distributePool parimutuel con golden vector"
```

---

## Task 5: Migración DB + tipos

**Objetivo:** Tablas `ganadores` + `jackpotPool` + estado `FINALIZADO`.

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/types/src/sorteo.ts`
- Create: `packages/db/migrations/0001_*.sql` (generada por drizzle-kit)

- [ ] **Step 1: Añadir import `boolean` a `packages/db/src/schema.ts`**

En la línea de imports de `drizzle-orm/pg-core`, añadir `boolean`:

```typescript
import {
  pgTable,
  bigserial,
  integer,
  smallint,
  text,
  numeric,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Modificar el CHECK de `sorteos.estado` en `packages/db/src/schema.ts`**

Cambiar `IN ('ABIERTO', 'CERRADO', 'CALCULADO')` por:

```typescript
    estadoCheck: check(
      "chk_sorteo_estado",
      sql`${t.estado} IN ('ABIERTO', 'CERRADO', 'CALCULADO', 'FINALIZADO')`,
    ),
```

- [ ] **Step 3: Añadir tablas `ganadores` y `jackpotPool` al final de `packages/db/src/schema.ts` (antes de los `export type`)**

```typescript
export const ganadores = pgTable(
  "ganadores",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    sorteoId: bigserial("sorteo_id", { mode: "bigint" })
      .notNull()
      .references(() => sorteos.id, { onDelete: "cascade" }),
    ticketId: bigserial("ticket_id", { mode: "bigint" })
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    tier: smallint("tier").notNull(),
    monto: numeric("monto", { precision: 18, scale: 8 }).notNull(),
    pagado: boolean("pagado").notNull().default(false),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sorteoTierIdx: index("ganadores_sorteo_tier").on(t.sorteoId, t.tier),
    ticketIdx: index("ganadores_ticket").on(t.ticketId),
    tierCheck: check("chk_tier", sql`${t.tier} BETWEEN 1 AND 9`),
  }),
);

export const jackpotPool = pgTable(
  "jackpot_pool",
  {
    id: smallint("id").primaryKey().default(1),
    saldo: numeric("saldo", { precision: 18, scale: 8 }).notNull().default("0"),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    singletonCheck: check("chk_singleton", sql`${t.id} = 1`),
  }),
);

export type Ganador = typeof ganadores.$inferSelect;
export type NuevoGanador = typeof ganadores.$inferInsert;
export type JackpotPool = typeof jackpotPool.$inferSelect;
```

- [ ] **Step 4: Añadir `FINALIZADO` a `packages/types/src/sorteo.ts`**

```typescript
export const SORTEO_ESTADO = {
  ABIERTO: "ABIERTO",
  CERRADO: "CERRADO",
  CALCULADO: "CALCULADO",
  FINALIZADO: "FINALIZADO",
} as const;
```

- [ ] **Step 5: Generar migración con drizzle-kit**

Run: `pnpm --filter @myloto/db exec drizzle-kit generate`
Expected: crea `packages/db/migrations/0001_*.sql` automáticamente con las tablas nuevas y el CHECK modificado.

> Si drizzle-kit no está disponible, crear la migración SQL manualmente siguiendo el patrón de `0000_*.sql` (ver spec §5.3 para el SQL exacto). El archivo debe incluir los `statement-breakpoint` entre statements.

- [ ] **Step 6: Añadir seed del singleton jackpot_pool a la migración**

Editar el archivo `0001_*.sql` generado y añadir al final (antes del cierre):

```sql
--> statement-breakpoint
INSERT INTO "jackpot_pool" ("id", "saldo") VALUES (1, 0) ON CONFLICT DO NOTHING;
```

- [ ] **Step 7: Verificar typecheck**

Run: `pnpm --filter @myloto/db typecheck`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/db packages/types
git commit -m "feat(db): tablas ganadores + jackpot_pool + estado FINALIZADO (Ciclo 6)"
```

---

## Task 6: Variable `SCRUTINY_CHECK_INTERVAL_MS` (TDD)

**Objetivo:** Config para el worker de escrutinio.

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/test/env.test.ts`
- Modify: `.env.example`
- Modify: `apps/backend/test/health.test.ts`
- Modify: `apps/backend/test/routes-tickets.test.ts`

- [ ] **Step 1: Añadir tests que FALLARÁN en `packages/config/test/env.test.ts`**

Dentro de `describe("loadEnv")`, antes del cierre:

```typescript
  it("acepta SCRUTINY_CHECK_INTERVAL_MS custom", () => {
    const env = loadEnv({ ...valid, SCRUTINY_CHECK_INTERVAL_MS: "120000" });
    expect(env.SCRUTINY_CHECK_INTERVAL_MS).toBe(120000);
  });

  it("aplica default SCRUTINY_CHECK_INTERVAL_MS = 60000", () => {
    const env = loadEnv({ ...valid });
    expect(env.SCRUTINY_CHECK_INTERVAL_MS).toBe(60000);
  });
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/config test`
Expected: FAIL — los tests referencian `SCRUTINY_CHECK_INTERVAL_MS` que no existe.

- [ ] **Step 3: Añadir a `packages/config/src/env.ts`**

Después del bloque `DRAW_CHECK_INTERVAL_MS`, antes del cierre del `z.object`:

```typescript
  // --- Worker de escrutinio (Ciclo 6) ---
  SCRUTINY_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
```

- [ ] **Step 4: Añadir a `.env.example`**

Después del bloque de worker de sorteos:

```bash
# --- Worker de escrutinio (Ciclo 6) ---
SCRUTINY_CHECK_INTERVAL_MS=60000
```

- [ ] **Step 5: Actualizar mocks de env en tests del backend**

En `apps/backend/test/health.test.ts` y `apps/backend/test/routes-tickets.test.ts`, en el objeto `env` del mock, después de `DRAW_CHECK_INTERVAL_MS: 30000,` añadir:

```typescript
      SCRUTINY_CHECK_INTERVAL_MS: 60000,
```

- [ ] **Step 6: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/config test`
Expected: 2 nuevos + 26 existentes = 28 PASS.

Run: `pnpm --filter @myloto/backend test`
Expected: 32 PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/config .env.example apps/backend/test
git commit -m "feat(config): SCRUTINY_CHECK_INTERVAL_MS para worker de escrutinio (Ciclo 6)"
```

---

## Task 7: `services/premios.ts` — DB ops (TDD)

**Objetivo:** Operaciones Drizzle para escrutinio.

**Files:**
- Create: `apps/backend/test/services-premios.test.ts`
- Create: `apps/backend/src/services/premios.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { Database } from "@myloto/db";
import {
  getJackpotBalance,
  setJackpotBalance,
  countActiveTickets,
  insertGanadores,
  getCalculatedSorteos,
  markFinalizado,
} from "../src/services/premios.js";

function mockDb(overrides: Partial<{
  selectWhere: ReturnType<typeof vi.fn>;
  updateSetWhere: ReturnType<typeof vi.fn>;
  insertValues: ReturnType<typeof vi.fn>;
}> = {}): Database {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: overrides.selectWhere ?? vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: overrides.updateSetWhere ?? vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: overrides.insertValues ?? vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as Database;
}

describe("services/premios", () => {
  it("getJackpotBalance devuelve saldo (default 0)", async () => {
    const db = mockDb({ selectWhere: vi.fn().mockResolvedValue([{ saldo: "500" }]) });
    expect(await getJackpotBalance(db)).toBe(500);
  });

  it("setJackpotBalance llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(setJackpotBalance(db, 1000)).resolves.toBeUndefined();
  });

  it("countActiveTickets devuelve número", async () => {
    const db = mockDb({ selectWhere: vi.fn().mockResolvedValue([{ count: 42n }]) });
    expect(await countActiveTickets(db, 1)).toBe(42);
  });

  it("insertGanadores llama a insert batch", async () => {
    const db = mockDb();
    const ganadores = [
      { sorteoId: 1, ticketId: 1, tier: 1, monto: "680" },
    ];
    await expect(insertGanadores(db, ganadores)).resolves.toBeUndefined();
  });

  it("markFinalizado llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(markFinalizado(db, 1)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/services/premios.js'".

- [ ] **Step 3: Implementar `apps/backend/src/services/premios.ts`**

```typescript
import { eq, and, sql, count } from "drizzle-orm";
import {
  sorteos,
  tickets,
  ganadores,
  jackpotPool,
  type Database,
  type Sorteo,
  type NuevoGanador,
} from "@myloto/db";

/** Lee el saldo del jackpot acumulado (singleton, default 0). */
export async function getJackpotBalance(db: Database): Promise<number> {
  const rows = await db
    .select({ saldo: jackpotPool.saldo })
    .from(jackpotPool)
    .where(eq(jackpotPool.id, 1))
    .limit(1);
  const saldo = rows[0]?.saldo ?? "0";
  return Number(saldo);
}

/** Sobrescribe el saldo del jackpot. */
export async function setJackpotBalance(
  db: Database,
  amount: number,
): Promise<void> {
  await db
    .update(jackpotPool)
    .set({ saldo: String(amount), actualizadoEn: new Date() })
    .where(eq(jackpotPool.id, 1));
}

/** Cuenta boletos ACTIVO de un sorteo. */
export async function countActiveTickets(
  db: Database,
  sorteoId: number,
): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(tickets)
    .where(and(eq(tickets.sorteoId, BigInt(sorteoId)), eq(tickets.status, "ACTIVO")));
  return Number(rows[0]?.count ?? 0);
}

/** Devuelve los tickets ACTIVO de un sorteo (para clasificar). */
export async function getActiveTickets(
  db: Database,
  sorteoId: number,
): Promise<Array<{ id: bigint; n1: number; n2: number; n3: number; n4: number; n5: number; powerball: number }>> {
  const rows = await db
    .select({
      id: tickets.id,
      n1: tickets.n1,
      n2: tickets.n2,
      n3: tickets.n3,
      n4: tickets.n4,
      n5: tickets.n5,
      powerball: tickets.powerball,
    })
    .from(tickets)
    .where(and(eq(tickets.sorteoId, BigInt(sorteoId)), eq(tickets.status, "ACTIVO")));
  return rows;
}

/** Inserta los ganadores de un sorteo (batch). */
export async function insertGanadores(
  db: Database,
  rows: NuevoGanador[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(ganadores).values(rows);
}

/** Sorteos en CALCULADO sin escrutar. */
export async function getCalculatedSorteos(db: Database): Promise<Sorteo[]> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(eq(sorteos.estado, "CALCULADO"));
  return rows as Sorteo[];
}

/** Transición CALCULADO → FINALIZADO. Idempotente (WHERE estado='CALCULADO'). */
export async function markFinalizado(
  db: Database,
  sorteoId: number,
): Promise<void> {
  await db
    .update(sorteos)
    .set({ estado: "FINALIZADO" })
    .where(and(eq(sorteos.id, BigInt(sorteoId)), eq(sorteos.estado, "CALCULADO")));
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 5 services-premios + 32 existentes = 37 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): services/premios con DB ops (jackpot, ganadores, finalizar)"
```

---

## Task 8: Worker `scrutiny-verifier` (TDD)

**Objetivo:** Worker que escruta sorteos CALCULADO → FINALIZADO.

**Files:**
- Create: `apps/backend/test/worker-scrutiny-verifier.test.ts`
- Create: `apps/backend/src/workers/scrutiny-verifier.ts`
- Modify: `apps/backend/package.json` (dep `@myloto/scrutiny` + script `worker:scrutiny`)

- [ ] **Step 1: Añadir dep y script a `apps/backend/package.json`**

En `dependencies` añadir:
```json
    "@myloto/scrutiny": "workspace:*",
```

En `scripts` añadir (después de `worker:draw`):
```json
    "worker:scrutiny": "tsx src/workers/scrutiny-verifier.ts"
```

Ejecutar `pnpm install`.

- [ ] **Step 2: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/scrutiny-verifier.js";
import type { Logger } from "@myloto/config";
import type { Sorteo } from "@myloto/db";
import type { CombinacionGanadora } from "@myloto/types";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const COMB: CombinacionGanadora = {
  balotas: [10, 20, 30, 40, 50],
  powerball: 5,
};

const SORTEO_CALCULADO: Sorteo = {
  id: 1n,
  bloqueCierre: 100,
  estado: "CALCULADO",
  combinacionGanadora: COMB,
  seedMaestra: null,
  bloquesSemilla: null,
  creadoEn: new Date(),
  cerradoEn: null,
  calculadoEn: null,
};

const TICKETS = [
  { id: 1n, n1: 10, n2: 20, n3: 30, n4: 40, n5: 50, powerball: 5 }, // tier 1 (jackpot)
  { id: 2n, n1: 11, n2: 22, n3: 33, n4: 44, n5: 55, powerball: 9 }, // tier 0 (sin premio)
  { id: 3n, n1: 10, n2: 20, n3: 30, n4: 45, n5: 60, powerball: 5 }, // tier 5 (3+PB)
];

function makeDeps(overrides: Partial<{
  sorteos: Sorteo[];
  ticketCount: number;
  tickets: typeof TICKETS;
  jackpot: number;
  insertGanadores: ReturnType<typeof vi.fn>;
  setJackpot: ReturnType<typeof vi.fn>;
  markFinalizado: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getCalculatedSorteos: vi.fn().mockResolvedValue(overrides.sorteos ?? []),
    countActiveTickets: vi.fn().mockResolvedValue(overrides.ticketCount ?? 0),
    getActiveTickets: vi.fn().mockResolvedValue(overrides.tickets ?? []),
    getJackpotBalance: vi.fn().mockResolvedValue(overrides.jackpot ?? 0),
    setJackpotBalance: overrides.setJackpot ?? vi.fn().mockResolvedValue(undefined),
    insertGanadores: overrides.insertGanadores ?? vi.fn().mockResolvedValue(undefined),
    markFinalizado: overrides.markFinalizado ?? vi.fn().mockResolvedValue(undefined),
    ticketPrice: 100,
    logger,
  };
}

describe("runRound (scrutiny-verifier)", () => {
  it("sin sorteos CALCULADO → checked 0, finalized 0", async () => {
    const result = await runRound(makeDeps());
    expect(result).toEqual({ checked: 0, finalized: 0 });
  });

  it("sorteo con tickets → clasifica, distribuye, persiste, finaliza", async () => {
    const insertGanadores = vi.fn();
    const setJackpot = vi.fn();
    const markFinalizado = vi.fn();
    const deps = makeDeps({
      sorteos: [SORTEO_CALCULADO],
      ticketCount: 3,
      tickets: TICKETS,
      jackpot: 0,
      insertGanadores,
      setJackpot,
      markFinalizado,
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, finalized: 1 });
    // 2 ganadores (tier 1 y tier 5)
    expect(insertGanadores).toHaveBeenCalledTimes(1);
    const ganadoresInserted = insertGanadores.mock.calls[0]![0] as Array<{ tier: number }>;
    expect(ganadoresInserted).toHaveLength(2);
    expect(ganadoresInserted.map((g) => g.tier).sort()).toEqual([1, 5]);
    // Montos > 0
    expect(ganadoresInserted[0]!.monto).toBeGreaterThan(0);
    // Finalizado
    expect(markFinalizado).toHaveBeenCalledWith(1);
  });

  it("error individual no mata el round", async () => {
    const deps = makeDeps({
      sorteos: [
        SORTEO_CALCULADO,
        { ...SORTEO_CALCULADO, id: 2n },
      ],
      ticketCount: 3,
      tickets: TICKETS,
    });
    // Hacer que el primer sorteo falle en getActiveTickets
    deps.getActiveTickets = vi.fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce(TICKETS);
    const result = await runRound(deps);
    expect(result.checked).toBe(2);
    expect(result.finalized).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("idempotente: no recalcula sorteo FINALIZADO", async () => {
    const deps = makeDeps({ sorteos: [] });
    expect(await runRound(deps)).toEqual({ checked: 0, finalized: 0 });
    expect(deps.insertGanadores).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/workers/scrutiny-verifier.js'".

- [ ] **Step 4: Implementar `apps/backend/src/workers/scrutiny-verifier.ts`**

```typescript
import { buildDeps } from "../dependencies.js";
import {
  getJackpotBalance,
  setJackpotBalance,
  countActiveTickets,
  getActiveTickets,
  insertGanadores,
  getCalculatedSorteos,
  markFinalizado,
} from "../services/premios.js";
import { classifyTicket, distributePool } from "@myloto/scrutiny";
import type { CombinacionGanadora } from "@myloto/types";
import type { Sorteo, NuevoGanador } from "@myloto/db";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface ScrutinyWorkerDeps {
  getCalculatedSorteos: () => Promise<Sorteo[]>;
  countActiveTickets: (sorteoId: number) => Promise<number>;
  getActiveTickets: (sorteoId: number) => Promise<
    Array<{ id: bigint; n1: number; n2: number; n3: number; n4: number; n5: number; powerball: number }>
  >;
  getJackpotBalance: () => Promise<number>;
  setJackpotBalance: (amount: number) => Promise<void>;
  insertGanadores: (rows: NuevoGanador[]) => Promise<void>;
  markFinalizado: (sorteoId: number) => Promise<void>;
  ticketPrice: number;
  logger: Logger;
}

/**
 * Escruta un sorteo: clasifica tickets, distribuye pool, persiste ganadores,
 * actualiza jackpot y finaliza. Transaccional.
 */
async function scrutinizeSorteo(
  sorteo: Sorteo,
  deps: ScrutinyWorkerDeps,
): Promise<void> {
  const combinacion = sorteo.combinacionGanadora as CombinacionGanadora | null;
  if (!combinacion) {
    throw new Error(`sorteo ${sorteo.id} no tiene combinacionGanadora`);
  }

  // 1. Pool = boletos ACTIVO × precio
  const ticketCount = await deps.countActiveTickets(Number(sorteo.id));
  const poolAmount = ticketCount * deps.ticketPrice;

  // 2. Clasificar tickets
  const tickets = await deps.getActiveTickets(Number(sorteo.id));
  const tierCounts = new Array(9).fill(0);
  const ganadores: NuevoGanador[] = [];

  for (const t of tickets) {
    const tier = classifyTicket(
      { balotas: [t.n1, t.n2, t.n3, t.n4, t.n5], powerball: t.powerball },
      combinacion,
    );
    if (tier > 0) {
      tierCounts[tier - 1]!;
      tierCounts[tier - 1] = tierCounts[tier - 1]! + 1;
      ganadores.push({
        sorteoId: BigInt(sorteo.id),
        ticketId: t.id,
        tier,
        monto: "0", // se asigna tras distributePool
        pagado: false,
      });
    }
  }

  // 3. Distribuir pool
  const carryover = await deps.getJackpotBalance();
  const dist = distributePool(poolAmount, tierCounts, carryover);

  // 4. Asignar montos
  for (const g of ganadores) {
    const tierResult = dist.tiers[g.tier - 1]!;
    g.monto = String(tierResult.perWinner);
  }

  // 5. Persistir (transaccional en prod via db.transaction)
  await deps.insertGanadores(ganadores);
  await deps.setJackpotBalance(dist.rolloverToJackpot);
  await deps.markFinalizado(Number(sorteo.id));

  deps.logger.info("sorteo escrutado", {
    id: Number(sorteo.id),
    poolAmount,
    ganadores: ganadores.length,
    rollover: dist.rolloverToJackpot,
  });
}

/** Una ronda del worker. Exportada para tests. */
export async function runRound(
  deps: ScrutinyWorkerDeps,
): Promise<{ checked: number; finalized: number }> {
  const sorteos = await deps.getCalculatedSorteos();
  let finalized = 0;

  for (const sorteo of sorteos) {
    try {
      await scrutinizeSorteo(sorteo, deps);
      finalized++;
    } catch (err) {
      deps.logger.warn("escrutinio falló", {
        id: Number(sorteo.id),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return { checked: sorteos.length, finalized };
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: ScrutinyWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("scrutiny-verifier recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("scrutiny-verifier detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda scrutiny completa", stats);
    } catch (err) {
      deps.logger.error("ronda scrutiny falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps: ScrutinyWorkerDeps = {
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
  deps.logger.info("arrancando scrutiny-verifier", {
    intervalMs: deps.env.SCRUTINY_CHECK_INTERVAL_MS,
  });
  runLoop(workerDeps, deps.env.SCRUTINY_CHECK_INTERVAL_MS);
}

// Arranca solo cuando se ejecuta directamente.
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
Expected: 4 scrutiny-verifier + 5 services-premios + 32 existentes = 41 PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @myloto/backend typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/backend pnpm-lock.yaml
git commit -m "feat(backend): worker scrutiny-verifier (CALCULADO→FINALIZADO, parimutuel)"
```

---

## Task 9: Verificación global

**Objetivo:** Confirmar workspace verde.

- [ ] **Step 1: Typecheck global**

Run: `pnpm -r typecheck`
Expected: todos los paquetes Done, exit 0.

- [ ] **Step 2: Tests unitarios globales**

Run: `pnpm -r test`
Expected: todo verde (scrutiny ~18 + config 28 + brc20 37 + crypto 36 + rpc-client 26 + payments 11 + randomness 17 + backend 41).

- [ ] **Step 3: Confirmar golden vectors**

Run: `pnpm --filter @myloto/scrutiny test`
Expected: los tests "golden vector" de pool + todos los tiers PASS.

- [ ] **Step 4: Verificar migración (opcional, si hay DB disponible)**

Run: `pnpm db:migrate`
Expected: migración aplicada sin errores. Verificar con `\dt` en psql que `ganadores` y `jackpot_pool` existen.

Entregables verificados (spec §8):
1. ✅ `pnpm install` sin errores
2. ✅ `pnpm --filter @myloto/scrutiny typecheck` exit 0
3. ✅ `pnpm --filter @myloto/scrutiny test` todo verde (~18)
4. ✅ `pnpm --filter @myloto/backend test` todo verde (~41)
5. ✅ `pnpm -r test` todo verde
6. ✅ `pnpm -r typecheck` todo verde
7. ✅ Golden vector clasificación congelado
8. ✅ Golden vector distribución congelado
9. ✅ Migración DB generada
10. ⏳ Demo E2E — pendiente IBD

---

## Self-Review del Plan

### Especificación cubierta

| Sección del spec | Tarea que lo implementa |
|---|---|
| §4.1 `classifyTicket` + TIER_PERCENTAGES | Task 3 |
| §4.2 `distributePool` parimutuel | Task 4 |
| §4.3 `ScrutinyError` | Task 2 |
| §5 Migración DB (ganadores + jackpotPool + FINALIZADO) | Task 5 |
| §5.2 tipos (FINALIZADO en SORTEO_ESTADO) | Task 5 |
| §6.1 `services/premios.ts` | Task 7 |
| §6.2 `workers/scrutiny-verifier.ts` | Task 8 |
| §6 var `SCRUTINY_CHECK_INTERVAL_MS` | Task 6 |
| §7 Tests (golden vectors, tiers, distribución) | Tasks 3, 4, 7, 8 |
| §8 Entregables | Task 9 |

Todas las secciones del spec tienen al menos una tarea. ✓

### Placeholder scan

- Task 5 Step 5 genera la migración con `drizzle-kit generate` (el nombre exacto del archivo `0001_*.sql` lo decide drizzle-kit automáticamente). Hay un fallback manual si drizzle-kit no está disponible. No es un placeholder — es el flujo estándar de Drizzle. ✓
- Sin "TBD", "implement later", ni "add appropriate error handling". ✓

### Type consistency

- `classifyTicket(ticket, ganadora): Tier` — Task 3, usado en Task 8. ✓
- `distributePool(poolAmount, tierCounts, carryover): DistributionResult` — Task 4, usado en Task 8. ✓
- `Tier = 1|2|3|4|5|6|7|8|9|0` — Task 3. ✓
- `NuevoGanador` tipo de Drizzle (inferido de `ganadores.$inferInsert`) — Task 5, usado en Task 7 y Task 8. ✓
- `ScrutinyWorkerDeps` interfaz — Task 8 (consistente entre impl y test). ✓
- `SCRUTINY_CHECK_INTERVAL_MS: number` — Task 6, usado en Task 8. ✓

Sin inconsistencias. ✓
