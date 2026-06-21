# Motor de Aleatoriedad On-Chain — Plan de Implementación (Ciclo 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `packages/randomness` (semilla SHA-256 + PRNG determinista + Fisher-Yates + draw) y un worker `draw-verifier` que calcula combinaciones ganadoras de sorteos CERRADO cuyos 3 bloques post-cierre ya existen.

**Architecture:** Paquete `@myloto/randomness` (motor criptográfico puro, determinista, testeable sin red/DB) + `services/sorteos.ts` (DB ops Drizzle) + `workers/draw-verifier.ts` (orquestación RPC+DB+randomness). TDD estricto, un commit por tarea.

**Tech Stack:** TypeScript 5 estricto (`exactOptionalPropertyTypes: true`), `@noble/hashes` (SHA-256), Drizzle ORM, Fastify, Vitest. Reusa `@myloto/config`, `@myloto/db`, `@myloto/rpc-client`, `@myloto/types`.

**Spec de referencia:** `docs/superpowers/specs/2026-06-21-randomness-engine-design.md`

---

## File Structure

```
packages/randomness/                    # NUEVO
├── src/
│   ├── seed.ts                        # deriveSeed(hashes: BloquesSemilla): Uint8Array
│   ├── prng.ts                        # Sha256CounterPrng + randomInt(n)
│   ├── fisher-yates.ts                # shuffle() + drawWinningCombination()
│   ├── errors.ts                      # RandomnessError + InvalidSeedError
│   └── index.ts
├── test/unit/
│   ├── seed.test.ts
│   ├── prng.test.ts
│   ├── fisher-yates.test.ts
│   └── draw.test.ts                   # incluye golden vector congelado
├── package.json
├── tsconfig.json
└── vitest.config.ts

apps/backend/
├── src/
│   ├── services/sorteos.ts            # NUEVO — DB ops Drizzle
│   └── workers/draw-verifier.ts       # NUEVO — loop periódico
└── test/
    ├── services-sorteos.test.ts
    └── worker-draw-verifier.test.ts
```

**Modifica:**
- `packages/config/src/env.ts` — `DRAW_CHECK_INTERVAL_MS` (default 30000).
- `packages/config/test/env.test.ts` — test de la nueva var.
- `apps/backend/package.json` — dep `@myloto/randomness` + script `worker:draw`.
- `apps/backend/test/health.test.ts` + `routes-tickets.test.ts` — añadir `DRAW_CHECK_INTERVAL_MS` a los mocks de env.
- `.env.example` — nueva var.

---

## Task 1: Esqueleto del paquete `packages/randomness`

**Objetivo:** Estructura mínima con `pnpm install` funcionando.

**Files:**
- Create: `packages/randomness/package.json`
- Create: `packages/randomness/tsconfig.json`
- Create: `packages/randomness/vitest.config.ts`

- [ ] **Step 1: Crear `packages/randomness/package.json`**

```json
{
  "name": "@myloto/randomness",
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
    "@noble/hashes": "^1.6.0",
    "@myloto/types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

> Nota: a diferencia de `@myloto/payments` (dominio puro sin deps), `randomness` sí depende de `@noble/hashes` (SHA-256) y `@myloto/types` (tipos `BloquesSemilla`, `CombinacionGanadora`).

- [ ] **Step 2: Crear `packages/randomness/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Crear `packages/randomness/vitest.config.ts`**

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
git add packages/randomness pnpm-lock.yaml
git commit -m "chore(randomness): esqueleto del paquete @myloto/randomness"
```

---

## Task 2: Errores tipados (TDD)

**Objetivo:** Jerarquía `RandomnessError`.

**Files:**
- Create: `packages/randomness/src/errors.ts`
- Create: `packages/randomness/src/index.ts` (placeholder)
- Create: `packages/randomness/test/unit/errors.test.ts`

- [ ] **Step 1: Escribir test que FALLARÁ (`packages/randomness/test/unit/errors.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import { RandomnessError, InvalidSeedError } from "../../src/errors.js";

