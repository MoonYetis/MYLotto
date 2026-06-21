# Diseño: Escrutinio y Reparto de Premios (Ciclo 6)

**Fecha:** 2026-06-21
**Ciclo:** 6 de 8
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)
**Depende de:** Ciclo 1 (db, config), Ciclo 4 (tickets), Ciclo 5 (combinacion_ganadora).

---

## 1. Contexto y Alcance

Tras el Ciclo 5, un sorteo pasa a estado `CALCULADO` cuando tiene su `combinacion_ganadora` persistida. El Ciclo 6 compara cada ticket ACTIVO del sorteo contra esa combinación, clasifica los ganadores en tiers de premio, distribuye el pool recaudado (parimutuel) y persiste los resultados. Al finalizar, el sorteo pasa a `FINALIZADO`.

### Objetivos de este ciclo

- Crear `packages/scrutiny` con la lógica pura de clasificación y distribución parimutuel.
- Implementar migración DB: tablas `ganadores` + `jackpot_pool` + estado `FINALIZADO`.
- Implementar `services/premios.ts` (DB ops) y `workers/scrutiny-verifier.ts` (orquestación).
- Gestionar el jackpot acumulable entre sorteos (tabla singleton `jackpot_pool`).
- Garantizar atomicidad: cada escrutinio de sorteo es transaccional.

### No incluye este ciclo (explícito)

- **Pago físico de FB a los ganadores** — requiere manejo de llaves privadas o PSBT. Es operación manual del operador por ahora, o Ciclo 7. El escrutinio calcula y persiste los montos; no mueve fondos.
- **Gestión de sorteos** (crear/cerrar, transición ABIERTO→CERRADO) — Ciclo 7.
- **Frontend** — Ciclo 8.
- **Demo E2E con nodo real** — pendiente IBD (igual que Ciclos 4-5).

---

## 2. Decisiones Consolidadas

| Decisión | Elección | Justificación |
|---|---|---|
| Modelo de premios | 9 tiers Powerball, parimutuel | Estándar, emocionante, máximas posibilidades de ganar algo |
| Distribución del pool | 68/8/4/1/1.6/1.4/1/1/1 % a tiers 1-9, 13% reserva operador | Powerball estándar; MYLoto se financia del 13% |
| Jackpot | Acumulable entre sorteos | Si un tier no tiene ganadores, su monto rueda. Crea jackpots crecientes |
| Alcance | Escrutinio + persistencia, sin pago FB | El pago toca seguridad operacional (llaves privadas) |
| Disparador | Worker periódico (`scrutiny-verifier`) | Mismo patrón que payment-verifier y draw-verifier |
| Estado final | Nuevo estado `FINALIZADO` | Claridad: CALCULADO = tiene combinación, FINALIZADO = escrutado |
| Saldo jackpot | Tabla singleton `jackpot_pool` | Transaccional, simple de consultar |
| Arquitectura | `packages/scrutiny` + `services/premios` + worker | Sigue el patrón de los Ciclos 1-5: dominio puro en packages/, composición en apps/ |

### Los 9 tiers de Powerball

| Tier | Descripción | % del pool |
|---|---|---|
| 1 | 5 balotas + Powerball (jackpot) | 68% |
| 2 | 5 balotas | 8% |
| 3 | 4 balotas + Powerball | 4% |
| 4 | 4 balotas | 1% |
| 5 | 3 balotas + Powerball | 1.6% |
| 6 | 3 balotas | 1.4% |
| 7 | 2 balotas + Powerball | 1% |
| 8 | 1 balota + Powerball | 1% |
| 9 | 0 balotas + Powerball | 1% |
| — | Reserva operador | 13% |

Total: 87% a jugadores + 13% reserva = 100%.

### Flujo de estados del sorteo

```
ABIERTO → CERRADO → CALCULADO → FINALIZADO
```

- `ABIERTO`: acepta tickets (Ciclo 4).
- `CERRADO`: pasó el bloque_cierre (Ciclo 7).
- `CALCULADO`: tiene combinacion_ganadora (Ciclo 5).
- `FINALIZADO`: escrutinio completo, ganadores persistidos (este ciclo).

---

