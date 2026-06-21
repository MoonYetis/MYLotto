# Diseño: Motor de Aleatoriedad On-Chain (Ciclo 5)

**Fecha:** 2026-06-21
**Ciclo:** 5 de 8
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)
**Depende de:** Ciclo 1 (config, db, rpc-client, types), Ciclo 4 (patrón worker).

---

## 1. Contexto y Alcance

MYLoto es una lotería Powerball sobre Fractal Bitcoin. La combinación ganadora de cada sorteo debe ser **impredecible antes del cierre** e **inmanipulable por el operador**. Esto se logra derivando la aleatoriedad de **hashes de bloques de Bitcoin** que nadie puede predecir ni controlar, usando un algoritmo **determinista y públicamente verificable**.

### Cómo funciona

Cada sorteo tiene un `bloque_cierre` (N). Después del cierre, se esperan **3 bloques** (N+1, N+2, N+3). Sus hashes se combinan para crear una semilla que alimenta un algoritmo Fisher-Yates, produciendo la combinación ganadora.

```
Sorteo cierra en bloque N
  → esperar N+1, N+2, N+3 (3 bloques minados)
  → semilla = SHA-256(hash(N+1) || hash(N+2) || hash(N+3))
  → Fisher-Yates([1..69], semilla) → primeras 5 = balotas (ordenadas)
  → powerball = próximo PRNG mod 26 + 1
  → persistir combinacion_ganadora + bloques_semilla en DB
  → sorteo pasa a CALCULADO
```

### Objetivos de este ciclo

- Crear `packages/randomness` con el motor criptográfico puro (semilla + PRNG + Fisher-Yates + draw).
- Implementar `services/sorteos.ts` (DB ops Drizzle para capturar sorteos listos y persistir resultados).
- Implementar un worker periódico (`draw-verifier`) que orquesta el cálculo cuando los 3 bloques están disponibles.
- Garantizar verificabilidad pública: dados los 3 hashes de bloque, cualquiera puede reproducir la combinación.

### No incluye este ciclo (explícito)

- **Listener de bloques en tiempo real** — el worker periódico consulta la altura actual del nodo; no escucha eventos de nuevos bloques. Un listener en tiempo real (ej. ZMQ) es optimización del Ciclo 7.
- **Transición `ABIERTO → CERRADO`** — gestionada por el Ciclo 7 (gestión de sorteos). Para testear el worker, los sorteos se marcan CERRADO manualmente.
- **Escrutinio y reparto de premios** — Ciclo 6. Este ciclo solo calcula y persiste la combinación ganadora; no compara contra tickets.
- **Frontend** — Ciclo 8.
- **Demo E2E con nodo real** — pendiente hasta que el nodo termine IBD (~2 días). El motor puro y el worker se testean completamente sin el nodo.

---

## 2. Decisiones Consolidadas

| Decisión | Elección | Justificación |
|---|---|---|
| Alcance | Motor Fisher-Yates puro + orquestación (worker), sin listener real-time | Permite construir y testear todo sin esperar al nodo; el listener real-time es optimización del Ciclo 7 |
| Arquitectura | `packages/randomness` puro + `services/sorteos` + worker en backend | Sigue el patrón de los Ciclos 1-4: dominio en `packages/`, composición en `apps/` |
| Semilla | `SHA-256(hash(N+1) || hash(N+2) || hash(N+3))` | 3 hashes concatenados → SHA-256 → 32 bytes. Imposible de predecir antes de que se minen los 3 bloques |
| Algoritmo | Fisher-Yates shuffle de [1..69], primeras 5 = balotas (ordenadas asc), powerball = PRNG mod 26 + 1 | Estándar, uniforme, auditable |
| PRNG | SHA-256 en modo contador: `SHA256(seed || uint32LE(i))` | Determinista. Dada la misma semilla, produce siempre la misma secuencia. Permite verificación pública |
| Uniformidad | Rejection sampling en `randomInt(n)` | Garantiza distribución uniforme sin sesgo de módulo. Estándar en loterías verificables |
| Disparador | Worker periódico (`pnpm worker:draw`) | Mismo patrón que `payment-verifier` del Ciclo 4. Intervalo configurable |
| Librería cripto | `@noble/hashes` (ya en el proyecto) | Sin dependencias nuevas |

### Estado del sorteo

```
ABIERTO → CERRADO → CALCULADO
```

