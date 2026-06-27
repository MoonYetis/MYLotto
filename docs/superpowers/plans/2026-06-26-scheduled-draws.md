# Sorteos Programados (3/semana) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatizar la creación de sorteos según calendario semanal fijo (Lun/Jue/Sáb 20:00 Colombia) con cierre continuo, más cuenta regresiva en la home y despliegue de los 5 workers como servicios systemd.

**Architecture:** Un nuevo worker `schedule-worker` (sigue el patrón de `lifecycle-verifier`) crea sorteos automáticamente cuando no hay ninguno ABIERTO. Un servicio `schedule.ts` calcula el próximo día/hora Lun/Jue/Sáb 20:00 America/Bogota y estima el bloque de cierre. Los workers existentes (lifecycle, payment, draw, scrutiny) se despliegan como servicios systemd para completar el ciclo autónomo. El frontend añade una cuenta regresiva al próximo cierre.

**Tech Stack:** Node 22, Fastify, Drizzle ORM, Postgres, Vitest, Next.js 15, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-06-26-scheduled-draws-design.md`

---

## File Structure

### Crear
- `apps/backend/src/services/schedule.ts` — `getNextDrawTime`, `estimateBlockAtTime`
- `apps/backend/src/workers/schedule-worker.ts` — worker que crea sorteos automáticamente
- `apps/backend/src/test/schedule.test.ts` — tests del cálculo de calendario (TDD)
- `apps/backend/test/schedule-worker.test.ts` — tests del worker (runRound con mocks)

### Modificar
- `packages/config/src/env.ts` — añadir 5 variables de scheduler
- `apps/backend/test/health.test.ts` — actualizar `mockDeps` con las nuevas env vars
- `apps/web/src/components/home/HeroSection.tsx` — mostrar cuenta regresiva al próximo sorteo

### NO tocar
- `lifecycle-verifier.ts`, `draw-verifier.ts`, `scrutiny-verifier.ts`, `payment-verifier.ts`
- `routes/sorteos.ts`, `routes/tickets.ts`, schema de DB

---

## Task 1: Variables de configuración del scheduler

**Files:**
- Modify: `packages/config/src/env.ts:62-63` (después de `LIFECYCLE_CHECK_INTERVAL_MS`)

- [ ] **Step 1: Añadir las 5 variables al envSchema**

En `packages/config/src/env.ts`, después de la línea `LIFECYCLE_CHECK_INTERVAL_MS: ...` y antes del cierre `});`, añadir:

```ts
  // --- Scheduler de sorteos (calendario semanal) ---
  // Días ISO separados por coma: 1=Lun, 4=Jue, 6=Sáb. El operador puede cambiarlos.
  SCHEDULE_DAYS: z.string().default("1,4,6"),
  // Hora del sorteo (0-23), hora local del timezone.
  SCHEDULE_HOUR: z.coerce.number().int().min(0).max(23).default(20),
  // Timezone IANA. America/Bogota no tiene DST.
  SCHEDULE_TIMEZONE: z.string().default("America/Bogota"),
  // Intervalo de check del scheduler (1 min).
  SCHEDULE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  // Tiempo promedio de bloque en Fractal (10 min = 600000 ms).
  BLOCK_TIME_MS: z.coerce.number().int().positive().default(600000),
```

- [ ] **Step 2: Actualizar el mockDeps del test de health**

En `apps/backend/test/health.test.ts`, dentro del objeto `env` del `mockDeps` (después de `LIFECYCLE_CHECK_INTERVAL_MS: 60000,`), añadir:

```ts
      SCHEDULE_DAYS: "1,4,6",
      SCHEDULE_HOUR: 20,
      SCHEDULE_TIMEZONE: "America/Bogota",
      SCHEDULE_CHECK_INTERVAL_MS: 60000,
      BLOCK_TIME_MS: 600000,