## 3. Estructura

```
packages/scrutiny/                      # NUEVO — lógica pura, sin DB/red
├── src/
│   ├── tiers.ts                       # classifyTicket + TIER_PERCENTAGES
│   ├── pool.ts                        # distributePool parimutuel
│   ├── errors.ts                      # ScrutinyError jerarquía
│   └── index.ts
├── test/unit/
│   ├── tiers.test.ts                  # 10 casos (uno por tier + sin premio)
│   └── pool.test.ts                   # 6 tests incl. golden vector distribución
├── package.json
├── tsconfig.json
└── vitest.config.ts

apps/backend/
├── src/
│   ├── services/premios.ts            # NUEVO — DB ops Drizzle
│   └── workers/scrutiny-verifier.ts   # NUEVO — loop periódico
└── test/
    ├── services-premios.test.ts
    └── worker-scrutiny-verifier.test.ts
```

**Modifica:**
- `packages/db/src/schema.ts` — tablas `ganadores` + `jackpotPool`, CHECK `FINALIZADO`.
- `packages/db/src/migrations/` — nueva migración SQL.
- `packages/types/src/sorteo.ts` — `FINALIZADO` en `SORTEO_ESTADO`.
- `packages/config/src/env.ts` — `SCRUTINY_CHECK_INTERVAL_MS`.
- `apps/backend/package.json` — dep `@myloto/scrutiny` + script `worker:scrutiny`.
- `.env.example`.

---

## 4. `packages/scrutiny`

### 4.1 `tiers.ts`

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

### 4.2 `pool.ts`

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

### 4.3 `errors.ts`

```typescript
export class ScrutinyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrutinyError";
  }
}
```

---

## 5. Migración DB

### 5.1 Schema (`packages/db/src/schema.ts`)

Añadir:

```typescript
import { boolean } from "drizzle-orm/pg-core"; // añadir al import existente

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
export type JackpotPool = typeof jackpotPool.$inferSelect;
```

Modificar el CHECK de `sorteos.estado`:

```typescript
    estadoCheck: check(
      "chk_sorteo_estado",
      sql`${t.estado} IN ('ABIERTO', 'CERRADO', 'CALCULADO', 'FINALIZADO')`,
    ),
```

### 5.2 Tipos (`packages/types/src/sorteo.ts`)

```typescript
export const SORTEO_ESTADO = {
  ABIERTO: "ABIERTO",
  CERRADO: "CERRADO",
  CALCULADO: "CALCULADO",
  FINALIZADO: "FINALIZADO", // NUEVO
} as const;
```

### 5.3 Migración SQL

Crea las tablas, modifica el CHECK, y hace seed del singleton:

```sql
-- Tabla de ganadores
CREATE TABLE ganadores (
  id          BIGSERIAL PRIMARY KEY,
  sorteo_id   BIGINT NOT NULL REFERENCES sorteos(id) ON DELETE CASCADE,
  ticket_id   BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tier        SMALLINT NOT NULL,
  monto       NUMERIC(18,8) NOT NULL,
  pagado      BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tier CHECK (tier BETWEEN 1 AND 9)
);
CREATE INDEX ganadores_sorteo_tier ON ganadores(sorteo_id, tier);
CREATE INDEX ganadores_ticket ON ganadores(ticket_id);

-- Jackpot acumulable (singleton)
CREATE TABLE jackpot_pool (
  id            SMALLINT PRIMARY KEY DEFAULT 1,
  saldo         NUMERIC(18,8) NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_singleton CHECK (id = 1)
);
INSERT INTO jackpot_pool (id, saldo) VALUES (1, 0) ON CONFLICT DO NOTHING;

-- Ampliar estado del sorteo
ALTER TABLE sorteos DROP CONSTRAINT chk_sorteo_estado;
ALTER TABLE sorteos ADD CONSTRAINT chk_sorteo_estado
  CHECK (estado IN ('ABIERTO', 'CERRADO', 'CALCULADO', 'FINALIZADO'));
```

---

## 6. Backend — Services y Worker

### 6.1 `apps/backend/src/services/premios.ts`