- `ABIERTO`: acepta tickets (Ciclo 4). La transición a CERRADO la gestiona el Ciclo 7.
- `CERRADO`: pasó el `bloque_cierre`, ya no acepta tickets. Esperando los 3 bloques para calcular.
- `CALCULADO`: se calcularon los hashes y la combinación ganadora está persistida.

Este ciclo implementa la transición `CERRADO → CALCULADO`.

---

## 3. Estructura

```
packages/randomness/                # NUEVO — motor criptográfico puro, determinista
├── src/
│   ├── seed.ts                    # deriveSeed(hashes: BloquesSemilla): Uint8Array
│   ├── prng.ts                    # Sha256CounterPrng + randomInt(n) con rejection
│   ├── fisher-yates.ts            # shuffle() + drawWinningCombination()
│   ├── errors.ts                  # RandomnessError jerarquía
│   └── index.ts                   # exports públicos
├── test/unit/
│   ├── seed.test.ts
│   ├── prng.test.ts
│   ├── fisher-yates.test.ts
│   └── draw.test.ts               # incluye golden vector congelado
├── package.json
├── tsconfig.json
└── vitest.config.ts

apps/backend/
├── src/
│   ├── services/sorteos.ts        # NUEVO — DB ops Drizzle para sorteos
│   └── workers/draw-verifier.ts   # NUEVO — loop periódico
└── test/
    ├── services-sorteos.test.ts
    └── worker-draw-verifier.test.ts
```

**Modifica:**
- `packages/config/src/env.ts` — `DRAW_CHECK_INTERVAL_MS` (default 30000).
- `packages/config/test/env.test.ts` — test de la nueva var.
- `apps/backend/package.json` — dep `@myloto/randomness` + script `worker:draw`.
- `.env.example` — nueva var.

### Principios

- **`packages/randomness`** — dominio puro: sin DB, sin red, sin I/O. Todo determinista. Dada la misma `BloquesSemilla`, produce siempre la misma combinación.
- **`services/sorteos.ts`** — capa de composición: queries Drizzle para encontrar sorteos listos y persistir resultados.
- **`workers/draw-verifier.ts`** — orquestación: RPC (bloques) + DB (sorteos) + randomness (cálculo). Mismo patrón que `payment-verifier`.

---

## 4. `packages/randomness`

### 4.1 `seed.ts`

```typescript
import { sha256 } from "@noble/hashes/sha2";
import type { BloquesSemilla } from "@myloto/types";

/**
 * Deriva una semilla de 32 bytes a partir de los hashes de los 3 bloques
 * post-cierre del sorteo.
 *
 * Semilla = SHA-256(hex(N+1) || hex(N+2) || hex(N+3))
 *
 * La concatenación de hexstrings (192 chars = 3 × 64) se hashea con SHA-256.
 * El resultado es determinista: los mismos 3 hashes producen siempre la misma semilla.
 */
export function deriveSeed(hashes: BloquesSemilla): Uint8Array {
  const data = hashes.n1 + hashes.n2 + hashes.n3;
  return sha256(new TextEncoder().encode(data));
}
```

### 4.2 `prng.ts`

```typescript
import { sha256 } from "@noble/hashes/sha2";

/**
 * PRNG determinista basado en SHA-256 en modo contador.
 *
 * Stream infinito de bytes: block(i) = SHA256(seed || uint32LE(i)).
 * Dada la misma semilla, produce siempre la misma secuencia de números.
 * Esto permite verificación pública: cualquiera con los 3 hashes de bloque
 * puede reproducir la combinación ganadora exacta.
 */
export class Sha256CounterPrng {
  private counter = 0;
  private buffer = new Uint8Array(0);
  private bufferPos = 0;

  constructor(private readonly seed: Uint8Array) {}

  /**
   * Siguiente entero uniforme en [0, maxExclusive).
   * Usa rejection sampling para garantizar distribución uniforme sin sesgo
   * de módulo.
   */
  randomInt(maxExclusive: number): number {
    // El mayor múltiplo de maxExclusive que cabe en uint32.
    // Valores >= limit se descartan para evitar sesgo.
    const limit = Math.floor(0xFFFFFFFF / maxExclusive) * maxExclusive;
    for (;;) {
      const val = this.nextUint32();
      if (val < limit) return val % maxExclusive;
    }
  }

  private nextUint32(): number {
    if (this.bufferPos + 4 > this.buffer.length) {
      this.refill();
    }
    const view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset + this.bufferPos,
      4,
    );
    this.bufferPos += 4;
    return view.getUint32(0, true); // little-endian
  }

  private refill(): void {
    const counterBytes = new Uint8Array(4);
    new DataView(counterBytes.buffer).setUint32(0, this.counter++, true);
    const input = new Uint8Array(this.seed.length + counterBytes.length);
    input.set(this.seed, 0);
    input.set(counterBytes, this.seed.length);
    this.buffer = sha256(input);
    this.bufferPos = 0;
  }
}
```