```

- [ ] **Step 3: Verificar typecheck + tests**

Run:
```bash
cd /Users/osmanmarin/Desktop/MYLoto
pnpm --filter @myloto/backend typecheck 2>&1 | tail -3
pnpm --filter @myloto/backend test -- --run 2>&1 | tail -8
```
Expected: typecheck limpio, los 2 tests de health siguen pasando.

- [ ] **Step 4: Commit**

```bash
git add packages/config/src/env.ts apps/backend/test/health.test.ts
git commit -m "feat(config): variables del scheduler de sorteos (SCHEDULE_DAYS/HOUR/TIMEZONE)"
```

---

## Task 2: Servicio de cálculo de calendario — getNextDrawTime (TDD)

**Files:**
- Create: `apps/backend/src/services/schedule.ts`
- Test: `apps/backend/src/test/schedule.test.ts`

- [ ] **Step 1: Crear el test con casos edge (TDD)**

Crear `apps/backend/src/test/schedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getNextDrawTime, formatCountdown } from "../services/schedule.js";

describe("getNextDrawTime", () => {
  // Días ISO: 1=Lun, 4=Jue, 6=Sáb. Hora: 20. Timezone: America/Bogota (UTC-5, sin DST).
  const days = [1, 4, 6];
  const hour = 20;
  const tz = "America/Bogota";

  it("martes 15:00 → próximo jueves 20:00", () => {
    // Martes 27 enero 2026, 15:00 Bogota (= 20:00 UTC)
    const now = new Date("2026-01-27T20:00:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Jueves 29 enero 2026, 20:00 Bogota (= 2026-01-30T01:00:00Z)
    expect(next.toISOString()).toBe("2026-01-30T01:00:00.000Z");
  });

  it("jueves 19:00 → hoy jueves 20:00 (aún no llega la hora)", () => {
    // Jueves 29 enero 2026, 19:00 Bogota (= 2026-01-30T00:00:00Z)
    const now = new Date("2026-01-30T00:00:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Jueves 29 enero 2026, 20:00 Bogota (= 2026-01-30T01:00:00Z)
    expect(next.toISOString()).toBe("2026-01-30T01:00:00.000Z");
  });

  it("jueves 20:30 → próximo sábado 20:00 (ya pasó la hora de hoy)", () => {
    // Jueves 29 enero 2026, 20:30 Bogota (= 2026-01-30T01:30:00Z)
    const now = new Date("2026-01-30T01:30:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Sábado 31 enero 2026, 20:00 Bogota (= 2026-02-01T01:00:00Z)
    expect(next.toISOString()).toBe("2026-02-01T01:00:00.000Z");
  });

  it("sábado 20:30 → próximo lunes 20:00 (wrap de semana)", () => {
    // Sábado 31 enero 2026, 20:30 Bogota (= 2026-02-01T01:30:00Z)
    const now = new Date("2026-02-01T01:30:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Lunes 2 febrero 2026, 20:00 Bogota (= 2026-02-02T01:00:00Z)
    expect(next.toISOString()).toBe("2026-02-02T01:00:00.000Z");
  });

  it("lunes 18:00 → hoy lunes 20:00", () => {
    // Lunes 26 enero 2026, 18:00 Bogota (= 2026-01-26T23:00:00Z)
    const now = new Date("2026-01-26T23:00:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Lunes 26 enero 2026, 20:00 Bogota (= 2026-01-27T01:00:00Z)
    expect(next.toISOString()).toBe("2026-01-27T01:00:00.000Z");
  });
});

describe("formatCountdown", () => {
  it("formatea días+horas+minutos", () => {
    // 2 días, 4 horas, 30 min = 190800000 ms
    expect(formatCountdown(190800000)).toBe("2d 4h 30m");
  });

  it("formatea solo horas+minutos si < 1 día", () => {
    // 4h 30m = 16200000 ms
    expect(formatCountdown(16200000)).toBe("4h 30m");
  });

  it("formatea solo minutos si < 1 hora", () => {
    // 30 min = 1800000 ms
    expect(formatCountdown(1800000)).toBe("30m");
  });

  it("devuelve 'Cerrando' si es 0 o negativo", () => {
    expect(formatCountdown(0)).toBe("Cerrando");
    expect(formatCountdown(-1000)).toBe("Cerrando");
  });
});
```

- [ ] **Step 2: Run test para verificar que falla**

Run: `cd /Users/osmanmarin/Desktop/MYLoto && pnpm --filter @myloto/backend test -- --run src/test/schedule.test.ts 2>&1 | tail -10`
Expected: FAIL con "Cannot find module '../services/schedule.js'"

- [ ] **Step 3: Implementar schedule.ts con getNextDrawTime y formatCountdown**

Crear `apps/backend/src/services/schedule.ts`:

```ts
/**
 * Cálculo del calendario de sorteos y utilidades de tiempo.
 * Sorteos: días fijos semanales (ej. Lun/Jue/Sáb) a una hora fija (ej. 20:00)
 * en una timezone sin DST (America/Bogota).
 */

/**
 * Devuelve los componentes de una fecha (año, mes, día, hora, día-semana-ISO)
 * interpretados en la timezone indicada. Usa Intl.DateTimeFormat para evitar
 * dependencias externas (Node 22 lo soporta nativamente).
 */
function getDatePartsInTz(date: Date, timezone: string): {
  year: number; month: number; day: number; hour: number; minute: number;
  weekday: number; // ISO: 1=Lun ... 7=Dom
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24, // hour12:false puede dar "24" para medianoche
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 1,
  };
}

/**
 * Construye un Date a partir de componentes (year, month, day, hour, min) en UTC.
 * Como usamos este resultado solo para comparar y formatear, la representación
 * interna es UTC pero los valores corresponden a la hora local del timezone.
 */
function dateFromParts(year: number, month: number, day: number, hour: number, minute: number): Date {
  // month es 1-indexed en nuestros componentes
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

/**
 * Devuelve el próximo momento de sorteo (días/hora en timezone local).
 *
 * @param now momento actual (cualquier timezone internamente)
 * @param days días ISO sorted ascending (ej. [1,4,6] = Lun, Jue, Sáb)
 * @param hour hora del sorteo (0-23) en timezone local
 * @param timezone timezone IANA (ej. "America/Bogota")
 */
export function getNextDrawTime(
  now: Date,
  days: number[],
  hour: number,
  timezone: string,
): Date {
  const parts = getDatePartsInTz(now, timezone);
  const sortedDays = [...days].sort((a, b) => a - b);

  // ¿Hoy es día de sorteo y aún no llega la hora?
  if (sortedDays.includes(parts.weekday) && parts.hour < hour) {
    return dateFromParts(parts.year, parts.month, parts.day, hour, 0);
  }

  // Buscar el próximo día (iterando hasta 7 días adelante)
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const cp = getDatePartsInTz(candidate, timezone);
    if (sortedDays.includes(cp.weekday)) {
      return dateFromParts(cp.year, cp.month, cp.day, hour, 0);
    }
  }

  // No debería llegar aquí si hay al menos un día válido
  throw new Error("getNextDrawTime: no se encontró próximo día de sorteo en 7 días");
}

/**
 * Estima la altura de bloque para un momento futuro.
 *
 * @param targetTime momento futuro del sorteo
 * @param currentHeight altura actual del bloque
 * @param now momento actual
 * @param blockTimeMs tiempo promedio de bloque (default 600000 = 10 min Fractal)
 */
export function estimateBlockAtTime(
  targetTime: Date,
  currentHeight: number,
  now: Date,
  blockTimeMs = 600_000,
): number {
  const msUntilTarget = targetTime.getTime() - now.getTime();
  const blocksUntilTarget = Math.max(1, Math.ceil(msUntilTarget / blockTimeMs));
  return currentHeight + blocksUntilTarget;
}

/**
 * Formatea un tiempo en ms como cuenta regresiva legible.
 * Ej: 190800000 → "2d 4h 30m"
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Cerrando";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
```

- [ ] **Step 4: Run test para verificar que pasa**

Run: `cd /Users/osmanmarin/Desktop/MYLoto && pnpm --filter @myloto/backend test -- --run src/test/schedule.test.ts 2>&1 | tail -10`
Expected: PASS — los 5 tests de getNextDrawTime + 4 tests de formatCountdown pasan.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/schedule.ts apps/backend/src/test/schedule.test.ts
git commit -m "feat(backend): servicio schedule.ts (getNextDrawTime + formatCountdown) con tests"
```

---

## Task 3: Worker del scheduler (runRound + runLoop)

**Files:**
- Create: `apps/backend/src/workers/schedule-worker.ts`
- Create: `apps/backend/test/schedule-worker.test.ts`

- [ ] **Step 1: Crear el test del worker (TDD)**

Crear `apps/backend/test/schedule-worker.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/schedule-worker.js";
import type { ScheduleWorkerDeps } from "../src/workers/schedule-worker.js";

function mockDeps(overrides: Partial<ScheduleWorkerDeps> = {}): ScheduleWorkerDeps {
  return {
    getActiveSorteo: vi.fn().mockResolvedValue({ id: 1n, estado: "ABIERTO" }),
    getBlockCount: vi.fn().mockResolvedValue(1000),
    createSorteo: vi.fn().mockResolvedValue({ id: 2n }),
    getNextDrawTime: vi.fn().mockReturnValue(new Date("2026-01-30T01:00:00Z")),
    estimateBlockAtTime: vi.fn().mockReturnValue(1500),
    logger: {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
      trace: vi.fn(), fatal: vi.fn(), child: vi.fn().mockReturnThis(),
    },
    ...overrides,
  };
}

describe("schedule-worker runRound", () => {
  it("no crea sorteo si ya hay uno ABIERTO", async () => {
    const deps = mockDeps();
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, created: 0 });
    expect(deps.createSorteo).not.toHaveBeenCalled();
  });

  it("crea sorteo si no hay ninguno ABIERTO", async () => {
    const deps = mockDeps({
      getActiveSorteo: vi.fn().mockResolvedValue(null),
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, created: 1 });
    expect(deps.createSorteo).toHaveBeenCalledWith(1500);
  });

  it("no falla si createSorteo lanza error de constraint (duplicado)", async () => {
    const deps = mockDeps({
      getActiveSorteo: vi.fn().mockResolvedValue(null),
      createSorteo: vi.fn().mockRejectedValue(new Error("unique constraint")),
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, created: 0 });
    expect(deps.logger.warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test para verificar que falla**

Run: `cd /Users/osmanmarin/Desktop/MYLoto && pnpm --filter @myloto/backend test -- --run test/schedule-worker.test.ts 2>&1 | tail -8`
Expected: FAIL con "Cannot find module '../src/workers/schedule-worker.js'"

- [ ] **Step 3: Implementar schedule-worker.ts**

Crear `apps/backend/src/workers/schedule-worker.ts`:

```ts
import { buildDeps } from "../dependencies.js";
import { getActiveSorteo } from "../services/tickets.js";
import { createSorteo } from "../services/sorteos.js";
import { getNextDrawTime, estimateBlockAtTime } from "../services/schedule.js";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface ScheduleWorkerDeps {
  getActiveSorteo: () => Promise<{ id: bigint } | null>;
  getBlockCount: () => Promise<number>;
  createSorteo: (bloqueCierre: number) => Promise<{ id: bigint }>;
  getNextDrawTime: (now: Date) => Date;
  estimateBlockAtTime: (targetTime: Date, currentHeight: number, now: Date) => number;
  logger: Logger;
}

/**
 * Una ronda del scheduler. Si no hay sorteo ABIERTO, calcula el próximo horario
 * y crea el sorteo con el bloque de cierre estimado. Idempotente: si ya hay
 * ABIERTO, no hace nada. Si createSorteo falla (duplicado), no es fatal.
 */
export async function runRound(
  deps: ScheduleWorkerDeps,
): Promise<{ checked: number; created: number }> {
  const existing = await deps.getActiveSorteo();
  if (existing) {
    return { checked: 1, created: 0 };
  }

  // No hay ABIERTO → crear el próximo
  const now = new Date();
  const nextDraw = deps.getNextDrawTime(now);
  const currentHeight = await deps.getBlockCount();
  const bloqueCierre = deps.estimateBlockAtTime(nextDraw, currentHeight, now);

  try {
    const created = await deps.createSorteo(bloqueCierre);
    deps.logger.info("sorteo creado por scheduler", {
      id: Number(created.id),
      bloqueCierre,
      nextDraw: nextDraw.toISOString(),
    });
    return { checked: 1, created: 1 };
  } catch (err) {
    // Probablemente unique constraint en bloque_cierre (duplicado). No fatal.
    deps.logger.warn("scheduler no pudo crear sorteo (posible duplicado)", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { checked: 1, created: 0 };
  }
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: ScheduleWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("schedule-worker recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("schedule-worker detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      if (stats.created > 0) {
        deps.logger.info("ronda schedule completa", stats);
      }
    } catch (err) {
      deps.logger.error("ronda schedule falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

export function buildScheduleDeps(
  deps: ReturnType<typeof buildDeps>,
): ScheduleWorkerDeps {
  const sortedDays = deps.env.SCHEDULE_DAYS.split(",").map((s) => Number(s.trim()));
  return {
    getActiveSorteo: () => getActiveSorteo(deps.db.db),
    getBlockCount: () => deps.rpc.getBlockCount(),
    createSorteo: (bloqueCierre) => createSorteo(deps.db.db, bloqueCierre),
    getNextDrawTime: (now) =>
      getNextDrawTime(now, sortedDays, deps.env.SCHEDULE_HOUR, deps.env.SCHEDULE_TIMEZONE),
    estimateBlockAtTime: (targetTime, currentHeight, now) =>
      estimateBlockAtTime(targetTime, currentHeight, now, deps.env.BLOCK_TIME_MS),
    logger: deps.logger,
  };
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps = buildScheduleDeps(deps);
  deps.logger.info("arrancando schedule-worker", {
    intervalMs: deps.env.SCHEDULE_CHECK_INTERVAL_MS,
    days: deps.env.SCHEDULE_DAYS,
    hour: deps.env.SCHEDULE_HOUR,
    timezone: deps.env.SCHEDULE_TIMEZONE,
  });
  runLoop(workerDeps, deps.env.SCHEDULE_CHECK_INTERVAL_MS);
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

- [ ] **Step 4: Run test para verificar que pasa**

Run: `cd /Users/osmanmarin/Desktop/MYLoto && pnpm --filter @myloto/backend test -- --run test/schedule-worker.test.ts 2>&1 | tail -10`
Expected: PASS — los 3 tests del worker pasan.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/workers/schedule-worker.ts apps/backend/test/schedule-worker.test.ts
git commit -m "feat(backend): schedule-worker (crea sorteos automáticamente por calendario) + tests"
```

---

## Task 4: Cuenta regresiva en la home

**Files:**
- Modify: `apps/web/src/components/home/HeroSection.tsx`
- Modify: `apps/web/src/lib/hooks.ts` (añadir `useCountdown`)

- [ ] **Step 1: Añadir hook useCountdown en hooks.ts**

En `apps/web/src/lib/hooks.ts`, al final del archivo, añadir:

```ts
/**
 * Hook que calcula una cuenta regresiva basada en bloques restantes.
 * Consulta el bloque actual cada 60s (via /health) y estima el tiempo.
 */
export function useCountdown(bloqueCierre: number | undefined) {
  const { data: health } = useQuery({
    queryKey: ["health-for-countdown"],
    queryFn: () => fetch(`${BACKEND_URL}/health`).then((r) => r.json()) as Promise<{ node: { blocks: number } }>,
    refetchInterval: 60_000,
    enabled: bloqueCierre !== undefined,
  });

  if (!bloqueCierre || !health) return null;

  const bloquesRestantes = bloqueCierre - health.node.blocks;
  if (bloquesRestantes <= 0) return "Cerrando";

  // 10 min por bloque (600000 ms)
  const msRestantes = bloquesRestantes * 600_000;
  const totalMin = Math.floor(msRestantes / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
```

Y añadir el import de `BACKEND_URL` al inicio de hooks.ts (si no está):
```ts
import { BACKEND_URL } from "./constants";
```

- [ ] **Step 2: Usar useCountdown en HeroSection**

En `apps/web/src/components/home/HeroSection.tsx`, añadir el import:
```tsx
import { useJackpot, useSorteoActivo, useCountdown } from "@/lib/hooks";
```

Y dentro del componente `HeroSection`, después de `const { data: sorteo } = useSorteoActivo();`, añadir:
```tsx
  const countdown = useCountdown(sorteo?.bloqueCierre);
```

Luego reemplazar el bloque que muestra el bloque de cierre:
```tsx
        {sorteo && (
          <div className="flex gap-4 text-sm text-neon-purple mb-6">
            <span>🎫 Sorteo #{sorteo.id} · {sorteo.estado}</span>
            <span>⏱ Bloque {sorteo.bloqueCierre.toLocaleString("es")}</span>
          </div>
        )}
```

por:
```tsx
        {sorteo && (
          <div className="flex gap-4 text-sm text-neon-purple mb-6">
            <span>🎫 Sorteo #{sorteo.id} · {sorteo.estado}</span>
            <span>⏱ Cierra en {countdown ?? "..."}</span>
          </div>
        )}
```

- [ ] **Step 3: Verificar typecheck + build**

Run:
```bash
cd /Users/osmanmarin/Desktop/MYLoto
pnpm --filter @myloto/web typecheck 2>&1 | tail -3
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -5
```
Expected: typecheck limpio, build exitoso.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/hooks.ts apps/web/src/components/home/HeroSection.tsx
git commit -m "feat(web): cuenta regresiva al próximo sorteo en la home"
```

---

## Task 5: Verificación final local

**Files:** (sin cambios)

- [ ] **Step 1: Typecheck completo del workspace**

Run: `cd /Users/osmanmarin/Desktop/MYLoto && pnpm -r typecheck 2>&1 | tail -8`
Expected: Sin errores en todos los packages.

- [ ] **Step 2: Tests completos del backend**

Run: `pnpm --filter @myloto/backend test -- --run 2>&1 | tail -15`
Expected: Todos los tests pasan (health + schedule + schedule-worker + los existentes).

- [ ] **Step 3: Build de producción de web**

Run: `NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -8`
Expected: Build exitoso.

- [ ] **Step 4: Commit si hubo ajustes**

```bash
git add -A
git commit -m "chore: ajustes finales tras verificación de sorteos programados" || echo "nada que commitear"
```

---

## Task 6: Deploy — build backend + systemd services + variables .env

**Files:** (sin cambios locales; deploy en nodo-desktop)

- [ ] **Step 1: Push al remote**

Run: `cd /Users/osmanmarin/Desktop/MYLoto && git push origin main`

- [ ] **Step 2: Deploy en el nodo-desktop: pull + rebuild backend**

```bash
sshpass -p 'Nodo123' ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1 nodo@100.90.169.23 'bash -s' <<'REMOTE'
cd ~/MYLotto
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter @myloto/backend build
echo "Nodo123" | sudo -S systemctl restart myloto-backend
REMOTE
```

- [ ] **Step 3: Añadir variables del scheduler al .env del nodo**

```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'bash -s' <<'REMOTE'
cd ~/MYLotto
# Añadir vars del scheduler si no existen
grep -q "SCHEDULE_DAYS" .env || cat >> .env <<'ENVVARS'

# --- Scheduler de sorteos (calendario semanal) ---
SCHEDULE_DAYS=1,4,6
SCHEDULE_HOUR=20
SCHEDULE_TIMEZONE=America/Bogota
SCHEDULE_CHECK_INTERVAL_MS=60000
BLOCK_TIME_MS=600000
ENVVARS
echo "Variables añadidas al .env"
REMOTE
```

- [ ] **Step 4: Crear 5 servicios systemd para los workers**

```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'bash -s' <<'REMOTE'
# Crear los unit files en /tmp
cat > /tmp/myloto-schedule.service <<'UNIT'
[Unit]
Description=MYLoto Schedule Worker (crea sorteos automáticamente)
After=network-online.target postgresql.service myloto-backend.service
Wants=network-online.target

[Service]
Type=simple
User=nodo
WorkingDirectory=/home/nodo/MYLotto/apps/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/workers/schedule-worker.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/var/log/myloto/schedule.log
StandardError=append:/var/log/myloto/schedule.log

[Install]
WantedBy=multi-user.target
UNIT

cat > /tmp/myloto-lifecycle.service <<'UNIT'
[Unit]
Description=MYLoto Lifecycle Worker (cierra sorteos vencidos)
After=network-online.target postgresql.service myloto-schedule.service
Wants=network-online.target

[Service]
Type=simple
User=nodo
WorkingDirectory=/home/nodo/MYLotto/apps/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/workers/lifecycle-verifier.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/var/log/myloto/lifecycle.log
StandardError=append:/var/log/myloto/lifecycle.log

[Install]
WantedBy=multi-user.target
UNIT

cat > /tmp/myloto-payment.service <<'UNIT'
[Unit]
Description=MYLoto Payment Worker (verifica pagos)
After=network-online.target postgresql.service myloto-lifecycle.service
Wants=network-online.target

[Service]
Type=simple
User=nodo
WorkingDirectory=/home/nodo/MYLotto/apps/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/workers/payment-verifier.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/var/log/myloto/payment.log
StandardError=append:/var/log/myloto/payment.log

[Install]
WantedBy=multi-user.target
UNIT

cat > /tmp/myloto-draw.service <<'UNIT'
[Unit]
Description=MYLoto Draw Worker (calcula combinación ganadora)
After=network-online.target postgresql.service myloto-payment.service
Wants=network-online.target

[Service]
Type=simple
User=nodo
WorkingDirectory=/home/nodo/MYLotto/apps/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/workers/draw-verifier.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/var/log/myloto/draw.log
StandardError=append:/var/log/myloto/draw.log

[Install]
WantedBy=multi-user.target
UNIT

cat > /tmp/myloto-scrutiny.service <<'UNIT'
[Unit]
Description=MYLoto Scrutiny Worker (escruta ganadores)
After=network-online.target postgresql.service myloto-draw.service
Wants=network-online.target

[Service]
Type=simple
User=nodo
WorkingDirectory=/home/nodo/MYLotto/apps/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/workers/scrutiny-verifier.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/var/log/myloto/scrutiny.log
StandardError=append:/var/log/myloto/scrutiny.log

[Install]
WantedBy=multi-user.target
UNIT

echo "Unit files creados en /tmp"
ls -la /tmp/myloto-*.service
REMOTE
```

- [ ] **Step 5: Instalar y arrancar los 5 servicios**

```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'echo "Nodo123" | sudo -S bash -c '"'"'
install -m 644 /tmp/myloto-schedule.service /etc/systemd/system/
install -m 644 /tmp/myloto-lifecycle.service /etc/systemd/system/
install -m 644 /tmp/myloto-payment.service /etc/systemd/system/
install -m 644 /tmp/myloto-draw.service /etc/systemd/system/
install -m 644 /tmp/myloto-scrutiny.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable myloto-schedule myloto-lifecycle myloto-payment myloto-draw myloto-scrutiny
systemctl start myloto-schedule myloto-lifecycle myloto-payment myloto-draw myloto-scrutiny
sleep 3
echo "=== estado de los 8 servicios ==="
systemctl is-active myloto-backend myloto-web myloto-tunnel myloto-schedule myloto-lifecycle myloto-payment myloto-draw myloto-scrutiny
'"'"''
```
Expected: `active` en los 8 servicios.

- [ ] **Step 6: Verificar que el scheduler creó un sorteo**

Esperar ~2 minutos y verificar:
```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'tail -20 /var/log/myloto/schedule.log 2>/dev/null; echo "---"; curl -s http://localhost:3000/sorteos/abierto'
```
Expected: el log muestra "sorteo creado por scheduler" y `/sorteos/abierto` devuelve un sorteo ABIERTO con bloqueCierre estimado para el próximo Lun/Jue/Sáb 20:00.

- [ ] **Step 7: Deploy web (cuenta regresiva)**

```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'bash -s' <<'REMOTE'
cd ~/MYLotto
rm -rf apps/web/.next
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build
echo "Nodo123" | sudo -S systemctl restart myloto-web
REMOTE
```

- [ ] **Step 8: Verificación final en producción**

```bash
curl -sS -o /dev/null -w "Home: HTTP %{http_code}\n" https://lotto.moonyetis.com/
curl -sS https://api-lotto.moonyetis.com/sorteos/abierto
curl -sS https://api-lotto.moonyetis.com/health | head -c 100
```
Expected: Home HTTP 200, sorteo ABIERTO con bloqueCierre, health OK.