```typescript
import { eq } from "drizzle-orm";
import { sorteos, tickets, ganadores, jackpotPool, type Database, type Sorteo } from "@myloto/db";

/** Lee el saldo del jackpot acumulado (singleton, default 0). */
export async function getJackpotBalance(db: Database): Promise<number>;

/** Sobrescribe el saldo del jackpot. */
export async function setJackpotBalance(db: Database, amount: number): Promise<void>;

/** Cuenta boletos ACTIVO de un sorteo. */
export async function countActiveTickets(db: Database, sorteoId: number): Promise<number>;

/** Devuelve los tickets ACTIVO de un sorteo (para clasificar). */
export async function getActiveTickets(db: Database, sorteoId: number): Promise<Ticket[]>;

/** Inserta los ganadores de un sorteo (batch). */
export async function insertGanadores(db: Database, rows: NewGanador[]): Promise<void>;

/** Sorteos en CALCULADO sin escrutar. */
export async function getCalculatedSorteos(db: Database): Promise<Sorteo[]>;

/** Transición CALCULADO → FINALIZADO. Idempotente (WHERE estado='CALCULADO'). */
export async function markFinalizado(db: Database, sorteoId: number): Promise<void>;
```

### 6.2 `apps/backend/src/workers/scrutiny-verifier.ts`

```typescript
export interface ScrutinyWorkerDeps {
  getCalculatedSorteos: () => Promise<Sorteo[]>;
  countActiveTickets: (sorteoId: number) => Promise<number>;
  getActiveTickets: (sorteoId: number) => Promise<Ticket[]>;
  getJackpotBalance: () => Promise<number>;
  setJackpotBalance: (amount: number) => Promise<void>;
  insertGanadores: (rows: NewGanador[]) => Promise<void>;
  markFinalizado: (sorteoId: number) => Promise<void>;
  /** Ejecuta el escrutinio completo de un sorteo en una transacción atómica. */
  scrutinizeSorteo: (sorteo: Sorteo) => Promise<void>;
  logger: Logger;
}

export async function runRound(deps: ScrutinyWorkerDeps): Promise<{ checked: number; finalized: number }>;
export function runLoop(deps: ScrutinyWorkerDeps, intervalMs: number): void;
```

**`scrutinizeSorteo`** (el corazón del worker, transaccional):

```
1. poolAmount = countActiveTickets × TICKET_PRICE_FB
2. tickets = getActiveTickets(sorteo)
3. clasificar cada ticket → tierCounts + lista de ganadores (sin monto)
4. carryover = getJackpotBalance()
5. dist = distributePool(poolAmount, tierCounts, carryover)
6. asignar monto a cada ganador (dist.tiers[tier-1].perWinner)
7. EN TRANSACCIÓN:
   - insertGanadores(ganadores con monto)
   - setJackpotBalance(dist.rolloverToJackpot)
   - markFinalizado(sorteo)
```

La transaccionalidad garantiza atomicidad: si algo falla a mitad, el sorteo queda en CALCULADO y el worker lo reintenta en la siguiente ronda (idempotente).

**Configuración:** `SCRUTINY_CHECK_INTERVAL_MS` (default 60000).

---

## 7. Tests

### 7.1 `packages/scrutiny` (unitarios, deterministas)

**`tiers.test.ts`** (~10 tests):
- Un test por cada tier (1-9) con combinación ganadora fija + ticket que acierta exactamente ese tier.
- Caso "sin premio" (tier 0): 0 balotas + PB incorrecto.
- Caso límite: 5 balotas + PB correcto = tier 1; 5 balotas + PB incorrecto = tier 2.

**`pool.test.ts`** (~6 tests):
- **Golden vector:** pool 1000 FB + tierCounts conocidos → montos exactos congelados.
- Todos los tiers con ganadores → cada % exacto.
- Tier 1 sin ganadores → su monto + carryover ruedan.
- Tier 4 sin ganadores → solo tier 4 rueda.
- Jackpot carryover se suma solo al tier 1.
- Reserva operador = 13% exacto.

### 7.2 Backend (con stubs)

**`services-premios.test.ts`** (~5 tests): jackpot default 0, countActiveTickets, insertGanadores batch, getCalculatedSorteos, markFinalizado.