### 4.3 `fisher-yates.ts`

```typescript
import type { CombinacionGanadora } from "@myloto/types";
import type { Sha256CounterPrng } from "./prng.js";

/**
 * Fisher-Yates (variante Durstenfeld) shuffle in-place sobre una copia.
 * Produce una permutación uniforme usando el PRNG inyectado.
 */
export function shuffle<T>(
  arr: readonly T[],
  prng: Sha256CounterPrng,
): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = prng.randomInt(i + 1);
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

/**
 * Genera la combinación ganadora de un sorteo.
 *
 * 1. Fisher-Yates shuffle de [1..69] usando el PRNG.
 * 2. Primeras 5 posiciones → balotas (ordenadas asc, sin repetir).
 * 3. Powerball = siguiente randomInt(26) + 1 → [1..26].
 *
 * Determinista: dado el mismo PRNG (misma semilla), produce siempre el mismo
 * resultado.
 */
export function drawWinningCombination(
  prng: Sha256CounterPrng,
): CombinacionGanadora {
  const pool = Array.from({ length: 69 }, (_, i) => i + 1); // [1..69]
  const shuffled = shuffle(pool, prng);
  const balotas = shuffled.slice(0, 5).sort((a, b) => a - b);
  // Type assertion segura: slice(0,5) siempre devuelve 5 elementos.
  const powerball = prng.randomInt(26) + 1;
  return {
    balotas: [balotas[0]!, balotas[1]!, balotas[2]!, balotas[3]!, balotas[4]!],
    powerball,
  };
}
```

### 4.4 `errors.ts`

```typescript
/**
 * Jerarquía de errores del motor de aleatoriedad.
 */
export class RandomnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RandomnessError";
  }
}

/** Reservada para futuras validaciones (ej. hashes malformados). */
export class InvalidSeedError extends RandomnessError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSeedError";
  }
}
```

---

## 5. Backend — Services y Worker

### 5.1 `apps/backend/src/services/sorteos.ts`

```typescript
import { eq, and, lte } from "drizzle-orm";
import { sorteos, type Database, type Sorteo } from "@myloto/db";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";

/**
 * Sorteos en estado CERRADO cuyos 3 bloques post-cierre ya están disponibles.
 * Un sorteo está "ready" cuando bloque_cierre + 3 <= currentHeight.
 */
export async function getClosedSorteosReady(
  db: Database,
  currentHeight: number,
): Promise<Sorteo[]> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(
      and(
        eq(sorteos.estado, "CERRADO"),
        lte(sorteos.bloqueCierre, BigInt(currentHeight - 3)),
      ),
    );
  return rows as Sorteo[];
}

/**
 * Persiste la combinación ganadora + los hashes de los 3 bloques semilla.
 */
export async function saveSorteoResult(
  db: Database,
  sorteoId: number,
  combinacion: CombinacionGanadora,
  bloques: BloquesSemilla,
): Promise<void> {
  await db
    .update(sorteos)
    .set({
      combinacionGanadora: combinacion,
      bloquesSemilla: bloques,
    })
    .where(eq(sorteos.id, BigInt(sorteoId)));
}

/**
 * Transición CERRADO → CALCULADO. Idempotente (WHERE estado='CERRADO').
 */
export async function markCalculated(
  db: Database,
  sorteoId: number,
): Promise<void> {
  await db
    .update(sorteos)
    .set({ estado: "CALCULADO" })
    .where(and(eq(sorteos.id, BigInt(sorteoId)), eq(sorteos.estado, "CERRADO")));
}
```

### 5.2 `apps/backend/src/workers/draw-verifier.ts`