describe("errores randomness", () => {
  it("RandomnessError guarda message", () => {
    const err = new RandomnessError("boom");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("RandomnessError");
  });

  it("InvalidSeedError extiende RandomnessError", () => {
    const err = new InvalidSeedError("bad seed");
    expect(err).toBeInstanceOf(RandomnessError);
    expect(err.message).toBe("bad seed");
    expect(err.name).toBe("InvalidSeedError");
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `pnpm --filter @myloto/randomness test`
Expected: FAIL con "Cannot find module '../../src/errors.js'".

- [ ] **Step 3: Implementar `packages/randomness/src/errors.ts`**

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

- [ ] **Step 4: Crear `packages/randomness/src/index.ts` (placeholder)**

```typescript
export * from "./errors.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/randomness test`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/randomness
git commit -m "feat(randomness): jerarquía RandomnessError"
```

---

## Task 3: `deriveSeed` (TDD)

**Objetivo:** Función pura que deriva la semilla de 3 hashes de bloque.

**Files:**
- Create: `packages/randomness/test/unit/seed.test.ts`
- Create: `packages/randomness/src/seed.ts`
- Modify: `packages/randomness/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect } from "vitest";
import { deriveSeed } from "../../src/seed.js";
import type { BloquesSemilla } from "@myloto/types";

const HASHES: BloquesSemilla = {
  n1: "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
  n2: "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222",
  n3: "cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333",
};

describe("deriveSeed", () => {
  it("devuelve 32 bytes (SHA-256)", () => {
    const seed = deriveSeed(HASHES);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(32);
  });

  it("misma BloquesSemilla → misma semilla (determinismo)", () => {
    const s1 = deriveSeed(HASHES);
    const s2 = deriveSeed(HASHES);
    expect(Array.from(s1)).toEqual(Array.from(s2));
  });

  it("cambiar un hash → semilla distinta (avalanche)", () => {
    const modified: BloquesSemilla = { ...HASHES, n3: "ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000" };
    const s1 = deriveSeed(HASHES);
    const s2 = deriveSeed(modified);
    expect(Array.from(s1)).not.toEqual(Array.from(s2));
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/randomness test`
Expected: FAIL con "Cannot find module '../../src/seed.js'".

- [ ] **Step 3: Implementar `packages/randomness/src/seed.ts`**

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
 * Determinista: los mismos 3 hashes producen siempre la misma semilla.
 */
export function deriveSeed(hashes: BloquesSemilla): Uint8Array {
  const data = hashes.n1 + hashes.n2 + hashes.n3;
  return sha256(new TextEncoder().encode(data));
}
```

- [ ] **Step 4: Actualizar `packages/randomness/src/index.ts`**

```typescript
export * from "./errors.js";
export { deriveSeed } from "./seed.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/randomness test`
Expected: 3 seed + 2 errors = 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/randomness
git commit -m "feat(randomness): deriveSeed SHA-256 de 3 hashes de bloque"
```

---

## Task 4: `Sha256CounterPrng` (TDD)

**Objetivo:** PRNG determinista con rejection sampling.

**Files:**
- Create: `packages/randomness/test/unit/prng.test.ts`
- Create: `packages/randomness/src/prng.ts`
- Modify: `packages/randomness/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect } from "vitest";
import { Sha256CounterPrng } from "../../src/prng.js";

describe("Sha256CounterPrng", () => {
  it("randomInt(n) produce valores en [0, n)", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    for (let i = 0; i < 10000; i++) {
      const v = prng.randomInt(69);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(69);
    }
  });

  it("misma semilla → misma secuencia (determinismo)", () => {
    const seed = new Uint8Array(32).fill(42);
    const a = new Sha256CounterPrng(seed);
    const b = new Sha256CounterPrng(seed);
    const seqA = Array.from({ length: 100 }, () => a.randomInt(69));
    const seqB = Array.from({ length: 100 }, () => b.randomInt(69));
    expect(seqA).toEqual(seqB);
  });

  it("distinta semilla → secuencia distinta", () => {
    const a = new Sha256CounterPrng(new Uint8Array(32).fill(1));
    const b = new Sha256CounterPrng(new Uint8Array(32).fill(2));
    const seqA = Array.from({ length: 10 }, () => a.randomInt(69));
    const seqB = Array.from({ length: 10 }, () => b.randomInt(69));
    expect(seqA).not.toEqual(seqB);
  });

  it("distribución uniforme (69000 samples en [0,69))", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    const counts = new Array(69).fill(0);
    for (let i = 0; i < 69000; i++) counts[prng.randomInt(69)]++;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    // Cada bucket debería tener ~1000 ± 5% (rejection sampling).
    expect(max - min).toBeLessThan(100); // < 10% del esperado (1000)
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/randomness test`
Expected: FAIL con "Cannot find module '../../src/prng.js'".

- [ ] **Step 3: Implementar `packages/randomness/src/prng.ts`**

```typescript
import { sha256 } from "@noble/hashes/sha2";

/**
 * PRNG determinista basado en SHA-256 en modo contador.
 *
 * Stream infinito de bytes: block(i) = SHA256(seed || uint32LE(i)).
 * Dada la misma semilla, produce siempre la misma secuencia de números.
 */
export class Sha256CounterPrng {
  private counter = 0;
  private buffer = new Uint8Array(0);
  private bufferPos = 0;

  constructor(private readonly seed: Uint8Array) {}

  /**
   * Siguiente entero uniforme en [0, maxExclusive).
   * Rejection sampling: descarta valores >= limit para evitar sesgo de módulo.
   */
  randomInt(maxExclusive: number): number {
    const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
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

- [ ] **Step 4: Actualizar `packages/randomness/src/index.ts`**

```typescript
export * from "./errors.js";
export { deriveSeed } from "./seed.js";
export { Sha256CounterPrng } from "./prng.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/randomness test`
Expected: 4 prng + 3 seed + 2 errors = 9 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/randomness
git commit -m "feat(randomness): Sha256CounterPrng con rejection sampling"
```

---

## Task 5: `shuffle` + `drawWinningCombination` (TDD)

**Objetivo:** Fisher-Yates + generación de combinación ganadora.

**Files:**
- Create: `packages/randomness/test/unit/fisher-yates.test.ts`
- Create: `packages/randomness/test/unit/draw.test.ts`
- Create: `packages/randomness/src/fisher-yates.ts`
- Modify: `packages/randomness/src/index.ts`

- [ ] **Step 1: Escribir tests de shuffle que FALLARÁN**

```typescript
import { describe, it, expect } from "vitest";
import { shuffle } from "../../src/fisher-yates.js";
import { Sha256CounterPrng } from "../../src/prng.js";

describe("shuffle", () => {
  it("preserva los elementos (es una permutación)", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = shuffle(input, prng);
    expect(result.sort((a, b) => a - b)).toEqual(input);
  });

  it("determinista: mismo PRNG → mismo resultado", () => {
    const a = new Sha256CounterPrng(new Uint8Array(32).fill(7));
    const b = new Sha256CounterPrng(new Uint8Array(32).fill(7));
    const input = Array.from({ length: 69 }, (_, i) => i + 1);
    expect(shuffle(input, a)).toEqual(shuffle(input, b));
  });

  it("no rompe con array vacío o de 1 elemento", () => {
    const prng = new Sha256CounterPrng(new Uint8Array(32));
    expect(shuffle([], prng)).toEqual([]);
    expect(shuffle([42], prng)).toEqual([42]);
  });
});
```

- [ ] **Step 2: Implementar `packages/randomness/src/fisher-yates.ts`**

```typescript
import type { CombinacionGanadora } from "@myloto/types";
import type { Sha256CounterPrng } from "./prng.js";

/**
 * Fisher-Yates (variante Durstenfeld) shuffle sobre una copia.
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
 * 1. Fisher-Yates shuffle de [1..69].
 * 2. Primeras 5 posiciones → balotas (ordenadas asc).
 * 3. Powerball = siguiente randomInt(26) + 1 → [1..26].
 */
export function drawWinningCombination(
  prng: Sha256CounterPrng,
): CombinacionGanadora {
  const pool = Array.from({ length: 69 }, (_, i) => i + 1);
  const shuffled = shuffle(pool, prng);
  const balotas = shuffled.slice(0, 5).sort((a, b) => a - b);
  const powerball = prng.randomInt(26) + 1;
  return {
    balotas: [balotas[0]!, balotas[1]!, balotas[2]!, balotas[3]!, balotas[4]!],
    powerball,
  };
}
```

- [ ] **Step 3: Actualizar `packages/randomness/src/index.ts`**

```typescript
export * from "./errors.js";
export { deriveSeed } from "./seed.js";
export { Sha256CounterPrng } from "./prng.js";
export { shuffle, drawWinningCombination } from "./fisher-yates.js";
```

- [ ] **Step 4: Correr tests de shuffle para verificar que pasan**

Run: `pnpm --filter @myloto/randomness test`
Expected: 3 fisher-yates + 4 prng + 3 seed + 2 errors = 12 PASS.

- [ ] **Step 5: Escribir tests de `drawWinningCombination` que FALLARÁN (`draw.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import { drawWinningCombination } from "../../src/fisher-yates.js";
import { deriveSeed } from "../../src/seed.js";
import { Sha256CounterPrng } from "../../src/prng.js";
import type { BloquesSemilla } from "@myloto/types";

const HASHES: BloquesSemilla = {
  n1: "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
  n2: "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222",
  n3: "cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333",
};

function drawFromHashes(h: BloquesSemilla) {
  return drawWinningCombination(
    new Sha256CounterPrng(deriveSeed(h)),
  );
}

describe("drawWinningCombination", () => {
  it("balotas en rango [1,69], ordenadas asc, sin repetir", () => {
    const { balotas } = drawFromHashes(HASHES);
    expect(balotas.length).toBe(5);
    for (const b of balotas) {
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(69);
    }
    // Ordenadas asc
    for (let i = 1; i < 5; i++) {
      expect(balotas[i]).toBeGreaterThan(balotas[i - 1]!);
    }
  });

  it("powerball en rango [1,26]", () => {
    const { powerball } = drawFromHashes(HASHES);
    expect(powerball).toBeGreaterThanOrEqual(1);
    expect(powerball).toBeLessThanOrEqual(26);
  });

  it("determinista: misma semilla → misma combinación", () => {
    expect(drawFromHashes(HASHES)).toEqual(drawFromHashes(HASHES));
  });

  it("avalanche: cambiar un hash → combinación distinta", () => {
    const modified: BloquesSemilla = {
      ...HASHES,
      n3: "ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000",
    };
    expect(drawFromHashes(HASHES)).not.toEqual(drawFromHashes(modified));
  });

  it("GOLDEN VECTOR: hashes conocidos → combinación esperada exacta", () => {
    // Este expected se calcula en el Step 6 y se congela aquí.
    // PROTEGER: cualquier cambio al algoritmo debe romper este test.
    const result = drawFromHashes(HASHES);
    // Reemplazar el comment de abajo con los valores reales tras correr el Step 6.
    expect(result).toEqual({
      balotas: [GOLDEN_BALOTAS], // TODO: rellenar en Step 6
      powerball: GOLDEN_POWERBALL, // TODO: rellenar en Step 6
    });
  });
});
```

> **Nota importante sobre el golden vector:** el test del Step 5 TIENE placeholders (`GOLDEN_BALOTAS`, `GOLDEN_POWERBALL`) intencionalmente. El Step 6 los reemplaza con valores reales. Esto NO es un "placeholder prohibido" del plan — es la técnica documentada en el spec §4/§7 para congelar el vector: primero implementas, luego capturas el resultado exacto, luego lo congelas en el test.

- [ ] **Step 6: Capturar el golden vector**

Ejecutar un script temporal para obtener los valores exactos:

```bash
cd packages/randomness && node -e "
import('{SHAPED_SEED}').then(async () => {
  const { deriveSeed } = await import('./src/seed.js');
  const { Sha256CounterPrng } = await import('./src/prng.js');
  const { drawWinningCombination } = await import('./src/fisher-yates.js');
  const H = { n1: 'aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111', n2: 'bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222', n3: 'cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333' };
  const r = drawWinningCombination(new Sha256CounterPrng(deriveSeed(H)));
  console.log(JSON.stringify(r));
});
"
```

Si el one-liner no funciona con ESM, crear `packages/randomness/scripts/capture-golden.ts`:

```typescript
import { deriveSeed } from "../src/seed.js";
import { Sha256CounterPrng } from "../src/prng.js";
import { drawWinningCombination } from "../src/fisher-yates.js";

const H = {
  n1: "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111",
  n2: "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222",
  n3: "cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333cccc3333",
};
const r = drawWinningCombination(new Sha256CounterPrng(deriveSeed(H)));
console.log(JSON.stringify(r));
```

Ejecutar: `cd packages/randomness && npx tsx scripts/capture-golden.ts`

Tomar el output (ej. `{"balotas":[12,31,44,57,63],"powerball":8}`) y reemplazar los placeholders en `draw.test.ts`:

```typescript
  it("GOLDEN VECTOR: hashes conocidos → combinación esperada exacta", () => {
    const result = drawFromHashes(HASHES);
    expect(result).toEqual({
      balotas: [12, 31, 44, 57, 63], // ← valores reales del output
      powerball: 8,                    // ← valor real del output
    });
  });
```

Borrar el script temporal: `rm -f packages/randomness/scripts/capture-golden.ts && rmdir packages/randomness/scripts 2>/dev/null`

- [ ] **Step 7: Correr todos los tests para verificar que pasan**

Run: `pnpm --filter @myloto/randomness test`
Expected: 5 draw + 3 fisher-yates + 4 prng + 3 seed + 2 errors = 17 PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/randomness
git commit -m "feat(randomness): shuffle Fisher-Yates + drawWinningCombination con golden vector"
```

---

## Task 6: Variable de entorno `DRAW_CHECK_INTERVAL_MS` (TDD)

**Objetivo:** Añadir la var de config para el intervalo del worker de sorteos.

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/test/env.test.ts`
- Modify: `.env.example`
- Modify: `apps/backend/test/health.test.ts` (mock env)
- Modify: `apps/backend/test/routes-tickets.test.ts` (mock env)

- [ ] **Step 1: Añadir test que FALLARÁ en `packages/config/test/env.test.ts`**

Dentro de `describe("loadEnv")`, antes del cierre:

```typescript
  it("acepta DRAW_CHECK_INTERVAL_MS custom", () => {
    const env = loadEnv({ ...valid, DRAW_CHECK_INTERVAL_MS: "60000" });
    expect(env.DRAW_CHECK_INTERVAL_MS).toBe(60000);
  });

  it("aplica default DRAW_CHECK_INTERVAL_MS = 30000", () => {
    const env = loadEnv({ ...valid });
    expect(env.DRAW_CHECK_INTERVAL_MS).toBe(30000);
  });
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/config test`
Expected: FAIL — los tests nuevos referencian `DRAW_CHECK_INTERVAL_MS` que no existe.

- [ ] **Step 3: Añadir a `packages/config/src/env.ts`**

Después del bloque `PAYMENT_MIN_CONFIRMATIONS`, antes del cierre del `z.object`:

```typescript
  // --- Worker de cálculo de sorteos (Ciclo 5) ---
  DRAW_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
```

- [ ] **Step 4: Añadir a `.env.example`**

Después del bloque de worker de pagos:

```bash
# --- Worker de cálculo de sorteos (Ciclo 5) ---
DRAW_CHECK_INTERVAL_MS=30000
```

- [ ] **Step 5: Actualizar mocks de env en tests del backend**

En `apps/backend/test/health.test.ts` y `apps/backend/test/routes-tickets.test.ts`, en el objeto `env` del mock, después de `PAYMENT_MIN_CONFIRMATIONS: 1,` añadir:

```typescript
      DRAW_CHECK_INTERVAL_MS: 30000,
```

(En health.test.ts va después de `FRACTAL_RPC_WALLET: "",`. En routes-tickets.test.ts también después de `FRACTAL_RPC_WALLET: "",`.)

- [ ] **Step 6: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/config test`
Expected: 2 nuevos + 22 existentes = 24 PASS.

Run: `pnpm --filter @myloto/backend test`
Expected: 24 PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/config .env.example apps/backend/test
git commit -m "feat(config): DRAW_CHECK_INTERVAL_MS para worker de sorteos (Ciclo 5)"
```

---

## Task 7: `services/sorteos.ts` — DB ops (TDD)

**Objetivo:** Operaciones Drizzle para capturar sorteos listos y persistir resultados.

**Files:**
- Create: `apps/backend/test/services-sorteos.test.ts`
- Create: `apps/backend/src/services/sorteos.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { Database } from "@myloto/db";
import {
  getClosedSorteosReady,
  saveSorteoResult,
  markCalculated,
} from "../src/services/sorteos.js";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";

function mockDb(overrides: Partial<{
  selectWhere: ReturnType<typeof vi.fn>;
  updateSetWhere: ReturnType<typeof vi.fn>;
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
  } as unknown as Database;
}

describe("services/sorteos", () => {
  it("getClosedSorteosReady devuelve sorteos filtrados", async () => {
    const sorteo = { id: 1n, bloqueCierre: 100, estado: "CERRADO" };
    const db = mockDb({ selectWhere: vi.fn().mockResolvedValue([sorteo]) });
    const result = await getClosedSorteosReady(db, 103);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1n);
  });

  it("getClosedSorteosReady devuelve [] si ninguno listo", async () => {
    const db = mockDb({ selectWhere: vi.fn().mockResolvedValue([]) });
    expect(await getClosedSorteosReady(db, 103)).toEqual([]);
  });

  it("saveSorteoResult llama a update sin lanzar", async () => {
    const db = mockDb();
    const comb: CombinacionGanadora = { balotas: [1, 2, 3, 4, 5], powerball: 6 };
    const bloques: BloquesSemilla = { n1: "h1", n2: "h2", n3: "h3" };
    await expect(saveSorteoResult(db, 1, comb, bloques)).resolves.toBeUndefined();
  });

  it("markCalculated llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(markCalculated(db, 1)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/services/sorteos.js'".

- [ ] **Step 3: Implementar `apps/backend/src/services/sorteos.ts`**

```typescript
import { eq, and, lte } from "drizzle-orm";
import { sorteos, type Database, type Sorteo } from "@myloto/db";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";

/**
 * Sorteos en estado CERRADO cuyos 3 bloques post-cierre ya están disponibles.
 * Ready cuando bloque_cierre + 3 <= currentHeight, ie bloque_cierre <= currentHeight - 3.
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
        lte(sorteos.bloqueCierre, currentHeight - 3),
      ),
    );
  return rows as Sorteo[];
}

/** Persiste la combinación ganadora + los hashes de los 3 bloques semilla. */
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
      calculadoEn: new Date(),
    })
    .where(eq(sorteos.id, BigInt(sorteoId)));
}

/** Transición CERRADO → CALCULADO. Idempotente (WHERE estado='CERRADO'). */
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

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 4 services-sorteos + 24 existentes = 28 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): services/sorteos con DB ops (getClosedSorteosReady, saveResult, markCalculated)"
```

---

## Task 8: Worker `draw-verifier` (TDD)

**Objetivo:** Worker que calcula combinaciones ganadoras.

**Files:**
- Create: `apps/backend/test/worker-draw-verifier.test.ts`
- Create: `apps/backend/src/workers/draw-verifier.ts`
- Modify: `apps/backend/package.json` (dep `@myloto/randomness` + script `worker:draw`)

- [ ] **Step 1: Añadir dep `@myloto/randomness` y script al `apps/backend/package.json`**

En `dependencies` añadir:
```json
    "@myloto/randomness": "workspace:*",
```

En `scripts` añadir (después de `worker:payments`):
```json
    "worker:draw": "tsx src/workers/draw-verifier.ts",
```

Ejecutar `pnpm install`.

- [ ] **Step 2: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/draw-verifier.js";
import type { Logger } from "@myloto/config";
import type { Sorteo } from "@myloto/db";

const logger: Logger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const SORTEO_READY: Sorteo = {
  id: 1n,
  bloqueCierre: 100,
  estado: "CERRADO",
  combinacionGanadora: null,
  seedMaestra: null,
  bloquesSemilla: null,
  creadoEn: new Date(),
  cerradoEn: null,
  calculadoEn: null,
};

function makeDeps(overrides: Partial<{
  blockCount: number;
  sorteos: Sorteo[];
  blockHashes: Record<number, string>;
  saveResult: ReturnType<typeof vi.fn>;
  markCalculated: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getBlockCount: vi.fn().mockResolvedValue(overrides.blockCount ?? 103),
    getReadySorteos: vi.fn().mockResolvedValue(overrides.sorteos ?? []),
    getBlockHash: vi.fn().mockImplementation((h: number) =>
      Promise.resolve(overrides.blockHashes?.[h] ?? `hash-${h}`),
    ),
    saveResult: overrides.saveResult ?? vi.fn().mockResolvedValue(undefined),
    markCalculated: overrides.markCalculated ?? vi.fn().mockResolvedValue(undefined),
    logger,
  };
}

describe("runRound (draw-verifier)", () => {
  it("sin sorteos ready → checked 0, drawn 0", async () => {
    const result = await runRound(makeDeps());
    expect(result).toEqual({ checked: 0, drawn: 0 });
  });

  it("sorteo ready → captura hashes, calcula, persiste, marca", async () => {
    const saveResult = vi.fn();
    const markCalculated = vi.fn();
    const deps = makeDeps({
      sorteos: [SORTEO_READY],
      blockHashes: { 101: "h1", 102: "h2", 103: "h3" },
      saveResult,
      markCalculated,
    });
    const result = await runRound(deps);
    expect(result).toEqual({ checked: 1, drawn: 1 });
    // Capturó los 3 hashes correctos (bloqueCierre=100 → +1,+2,+3)
    expect(deps.getBlockHash).toHaveBeenCalledWith(101);
    expect(deps.getBlockHash).toHaveBeenCalledWith(102);
    expect(deps.getBlockHash).toHaveBeenCalledWith(103);
    // Persistió y marcó
    expect(saveResult).toHaveBeenCalledTimes(1);
    expect(markCalculated).toHaveBeenCalledWith(1);
    // La combinación persistida tiene estructura válida
    const saved = saveResult.mock.calls[0]!;
    expect(saved[1].balotas).toHaveLength(5);
    expect(saved[1].powerball).toBeGreaterThanOrEqual(1);
    expect(saved[1].powerball).toBeLessThanOrEqual(26);
  });

  it("error individual no mata el round", async () => {
    const deps = makeDeps({
      sorteos: [
        { ...SORTEO_READY, id: 1n },
        { ...SORTEO_READY, id: 2n, bloqueCierre: 200 },
      ],
      blockHashes: {}, // getBlockHash devolverá "hash-N"
    });
    // Hacer que el primer getBlockHash (101) falle
    deps.getBlockHash = vi.fn()
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockResolvedValue("h");
    const result = await runRound(deps);
    expect(result.checked).toBe(2);
    expect(result.drawn).toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("idempotente: getReadySorteos solo devuelve CERRADO (no recalcula CALCULADO)", async () => {
    // El worker no recalcula porque getReadySorteos (en prod) filtra por estado='CERRADO'.
    // El test verifica que el worker confía en ese filtro: si no hay sorteos, no dibuja.
    const deps = makeDeps({ sorteos: [] });
    expect(await runRound(deps)).toEqual({ checked: 0, drawn: 0 });
    expect(deps.saveResult).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/workers/draw-verifier.js'".

- [ ] **Step 4: Implementar `apps/backend/src/workers/draw-verifier.ts`**

```typescript
import { buildDeps } from "../dependencies.js";
import {
  getClosedSorteosReady,
  saveSorteoResult,
  markCalculated,
} from "../services/sorteos.js";
import { deriveSeed, Sha256CounterPrng, drawWinningCombination } from "@myloto/randomness";
import type { CombinacionGanadora, BloquesSemilla } from "@myloto/types";
import type { Sorteo } from "@myloto/db";
import type { Logger } from "@myloto/config";
import { fileURLToPath } from "node:url";

export interface DrawWorkerDeps {
  getBlockCount: () => Promise<number>;
  getReadySorteos: (height: number) => Promise<Sorteo[]>;
  getBlockHash: (height: number) => Promise<string>;
  saveResult: (
    id: number,
    combinacion: CombinacionGanadora,
    bloques: BloquesSemilla,
  ) => Promise<void>;
  markCalculated: (id: number) => Promise<void>;
  logger: Logger;
}

/** Una ronda del worker. Exportada para tests. */
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

/** Loop infinito con shutdown graceful (SIGTERM/SIGINT). */
export function runLoop(deps: DrawWorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("draw-verifier recibió shutdown, esperando ronda");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("draw-verifier detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda draw completa", stats);
    } catch (err) {
      deps.logger.error("ronda draw falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps: DrawWorkerDeps = {
    getBlockCount: () => deps.rpc.getBlockCount(),
    getReadySorteos: (height) => getClosedSorteosReady(deps.db.db, height),
    getBlockHash: (height) => deps.rpc.getBlockHash(height),
    saveResult: (id, comb, bloques) =>
      saveSorteoResult(deps.db.db, id, comb, bloques),
    markCalculated: (id) => markCalculated(deps.db.db, id),
    logger: deps.logger,
  };
  deps.logger.info("arrancando draw-verifier", {
    intervalMs: deps.env.DRAW_CHECK_INTERVAL_MS,
  });
  runLoop(workerDeps, deps.env.DRAW_CHECK_INTERVAL_MS);
}

// Arranca solo cuando se ejecuta directamente.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 4 draw-verifier + 4 services-sorteos + 24 existentes = 32 PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @myloto/backend typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/backend pnpm-lock.yaml
git commit -m "feat(backend): worker draw-verifier (CERRADO→CALCULADO, shutdown graceful)"
```

---

## Task 9: Verificación global

**Objetivo:** Confirmar workspace verde.

- [ ] **Step 1: Typecheck global**

Run: `pnpm -r typecheck`
Expected: todos los paquetes Done, exit 0.

- [ ] **Step 2: Tests unitarios globales**

Run: `pnpm -r test`
Expected: todo verde (randomness ~17 + config 24 + brc20 37 + crypto 36 + rpc-client 26 + payments 11 + backend 32).

- [ ] **Step 3: Confirmar golden vector reproducible**

Run: `pnpm --filter @myloto/randomness test`
Expected: el test "GOLDEN VECTOR" PASS con los valores congelados.

- [ ] **Step 4: Commit (si hay cambios sin trackear)**

```bash
git status --short
# Si hay algo, commitearlo. Si no, no hace falta commit.
```

Entregables verificados (spec §8):
1. ✅ `pnpm install` sin errores
2. ✅ `pnpm --filter @myloto/randomness typecheck` exit 0
3. ✅ `pnpm --filter @myloto/randomness test` todo verde (~17)
4. ✅ `pnpm --filter @myloto/backend test` todo verde (~32)
5. ✅ `pnpm -r test` todo verde
6. ✅ `pnpm -r typecheck` todo verde
7. ✅ Golden vector: hashes conocidos → combinación reproducible
8. ⏳ Demo E2E con nodo real — pendiente hasta que el nodo sincronice

---

## Self-Review del Plan

### Especificación cubierta

| Sección del spec | Tarea que lo implementa |
|---|---|
| §4.1 `deriveSeed` | Task 3 |
| §4.2 `Sha256CounterPrng` + rejection sampling | Task 4 |
| §4.3 `shuffle` + `drawWinningCombination` | Task 5 |
| §4.4 `RandomnessError` jerarquía | Task 2 |
| §5.1 `services/sorteos.ts` (DB ops) | Task 7 |
| §5.2 `workers/draw-verifier.ts` | Task 8 |
| §6 Variable `DRAW_CHECK_INTERVAL_MS` | Task 6 |
| §7 Tests (determinismo, golden, avalanche, uniformidad) | Tasks 3, 4, 5, 7, 8 |
| §8 Entregables | Task 9 |

Todas las secciones del spec tienen al menos una tarea. ✓

### Placeholder scan

- Task 5 Step 5 tiene placeholders (`GOLDEN_BALOTAS`, `GOLDEN_POWERBALL`) que se rellenan en el Step 6 con un script de captura. Esto NO es un placeholder prohibido: es la técnica documentada en el spec §4/§7 para congelar el golden vector. El Step 6 da instrucciones exactas para obtener y reemplazar los valores. ✓
- Sin "TBD", "implement later", ni "add appropriate error handling". ✓

### Type consistency

- `deriveSeed(hashes: BloquesSemilla): Uint8Array` — Task 3, usado en Task 5 y Task 8. ✓
- `Sha256CounterPrng` constructor `(seed: Uint8Array)` — Task 4, usado en Task 5 y Task 8. ✓
- `shuffle<T>(arr: readonly T[], prng): T[]` — Task 5. ✓
- `drawWinningCombination(prng): CombinacionGanadora` — Task 5, usado en Task 8. ✓
- `getClosedSorteosReady(db, currentHeight: number): Promise<Sorteo[]>` — Task 7, usado en Task 8. ✓
- `saveSorteoResult(db, sorteoId: number, combinacion, bloques): Promise<void>` — Task 7, usado en Task 8. ✓
- `markCalculated(db, sorteoId: number): Promise<void>` — Task 7, usado en Task 8. ✓
- `DrawWorkerDeps` interfaz — Task 8 (consistente entre impl y test). ✓
- `DRAW_CHECK_INTERVAL_MS: number` — Task 6, usado en Task 8. ✓

Sin inconsistencias. ✓