**`worker-scrutiny-verifier.test.ts`** (~4 tests): runRound vacío → `{0,0}`, sorteo CALCULADO → clasifica+distribuye+persiste+finaliza, error individual no mata round, idempotencia.

---

## 8. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `pnpm install` sin errores | OK |
| 2 | `pnpm --filter @myloto/scrutiny typecheck` | Exit 0 |
| 3 | `pnpm --filter @myloto/scrutiny test` | Todos pasan (~16) |
| 4 | `pnpm --filter @myloto/backend test` | Todos pasan (~9 nuevos) |
| 5 | `pnpm -r test` | Todo verde |
| 6 | `pnpm -r typecheck` | Todo verde |
| 7 | Golden vector clasificación: ticket → tier exacto | Vector congelado |
| 8 | Golden vector distribución: pool + tierCounts → montos | Vector congelado |
| 9 | Migración DB aplicable | `pnpm db:migrate` exit 0 |
| 10 | Demo E2E | ⏳ Pendiente IBD |

---

## 9. Decisiones de Diseño Clave (resumen)

1. **Parimutuel con porcentajes Powerball estándar** — cada tier recibe un % fijo del pool, repartido a partes iguales entre sus ganadores. Transparente y verificable.

2. **Jackpot acumulable via `jackpot_pool` singleton** — si un tier no tiene ganadores, su monto rueda. Solo el tier 1 recibe el carryover al calcular (el jackpot es por definición el tier 1).

3. **Escrutinio transaccional** — insertar ganadores + actualizar jackpot + finalizar en una sola transacción DB. Si falla a mitad, el sorteo queda CALCULADO y se reintenta (idempotente).

4. **`classifyTicket` y `distributePool` son puras** — testeables sin DB ni red. Golden vectors congelados protegen contra cambios accidentales de la lógica financiera.

5. **Pool = ticketCount × TICKET_PRICE_FB** — el descuento Hold-to-Earn sale del margen del operador, no del pool de premios. Todos los boletos valen lo mismo para el cálculo del pool.

6. **`FINALIZADO` como nuevo estado** — claridad semántica. CALCULADO = combinación calculada; FINALIZADO = escrutinio completo.

7. **Sin pago FB automático** — el escrutinio calcula y persiste los montos; el operador paga manualmente por ahora. El campo `ganadores.pagado` (boolean) rastrea qué premios se han pagado.

---

## 10. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Escrutinio parcial por crash a mitad de transacción | Baja | Alto | Transacción DB atómica; el sorteo queda CALCULADO y se reintenta |
| División por cero (tier con 0 ganadores) | Nula | — | `distributePool` maneja winnerCount=0 → perWinner=0, monto rueda |
| Jackpot crece indefinidamente si nadie gana | Media (jackpots grandes son deseables) | Bajo | Por diseño: jackpot acumulable es un feature, no un bug |
| Error de precisión en NUMERIC(18,8) | Baja | Bajo | Drizzle usa NUMERIC exacto; redondeo a 8 decimales |
| Escrutinio duplicado (worker corre dos veces) | Baja | Medio | `markFinalizado` con `WHERE estado='CALCULADO'`; segundo escrutinio no encuentra el sorteo (ya FINALIZADO) |
| Pool negativo si ticketCount=0 | Baja | Bajo | distributePool con poolAmount=0 → todos los tiers 0, no hay ganadores |

---

## 11. Próximos Ciclos (Roadmap actualizado)

1. ✅ **Ciclo 1:** Fundación + Cliente RPC
2. ✅ **Ciclo 2:** Derivación HD + QR
3. ✅ **Ciclo 3:** `packages/brc20` — cliente UniSat + descuento
4. ✅ **Ciclo 4:** Motor de pagos híbrido + compra de tickets
5. ✅ **Ciclo 5:** Motor de aleatoriedad on-chain
6. 🔄 **Ciclo 6:** Escrutinio y reparto de premios (este spec)
7. **Ciclo 7:** Backend completo — gestión de sorteos (ABIERTO→CERRADO), listener real-time, orquestación, pago FB a ganadores
8. **Ciclo 8:** Frontend Next.js