```typescript
export interface DrawWorkerDeps {
  getBlockCount: () => Promise<number>;
  getReadySorteos: (height: number) => Promise<SorteoConBloque[]>;
  getBlockHash: (height: number) => Promise<string>;
  saveResult: (
    id: number,
    combinacion: CombinacionGanadora,
    bloques: BloquesSemilla,
  ) => Promise<void>;
  markCalculated: (id: number) => Promise<void>;
  logger: Logger;
}

/** Una ronda del worker de sorteos. Exportada para tests. */
export async function runRound(
  deps: DrawWorkerDeps,
): Promise<{ checked: number; drawn: number }> {
  const height = await deps.getBlockCount();
  const sorteos = await deps.getReadySorteos(height);
  let drawn = 0;

  for (const sorteo of sorteos) {
    try {
      const base = Number(sorteo.bloqueCierre);
      const n1 = await deps.getBlockHash(base + 1);
      const n2 = await deps.getBlockHash(base + 2);
      const n3 = await deps.getBlockHash(base + 3);

      const seed = deriveSeed({ n1, n2, n3 });
      const prng = new Sha256CounterPrng(seed);
      const combinacion = drawWinningCombination(prng);

      await deps.saveResult(Number(sorteo.id), combinacion, { n1, n2, n3 });
      await deps.markCalculated(Number(sorteo.id));
      drawn++;
      deps.logger.info("sorteo calculado", {
        id: Number(sorteo.id),
        combinacion,
      });
    } catch (err) {
      deps.logger.warn("cálculo de sorteo falló", {
        id: Number(sorteo.id),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return { checked: sorteos.length, drawn };
}

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). Mismo patrón que payment-verifier. */
export function runLoop(deps: DrawWorkerDeps, intervalMs: number): void;

/** main() con guard import.meta.url. */
async function main(): Promise<void>;
```

**Script npm:** `"worker:draw": "tsx src/workers/draw-verifier.ts"` en `apps/backend/package.json`.

**Configuración:** el worker usa `DRAW_CHECK_INTERVAL_MS` (env, default 30000) y el RPC general del nodo (sin `walletName`, porque `getBlockCount`/`getBlockHash` no son llamadas de wallet).

---

## 6. Integración con `@myloto/config`

### Nueva variable de entorno

```typescript
DRAW_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
```

`.env.example`:
```bash
# --- Worker de cálculo de sorteos (Ciclo 5) ---
DRAW_CHECK_INTERVAL_MS=30000
```

---

## 7. Tests

### 7.1 `packages/randomness` (unitarios, deterministas)

**`seed.test.ts`** (~3 tests):
- `deriveSeed` devuelve 32 bytes.
- Misma `BloquesSemilla` → misma semilla (determinismo).
- Cambiar un hash → semilla distinta (avalanche).

**`prng.test.ts`** (~4 tests):
- `randomInt(n)` produce valores en [0, n) siempre.
- Misma semilla → misma secuencia (determinismo).
- Distinta semilla → secuencia distinta.
- Uniformidad: 69000 samples en [0,69) → cada bucket ~1000 ± 5%.

**`fisher-yates.test.ts`** (~3 tests):
- `shuffle` preserva los elementos (es una permutación).
- `shuffle` con PRNG fijo → resultado determinista.
- `shuffle` de array vacío/de 1 elemento → no rompe.

**`draw.test.ts`** (~5 tests):
- **Golden vector congelado:** 3 hashes sintéticos conocidos → combinación esperada exacta. Se calcula al implementar y se congela.
- Misma semilla → misma combinación (determinismo).
- Cambiar un hash → combinación distinta (avalanche).
- Balotas en rango [1,69], ordenadas asc, sin repetir.
- Powerball en rango [1,26].

### 7.2 Backend (unitarios con stubs)

**`services-sorteos.test.ts`** (~3 tests): `getClosedSorteosReady` filtra por estado+CERRADO+altura, `saveSorteoResult` actualiza, `markCalculated` transiciona idempotente.

**`worker-draw-verifier.test.ts`** (~4 tests): `runRound` sin sorteos → `{0,0}`, con sorteo ready + stubs → calcula y persiste, error individual no mata el round, idempotencia (sorteo ya CALCULADO no se recalcula — el `getReadySorteos` solo devuelve CERRADO).

### 7.3 Integración (opcional, `RUN_INTEGRATION=1`)

Con nodo sincronizado: crear sorteo CERRADO con bloque_cierre real, arrancar worker, verificar combinación persistida reproducible.

---

## 8. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `pnpm install` sin errores | OK |
| 2 | `pnpm --filter @myloto/randomness typecheck` | Exit 0 |
| 3 | `pnpm --filter @myloto/randomness test` (unitarios) | Todos pasan (~15) |
| 4 | `pnpm --filter @myloto/backend test` (unitarios) | Todos pasan (~7 nuevos) |
| 5 | `pnpm -r test` (todos los paquetes) | Todo verde |
| 6 | `pnpm -r typecheck` (todos los paquetes) | Todo verde |
| 7 | Golden vector: hashes conocidos → combinación reproducible | Vector congelado en test |
| 8 | Demo E2E con nodo real | ⏳ Pendiente hasta que el nodo sincronice |

---

## 9. Decisiones de Diseño Clave (resumen)

1. **Motor 100% determinista y puro** — sin DB, sin red, sin I/O. Dada la misma `BloquesSemilla`, `drawWinningCombination` produce siempre el mismo resultado. Esto permite verificación pública: cualquier usuario puede reproducir la combinación dado los 3 hashes de bloque.

2. **Semilla de 3 hashes concatenados** — usar 3 bloques (no 1) protege contra reorgs de hasta 2 bloques y reduce la viabilidad de ataques de minería selfish.

3. **Rejection sampling en `randomInt`** — garantiza distribución uniforme sin sesgo de módulo. Estándar en loterías verificables. El coste en bytes consumidos es despreciable.

4. **PRNG con SHA-256 contador** — simple, auditable, determinista. No requiere un CSPRNG estándar (overkill) porque la entropía ya viene de los hashes de bloque (impredecibles).

5. **Golden vector congelado** — un test con hashes sintéticos conocidos y resultado esperado exacto. Cualquier cambio accidental al algoritmo lo rompe, protegiendo la integridad del motor criptográfico.

6. **Worker separado del servidor** — mismo patrón que `payment-verifier` (Ciclo 4). Robustez operacional.

7. **`getClosedSorteosReady` filtra en SQL** — la query combina `estado='CERRADO' AND bloque_cierre <= currentHeight - 3` en la DB, evitando traer sorteos que aún no están listos.

8. **Idempotencia** — `markCalculated` usa `WHERE estado='CERRADO'`, y `getReadySorteos` solo devuelve CERRADO. Un sorteo CALCULADO nunca se recalcula.

9. **Sin dependencias nuevas** — `@noble/hashes` ya está en el proyecto (vía `packages/crypto`). `randomness` no depende de `db`, `rpc-client`, ni de ninguna infraestructura.

---

## 10. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Reorg de blockchain cambia los hashes después del cálculo | Muy baja (3+ confirmaciones) | Alto (combinación inválida) | Usar 3 bloques da 3 confirmaciones; reorgs de >3 bloques son extremadamente raras en Bitcoin. Si ocurre, el resultado se recalcularía con los nuevos hashes |
| Sesgo en la distribución del PRNG | Baja | Alto (sorteo injusto) | Rejection sampling garantiza uniformidad. Test estadístico en CI verifica distribución |
| Bug en Fisher-Yates produce permutación no uniforme | Baja | Alto | Implementación estándar de Durstenfeld; test de permutación verifica que preserva elementos |
| Nodo no sincronizado al cierre del sorteo | Media (ahora) | Medio | El worker reintenta en cada ronda; cuando el nodo alcance la altura, calcula. No se pierde información |
| Cambio accidental del algoritmo en refactor futuro | Baja | Alto | Golden vector congelado rompe el test si el algoritmo cambia |
| `getBlockHash` devuelve hash de un bloque que luego se reorg | Muy baja | Medio | 3 bloques de espera + la profundidad de confirmación del nodo |

---

## 11. Próximos Ciclos (Roadmap actualizado)

1. ✅ **Ciclo 1:** Fundación + Cliente RPC
2. ✅ **Ciclo 2:** Derivación HD + QR
3. ✅ **Ciclo 3:** `packages/brc20` — cliente UniSat + descuento
4. ✅ **Ciclo 4:** Motor de pagos híbrido + compra de tickets
5. 🔄 **Ciclo 5:** Motor de aleatoriedad on-chain (este spec)
6. **Ciclo 6:** Escrutinio y reparto de premios — compara tickets contra `combinacion_ganadora`
7. **Ciclo 7:** Backend completo — gestión de sorteos (ABIERTO→CERRADO), listener real-time, orquestación
8. **Ciclo 8:** Frontend Next.js
