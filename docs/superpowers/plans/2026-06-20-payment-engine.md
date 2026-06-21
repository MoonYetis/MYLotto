# Motor de Pagos Híbrido + Compra de Tickets — Plan de Implementación (Ciclo 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `packages/payments` (precio + verificación de pago, dominio puro), `POST/GET /tickets` (comprar boleto con derivación HD + descuento Hold-to-Earn), y un worker separado que transiciona tickets `PENDIENTE → ACTIVO` vía `getreceivedbyaddress`.

**Architecture:** Paquete `@myloto/payments` (pricing + verifier puros, sin dependencias de infra) + `services/` en backend (DB ops + bridge brc20/payments con fail-closed) + `routes/` (HTTP fino con Zod) + `workers/` (loop independiente). TDD estricto, un commit por tarea.

**Tech Stack:** TypeScript 5 estricto (`exactOptionalPropertyTypes: true`), Drizzle ORM, Fastify, Zod, Vitest. Reusa `@myloto/config`, `@myloto/db`, `@myloto/rpc-client`, `@myloto/crypto`, `@myloto/brc20`, `@myloto/types`.

**Spec de referencia:** `docs/superpowers/specs/2026-06-20-payment-engine-design.md`

---

## File Structure

```
packages/payments/                    # NUEVO
├── src/
│   ├── pricing.ts                    # calculatePrice(hasDiscount, base?, discount?)
│   ├── verifier.ts                   # verifyPayment({getReceived, ticket, minconf?})
│   ├── errors.ts                     # PaymentError + InsufficientPaymentError
│   └── index.ts
├── test/unit/
│   ├── pricing.test.ts
│   ├── verifier.test.ts
│   └── errors.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts

apps/backend/
├── src/
│   ├── services/
│   │   ├── tickets.ts                # DB ops: getActiveSorteo, createTicket, getTicketById, getPendingTickets, markActive
│   │   └── pricing.ts                # resolveTicketPrice (bridge brc20 + payments + fail-closed)
│   ├── routes/
│   │   ├── tickets.ts                # POST /tickets, GET /tickets/:id
│   │   └── health.ts                 # existe
│   ├── workers/
│   │   └── payment-verifier.ts       # runRound + runLoop + main
│   ├── dependencies.ts               # MODIFICADO: + wallet, unisat
│   └── server.ts                     # MODIFICADO: registra /tickets
└── test/
    ├── services-tickets.test.ts
    ├── services-pricing.test.ts
    ├── routes-tickets.test.ts
    ├── worker-payment-verifier.test.ts
    └── health.test.ts                # MODIFICADO: actualiza mockDeps con nuevas deps/env
```

**Modifica (otros paquetes):**
- `packages/config/src/env.ts` — `XPUB_BIP86` required + 4 vars nuevas.
- `packages/config/test/env.test.ts` — añade XPUB al fixture `valid` + tests nuevos.
- `.env.example` — 4 vars nuevas + XPUB obligatorio.

---

## Task 1: Esqueleto del paquete `packages/payments`

**Objetivo:** Estructura mínima con `pnpm install` funcionando.

**Files:**
- Create: `packages/payments/package.json`
- Create: `packages/payments/tsconfig.json`
- Create: `packages/payments/vitest.config.ts`

- [ ] **Step 1: Crear `packages/payments/package.json`**

```json
{
  "name": "@myloto/payments",
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
  "devDependencies": {
    "@types/node": "^22.5.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

> Nota: `@myloto/payments` NO tiene `dependencies` de runtime. Es dominio puro.

- [ ] **Step 2: Crear `packages/payments/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Crear `packages/payments/vitest.config.ts`**

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
git add packages/payments pnpm-lock.yaml
git commit -m "chore(payments): esqueleto del paquete @myloto/payments"
```

---

## Task 2: Errores tipados (TDD)

**Objetivo:** Jerarquía `PaymentError`.

**Files:**
- Create: `packages/payments/src/errors.ts`
- Create: `packages/payments/src/index.ts` (placeholder)
- Create: `packages/payments/test/unit/errors.test.ts`

- [ ] **Step 1: Escribir test que FALLARÁ (`packages/payments/test/unit/errors.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import { PaymentError, InsufficientPaymentError } from "../../src/errors.js";

describe("errores payments", () => {
  it("PaymentError guarda message", () => {
    const err = new PaymentError("boom");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("PaymentError");
  });

  it("InsufficientPaymentError extiende PaymentError", () => {
    const err = new InsufficientPaymentError("falta plata");
    expect(err).toBeInstanceOf(PaymentError);
    expect(err.message).toBe("falta plata");
    expect(err.name).toBe("InsufficientPaymentError");
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `pnpm --filter @myloto/payments test`
Expected: FAIL con "Cannot find module '../../src/errors.js'".

- [ ] **Step 3: Implementar `packages/payments/src/errors.ts`**

```typescript
/**
 * Jerarquía de errores del motor de pagos.
 * Hoy solo la base + InsufficientPaymentError (reservada para validaciones futuras).
 */
export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

/** Reservada para validaciones futuras (ej. monto recibido != esperado). */
export class InsufficientPaymentError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPaymentError";
  }
}
```

- [ ] **Step 4: Crear `packages/payments/src/index.ts` (placeholder)**

```typescript
export * from "./errors.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/payments test`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/payments
git commit -m "feat(payments): jerarquía PaymentError"
```

---

## Task 3: `calculatePrice` (TDD)

**Objetivo:** Función pura que calcula el precio del boleto.

**Files:**
- Create: `packages/payments/test/unit/pricing.test.ts`
- Create: `packages/payments/src/pricing.ts`
- Modify: `packages/payments/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect } from "vitest";
import { calculatePrice } from "../../src/pricing.js";

describe("calculatePrice", () => {
  it("con descuento devuelve precio descontado y reason HOLDER", () => {
    const result = calculatePrice(true);
    expect(result.amount).toBe(80);
    expect(result.hasDiscount).toBe(true);
    expect(result.reason).toBe("HOLDER");
  });

  it("sin descuento devuelve precio base y reason NO_HOLDER", () => {
    const result = calculatePrice(false);
    expect(result.amount).toBe(100);
    expect(result.hasDiscount).toBe(false);
    expect(result.reason).toBe("NO_HOLDER");
  });

  it("respeta base y discount custom", () => {
    const result = calculatePrice(false, 50, 40);
    expect(result.amount).toBe(50);
    expect(result.hasDiscount).toBe(false);
  });

  it("con descuento y precios custom aplica el discount custom", () => {
    const result = calculatePrice(true, 50, 40);
    expect(result.amount).toBe(40);
    expect(result.hasDiscount).toBe(true);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/payments test`
Expected: FAIL con "Cannot find module '../../src/pricing.js'".

- [ ] **Step 3: Implementar `packages/payments/src/pricing.ts`**

```typescript
/** Defaults de precio (FB). Configurables vía env en el backend. */
export const DEFAULT_TICKET_PRICE_BASE = 100;
export const DEFAULT_TICKET_PRICE_DISCOUNTED = 80;

export type PricingReason = "HOLDER" | "NO_HOLDER" | "UNISAT_FAILED";

export interface TicketPrice {
  /** Monto en FB que el usuario debe pagar. */
  amount: number;
  hasDiscount: boolean;
  /** Auditoría del fail-closed: por qué se eligió este precio. */
  reason: PricingReason;
}

/**
 * Calcula el precio de un boleto.
 * @param hasDiscount si el usuario califica (balance Moonyetis > 0)
 * @param base precio sin descuento (default 100)
 * @param discount precio con descuento (default 80)
 */
export function calculatePrice(
  hasDiscount: boolean,
  base: number = DEFAULT_TICKET_PRICE_BASE,
  discount: number = DEFAULT_TICKET_PRICE_DISCOUNTED,
): TicketPrice {
  return hasDiscount
    ? { amount: discount, hasDiscount: true, reason: "HOLDER" }
    : { amount: base, hasDiscount: false, reason: "NO_HOLDER" };
}
```

- [ ] **Step 4: Actualizar `packages/payments/src/index.ts`**

```typescript
export * from "./errors.js";
export { calculatePrice } from "./pricing.js";
export type { TicketPrice, PricingReason } from "./pricing.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/payments test`
Expected: 4 pricing + 2 errors = 6 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/payments
git commit -m "feat(payments): calculatePrice con reason de auditoría"
```

---

## Task 4: `verifyPayment` (TDD)

**Objetivo:** Verificación de pago con `getReceived` inyectable.

**Files:**
- Create: `packages/payments/test/unit/verifier.test.ts`
- Create: `packages/payments/src/verifier.ts`
- Modify: `packages/payments/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import { verifyPayment } from "../../src/verifier.js";

describe("verifyPayment", () => {
  const ticket = { paymentAddress: "bc1q...", expectedAmount: 100 };

  it("paid true cuando received >= expected", async () => {
    const getReceived = vi.fn().mockResolvedValue(100);
    const result = await verifyPayment({ getReceived, ticket });
    expect(result.paid).toBe(true);
    expect(result.received).toBe(100);
    expect(result.expected).toBe(100);
  });

  it("paid false cuando received < expected", async () => {
    const getReceived = vi.fn().mockResolvedValue(50);
    const result = await verifyPayment({ getReceived, ticket });
    expect(result.paid).toBe(false);
    expect(result.received).toBe(50);
  });

  it("paid true cuando received > expected (sobrepago)", async () => {
    const getReceived = vi.fn().mockResolvedValue(150);
    const result = await verifyPayment({ getReceived, ticket });
    expect(result.paid).toBe(true);
  });

  it("getReceived recibe address y minconf (default 1)", async () => {
    const getReceived = vi.fn().mockResolvedValue(100);
    await verifyPayment({ getReceived, ticket });
    expect(getReceived).toHaveBeenCalledWith("bc1q...", 1);
  });

  it("respeta minconf custom", async () => {
    const getReceived = vi.fn().mockResolvedValue(100);
    await verifyPayment({ getReceived, ticket, minconf: 3 });
    expect(getReceived).toHaveBeenCalledWith("bc1q...", 3);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/payments test`
Expected: FAIL con "Cannot find module '../../src/verifier.js'".

- [ ] **Step 3: Implementar `packages/payments/src/verifier.ts`**

```typescript
/** Función inyectable para consultar el nodo. Desacopla payments de rpc-client. */
export type GetReceivedFn = (
  address: string,
  minconf: number,
) => Promise<number>;

export interface VerifyTicket {
  paymentAddress: string;
  expectedAmount: number;
}

export interface VerifyPaymentInput {
  getReceived: GetReceivedFn;
  ticket: VerifyTicket;
  /** Confirmaciones mínimas. Default 1. */
  minconf?: number;
}

export interface VerifyPaymentResult {
  /** true si received >= expectedAmount. */
  paid: boolean;
  /** Total recibido por la dirección (FB). */
  received: number;
  /** Monto esperado (echo para auditoría). */
  expected: number;
}

/**
 * Verifica si un ticket ha sido pagado consultando getreceivedbyaddress.
 * Sin lógica de red: delega en getReceived inyectable.
 */
export async function verifyPayment(
  input: VerifyPaymentInput,
): Promise<VerifyPaymentResult> {
  const minconf = input.minconf ?? 1;
  const received = await input.getReceived(
    input.ticket.paymentAddress,
    minconf,
  );
  return {
    paid: received >= input.ticket.expectedAmount,
    received,
    expected: input.ticket.expectedAmount,
  };
}
```

- [ ] **Step 4: Actualizar `packages/payments/src/index.ts`**

```typescript
export * from "./errors.js";
export { calculatePrice } from "./pricing.js";
export type { TicketPrice, PricingReason } from "./pricing.js";
export { verifyPayment } from "./verifier.js";
export type {
  GetReceivedFn,
  VerifyTicket,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "./verifier.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/payments test`
Expected: 5 verifier + 4 pricing + 2 errors = 11 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/payments
git commit -m "feat(payments): verifyPayment con getReceived inyectable"
```

---

## Task 5: Variables de entorno en config (TDD)

**Objetivo:** `XPUB_BIP86` required + 4 vars nuevas. Actualizar tests y fixture.

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/test/env.test.ts`
- Modify: `.env.example`
- Modify: `apps/backend/test/health.test.ts` (mockDeps necesita XPUB en env + nuevas vars)

- [ ] **Step 1: Añadir XPUB al fixture `valid` y tests nuevos en `packages/config/test/env.test.ts`**

Reemplazar el bloque `const valid = { ... }` (líneas 5-15) por:

```typescript
  const valid = {
    NODE_ENV: "development",
    FRACTAL_RPC_URL: "http://100.64.0.1:8332",
    FRACTAL_RPC_USER: "moonyetis_rpc",
    FRACTAL_RPC_PASSWORD: "secret",
    FRACTAL_RPC_TIMEOUT_MS: "15000",
    DATABASE_URL: "postgresql://u:p@localhost:5432/myloto",
    PORT: "3000",
    LOG_LEVEL: "info",
    UNISAT_API_KEY: "sk-test-123",
    XPUB_BIP86:
      "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ",
  } as const;
```

Añadir dentro de `describe("loadEnv")`, antes de la llave de cierre:

```typescript
  it("acepta TICKET_PRICE_FB y TICKET_DISCOUNT_PRICE_FB", () => {
    const env = loadEnv({
      ...valid,
      TICKET_PRICE_FB: "100",
      TICKET_DISCOUNT_PRICE_FB: "80",
    });
    expect(env.TICKET_PRICE_FB).toBe(100);
    expect(env.TICKET_DISCOUNT_PRICE_FB).toBe(80);
  });

  it("aplica defaults de precios y worker", () => {
    const env = loadEnv({ ...valid });
    expect(env.TICKET_PRICE_FB).toBe(100);
    expect(env.TICKET_DISCOUNT_PRICE_FB).toBe(80);
    expect(env.PAYMENT_CHECK_INTERVAL_MS).toBe(30000);
    expect(env.PAYMENT_MIN_CONFIRMATIONS).toBe(1);
  });

  it("acepta PAYMENT_CHECK_INTERVAL_MS y PAYMENT_MIN_CONFIRMATIONS custom", () => {
    const env = loadEnv({
      ...valid,
      PAYMENT_CHECK_INTERVAL_MS: "5000",
      PAYMENT_MIN_CONFIRMATIONS: "3",
    });
    expect(env.PAYMENT_CHECK_INTERVAL_MS).toBe(5000);
    expect(env.PAYMENT_MIN_CONFIRMATIONS).toBe(3);
  });

  it("XPUB_BIP86 ahora es required (lanza si falta)", () => {
    expect(() => {
      const { XPUB_BIP86, ...sinXpub } = valid;
      void XPUB_BIP86;
      loadEnv(sinXpub);
    }).toThrow();
  });
```

> Nota sobre el test "XPUB required": la deconstrucción `const { XPUB_BIP86, ...sinXpub }` remueve la clave; `void XPUB_BIP86` evita el warning de variable sin usar. Como `loadEnv` recibe `Record<string, string | undefined>`, `sinXpub` tipa correctamente.

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/config test`
Expected: FAIL — los tests nuevos referencian `TICKET_PRICE_FB` y `XPUB_BIP86` ahora debe ser required (el test "lanza si falta" falla porque hoy XPUB sigue siendo opcional y loadEnv NO lanza).

- [ ] **Step 3: Modificar `packages/config/src/env.ts`**

Reemplazar el bloque XPUB (líneas 24-32):

```typescript
  // --- XPUB BIP86 (OBLIGATORIO desde Ciclo 4 — derivación de direcciones de boleto) ---
  XPUB_BIP86: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("xpub"), {
      message: "XPUB_BIP86 debe empezar con 'xpub' (mainnet BIP86)",
    }),
```

Añadir después del bloque `BRC20_TICKER` (antes del cierre del `z.object`):

```typescript

  // --- Precios de boleto (Hold-to-Earn) ---
  TICKET_PRICE_FB: z.coerce.number().positive().default(100),
  TICKET_DISCOUNT_PRICE_FB: z.coerce.number().positive().default(80),

  // --- Worker de verificación de pagos ---
  PAYMENT_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  PAYMENT_MIN_CONFIRMATIONS: z.coerce.number().int().min(0).default(1),
```

- [ ] **Step 4: Actualizar `.env.example`**

Reemplazar la línea `# --- XPUB BIP86 ...` y su contenido por:

```bash
# --- XPUB BIP86 (OBLIGATORIO desde Ciclo 4 — derivación de direcciones de boleto) ---
# Mainnet: empieza con "xpub", nivel m/86'/0'/0'.
XPUB_BIP86=xpub6BgBgspe...

# --- Precios de boleto (Hold-to-Earn) ---
TICKET_PRICE_FB=100
TICKET_DISCOUNT_PRICE_FB=80

# --- Worker de verificación de pagos ---
PAYMENT_CHECK_INTERVAL_MS=30000
PAYMENT_MIN_CONFIRMATIONS=1
```

- [ ] **Step 5: Actualizar `apps/backend/test/health.test.ts` mockDeps env**

En el objeto `env` retornado por `mockDeps` (alrededor de la línea 38), añadir los campos nuevos:

```typescript
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
    },
```

> Este mock se completa más en la Task 9 (cuando `AppDeps` gane `wallet` + `unisat`). Aquí solo añadimos el `env`.

- [ ] **Step 6: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/config test`
Expected: 4 nuevos + 13 existentes = 17 PASS.

Run: `pnpm --filter @myloto/backend test`
Expected: 4 PASS (health sigue verde con el env actualizado).

- [ ] **Step 7: Commit**

```bash
git add packages/config .env.example apps/backend/test/health.test.ts
git commit -m "feat(config): XPUB_BIP86 required + vars de precio y worker (Ciclo 4)"
```

---

## Task 6: `services/tickets.ts` — operaciones de DB (TDD)

**Objetivo:** Capa de acceso a DB con Drizzle.

**Files:**
- Create: `apps/backend/test/services-tickets.test.ts`
- Create: `apps/backend/src/services/tickets.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN (`apps/backend/test/services-tickets.test.ts`)**

```typescript
import { describe, it, expect, vi } from "vitest";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@myloto/db";
import {
  getActiveSorteo,
  createTicket,
  getTicketById,
  getPendingTickets,
  markActive,
} from "../src/services/tickets.js";

// Mock del db Drizzle: solo interceptamos los métodos query que usamos.
function mockDb(overrides: Partial<{
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
}> = {}): NodePgDatabase<typeof schema> {
  const chain = {
    values: overrides.values ?? vi.fn().mockReturnThis(),
    returning: overrides.returning ?? vi.fn().mockResolvedValue([{ id: 1 }]),
    where: overrides.where ?? vi.fn().mockReturnThis(),
    set: overrides.set ?? vi.fn().mockReturnThis(),
  };
  return {
    query: {
      sorteos: { findFirst: overrides.findFirst ?? vi.fn().mockResolvedValue(null) },
      tickets: { findFirst: overrides.findFirst ?? vi.fn().mockResolvedValue(null),
                 findMany: overrides.findMany ?? vi.fn().mockResolvedValue([]) },
    },
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
  } as unknown as NodePgDatabase<typeof schema>;
}

describe("services/tickets", () => {
  it("getActiveSorteo devuelve el sorteo ABIERTO", async () => {
    const abierto = { id: 1, estado: "ABIERTO", bloqueCierre: 100 };
    const db = mockDb({ findFirst: vi.fn().mockResolvedValue(abierto) });
    const result = await getActiveSorteo(db);
    expect(result).toEqual(abierto);
  });

  it("getActiveSorteo devuelve null si no hay ABIERTO", async () => {
    const db = mockDb({ findFirst: vi.fn().mockResolvedValue(null) });
    const result = await getActiveSorteo(db);
    expect(result).toBeNull();
  });

  it("createTicket inserta y devuelve la fila con id", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 42, status: "PENDIENTE" }]);
    const db = mockDb({ returning });
    const result = await createTicket(db, {
      sorteoId: 1,
      paymentAddress: "bc1q...",
      expectedAmount: 100,
      n1: 1, n2: 2, n3: 3, n4: 4, n5: 5,
      powerball: 6,
    });
    expect(result.id).toBe(42);
    expect(result.status).toBe("PENDIENTE");
  });

  it("getTicketById devuelve la fila o null", async () => {
    const db = mockDb({ findFirst: vi.fn().mockResolvedValue({ id: 7 }) });
    expect((await getTicketById(db, 7))?.id).toBe(7);
    const db2 = mockDb({ findFirst: vi.fn().mockResolvedValue(null) });
    expect(await getTicketById(db2, 99)).toBeNull();
  });

  it("getPendingTickets devuelve array (posiblemente vacío)", async () => {
    const db = mockDb({ findMany: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) });
    const result = await getPendingTickets(db);
    expect(result).toHaveLength(2);
  });

  it("markActive llama a update sin lanzar", async () => {
    const db = mockDb();
    await expect(markActive(db, 5)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/services/tickets.js'".

- [ ] **Step 3: Implementar `apps/backend/src/services/tickets.ts`**

```typescript
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sorteos, tickets } from "@myloto/db";
import type { Sorteo, Ticket } from "@myloto/db";

export interface CreateTicketInput {
  sorteoId: number;
  paymentAddress: string;
  /** Precio en FB. Drizzle lo persiste como NUMERIC(18,8). */
  expectedAmount: number;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  powerball: number;
  userReturnAddress?: string;
}

/** Devuelve el único sorteo ABIERTO, o null si no hay. */
export async function getActiveSorteo(
  db: NodePgDatabase<Record<string, never>>,
): Promise<Sorteo | null> {
  const rows = await db
    .select()
    .from(sorteos)
    .where(eq(sorteos.estado, "ABIERTO"))
    .limit(1);
  return (rows[0] as Sorteo | undefined) ?? null;
}

/** Inserta un ticket y devuelve la fila completa (con id generado). */
export async function createTicket(
  db: NodePgDatabase<Record<string, never>>,
  input: CreateTicketInput,
): Promise<Ticket> {
  const [row] = await db
    .insert(tickets)
    .values({
      sorteoId: input.sorteoId,
      paymentAddress: input.paymentAddress,
      expectedAmount: String(input.expectedAmount),
      status: "PENDIENTE",
      n1: input.n1,
      n2: input.n2,
      n3: input.n3,
      n4: input.n4,
      n5: input.n5,
      powerball: input.powerball,
      ...(input.userReturnAddress !== undefined
        ? { userReturnAddress: input.userReturnAddress }
        : {}),
    })
    .returning();
  if (!row) throw new Error("createTicket: INSERT no devolvió fila");
  return row;
}

/** Devuelve un ticket por id, o null. */
export async function getTicketById(
  db: NodePgDatabase<Record<string, never>>,
  id: number,
): Promise<Ticket | null> {
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.id, BigInt(id)))
    .limit(1);
  return (rows[0] as Ticket | undefined) ?? null;
}

/** Tickets pendientes de pago (para el worker). */
export async function getPendingTickets(
  db: NodePgDatabase<Record<string, never>>,
): Promise<Ticket[]> {
  const rows = await db
    .select()
    .from(tickets)
    .where(eq(tickets.status, "PENDIENTE"));
  return rows as Ticket[];
}

/** Transición idempotente PENDIENTE → ACTIVO. UPDATE WHERE status='PENDIENTE'. */
export async function markActive(
  db: NodePgDatabase<Record<string, never>>,
  id: number,
): Promise<void> {
  await db
    .update(tickets)
    .set({ status: "ACTIVO", recibidoEn: new Date() })
    .where(and(eq(tickets.id, BigInt(id)), eq(tickets.status, "PENDIENTE")));
}
```

> Nota sobre el tipo `NodePgDatabase<Record<string, never>>`: usar el tipo completo `typeof schema` en la firma fuerza a importar todo el schema en cada caller. Pasamos el tipo genérico reducido para que el service acepte cualquier instancia Drizzle; los tests y `buildDeps` la usan con el schema real sin fricción. Si TypeScript se queja en la integración real, se afloja a `NodePgDatabase<typeof schema>`.

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 6 services-tickets + 4 health = 10 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): services/tickets con ops Drizzle (create, getActive, markActive)"
```

---

## Task 7: `services/pricing.ts` — bridge con fail-closed (TDD)

**Objetivo:** Combina brc20 + payments con fail-closed.

**Files:**
- Create: `apps/backend/test/services-pricing.test.ts`
- Create: `apps/backend/src/services/pricing.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import { resolveTicketPrice } from "../src/services/pricing.js";
import type { UnisatClient } from "@myloto/brc20";
import type { Logger } from "@myloto/config";

const logger: Logger = {
  trace: vi.fn(), debug: vi.fn(), info: vi.fn(),
  warn: vi.fn(), error: vi.fn(), fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function deps(unisatClient: UnisatClient) {
  return {
    unisatClient,
    ticker: "Moonyetis",
    basePrice: 100,
    discountPrice: 80,
    logger,
  };
}

describe("resolveTicketPrice", () => {
  it("sin brc20Address devuelve precio completo NO_HOLDER", async () => {
    const unisat = { getBrc20Balance: vi.fn() } as unknown as UnisatClient;
    const result = await resolveTicketPrice(null, deps(unisat));
    expect(result.amount).toBe(100);
    expect(result.reason).toBe("NO_HOLDER");
    expect(unisat.getBrc20Balance).not.toHaveBeenCalled();
  });

  it("holder con balance > 0 obtiene descuento", async () => {
    const unisat = {
      getBrc20Balance: vi.fn().mockResolvedValue({ availableBalance: "950" }),
    } as unknown as UnisatClient;
    const result = await resolveTicketPrice("bc1q...", deps(unisat));
    expect(result.amount).toBe(80);
    expect(result.hasDiscount).toBe(true);
    expect(result.reason).toBe("HOLDER");
  });

  it("holder con balance 0 no obtiene descuento", async () => {
    const unisat = {
      getBrc20Balance: vi.fn().mockResolvedValue({ availableBalance: "0" }),
    } as unknown as UnisatClient;
    const result = await resolveTicketPrice("bc1q...", deps(unisat));
    expect(result.amount).toBe(100);
    expect(result.hasDiscount).toBe(false);
  });

  it("fail-closed: UniSat falla → precio completo UNISAT_FAILED", async () => {
    const unisat = {
      getBrc20Balance: vi.fn().mockRejectedValue(new Error("network down")),
    } as unknown as UnisatClient;
    const result = await resolveTicketPrice("bc1q...", deps(unisat));
    expect(result.amount).toBe(100);
    expect(result.hasDiscount).toBe(false);
    expect(result.reason).toBe("UNISAT_FAILED");
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/services/pricing.js'".

- [ ] **Step 3: Implementar `apps/backend/src/services/pricing.ts`**

```typescript
import type { UnisatClient } from "@myloto/brc20";
import { qualifiesForDiscount } from "@myloto/brc20";
import { calculatePrice, type TicketPrice } from "@myloto/payments";
import type { Logger } from "@myloto/config";

export interface ResolvePriceDeps {
  unisatClient: UnisatClient;
  ticker: string;
  basePrice: number;
  discountPrice: number;
  logger: Logger;
}

/**
 * Resuelve el precio final de un ticket combinando verificación BRC-20
 * (UniSat) y cálculo de precio. Fail-closed: si UniSat falla, precio completo.
 *
 * @param brc20Address dirección Bitcoin del usuario (null = sin descuento).
 */
export async function resolveTicketPrice(
  brc20Address: string | null,
  deps: ResolvePriceDeps,
): Promise<TicketPrice> {
  if (brc20Address === null) {
    return calculatePrice(false, deps.basePrice, deps.discountPrice);
  }
  try {
    const balance = await deps.unisatClient.getBrc20Balance(
      brc20Address,
      deps.ticker,
    );
    const hasDiscount = qualifiesForDiscount(balance.availableBalance);
    return calculatePrice(hasDiscount, deps.basePrice, deps.discountPrice);
  } catch (err) {
    // FAIL-CLOSED: UniSat falló → precio completo, sin descuento.
    deps.logger.warn(
      "UniSat falló al verificar descuento; aplicando precio completo",
      {
        brc20Address: brc20Address.slice(0, 12) + "...",
        error: err instanceof Error ? err.message : "unknown",
      },
    );
    return {
      amount: deps.basePrice,
      hasDiscount: false,
      reason: "UNISAT_FAILED",
    };
  }
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 4 services-pricing + 6 services-tickets + 4 health = 14 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): services/pricing bridge brc20+payments con fail-closed"
```

---

## Task 8: `routes/tickets.ts` — POST/GET HTTP (TDD)

**Objetivo:** Endpoints HTTP con validación Zod.

**Files:**
- Create: `apps/backend/test/routes-tickets.test.ts`
- Create: `apps/backend/src/routes/tickets.ts`
- Modify: `apps/backend/src/dependencies.ts` (AppDeps gana wallet + unisat)
- Modify: `apps/backend/test/health.test.ts` (mockDeps completo)

> Nota de orden: Esta tarea añade `wallet` y `unisat` a `AppDeps` y actualiza `buildDeps`, porque `routes/tickets.ts` los necesita. Se hace aquí y no antes para que el código compile en orden.

- [ ] **Step 1: Actualizar `apps/backend/src/dependencies.ts`**

Reemplazar todo el archivo por:

```typescript
import {
  loadEnv,
  createLogger,
  type Env,
  type Logger,
} from "@myloto/config";
import { createDb, type DbHandle } from "@myloto/db";
import { FractalRpcClient, FractalTransport } from "@myloto/rpc-client";
import { HdWallet } from "@myloto/crypto";
import { UnisatClient, UnisatTransport } from "@myloto/brc20";

export interface AppDeps {
  env: Env;
  logger: Logger;
  db: DbHandle;
  rpc: FractalRpcClient;
  wallet: HdWallet;
  unisat: UnisatClient;
}

/**
 * Construye las dependencias de la aplicación desde variables de entorno.
 * Único punto donde se cablean config + db + rpc-client + crypto + brc20.
 * En tests se inyectan mocks en lugar de llamar a esta función.
 */
export function buildDeps(): AppDeps {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, "backend");
  const db = createDb(env.DATABASE_URL);
  const transport = new FractalTransport({
    url: env.FRACTAL_RPC_URL,
    username: env.FRACTAL_RPC_USER,
    password: env.FRACTAL_RPC_PASSWORD,
    timeoutMs: env.FRACTAL_RPC_TIMEOUT_MS,
  });
  const rpc = new FractalRpcClient(transport);
  const wallet = new HdWallet({ xpub: env.XPUB_BIP86, logger });
  const unisatTransport = new UnisatTransport({
    baseUrl: env.UNISAT_BASE_URL,
    apiKey: env.UNISAT_API_KEY,
    timeoutMs: env.UNISAT_TIMEOUT_MS,
  });
  const unisat = new UnisatClient(unisatTransport);
  return { env, logger, db, rpc, wallet, unisat };
}
```

Añadir `@myloto/crypto` y `@myloto/brc20` a `apps/backend/package.json` dependencies:

```json
    "@myloto/brc20": "workspace:*",
    "@myloto/crypto": "workspace:*",
    "@myloto/payments": "workspace:*",
```

> `@myloto/payments` se añade aquí también porque `routes/tickets.ts` y `services/pricing.ts` lo usan. Ejecutar `pnpm install` tras editar.

- [ ] **Step 2: Escribir tests que FALLARÁN (`apps/backend/test/routes-tickets.test.ts`)**

```typescript
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
  trace: vi.fn(), debug: vi.fn(), info: vi.fn(),
  warn: vi.fn(), error: vi.fn(), fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function mockDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const db = {
    db: {
      // stubs mínimos de Drizzle usados por services/tickets
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, estado: "ABIERTO", bloqueCierre: 100 }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 1, sorteoId: 1, status: "PENDIENTE", expectedAmount: "100",
            paymentAddress: "PLACEHOLDER",
          }]),
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
      NODE_ENV: "test", FRACTAL_RPC_URL: "http://100.0.0.1:8332",
      FRACTAL_RPC_USER: "u", FRACTAL_RPC_PASSWORD: "p", FRACTAL_RPC_TIMEOUT_MS: 15000,
      DATABASE_URL: "postgresql://u:p@localhost:5432/x", PORT: 3000, LOG_LEVEL: "info",
      UNISAT_BASE_URL: "https://open-api-fractal.unisat.io", UNISAT_API_KEY: "k",
      UNISAT_TIMEOUT_MS: 15000, BRC20_TICKER: "Moonyetis",
      XPUB_BIP86: "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ",
      TICKET_PRICE_FB: 100, TICKET_DISCOUNT_PRICE_FB: 80,
      PAYMENT_CHECK_INTERVAL_MS: 30000, PAYMENT_MIN_CONFIRMATIONS: 1,
    },
    logger,
    db,
    rpc: {} as unknown as FractalRpcClient,
    wallet: { deriveAddress: vi.fn().mockReturnValue({ address: "bc1qderived", path: "m/86'/0'/0'/0/1" }) } as unknown as HdWallet,
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

describe("POST /tickets", () => {
  it("201 con body válido (sin brc20Address → precio completo)", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "POST", url: "/tickets", payload: validBody });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(1);
    expect(body.status).toBe("PENDIENTE");
    expect(body.expectedAmount).toBe(100);
    expect(body.paymentAddress).toBe("bc1qderived");
    expect(body.bip21Uri).toContain("bc1qderived");
    expect(body.qrSvg).toContain("<svg");
    await app.close();
  });

  it("400 si balotas fuera de rango", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({
      method: "POST", url: "/tickets",
      payload: { ...validBody, n5: 200 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("400 si balotas no ordenadas", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({
      method: "POST", url: "/tickets",
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
            where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
          }),
        }),
      },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "POST", url: "/tickets", payload: validBody });
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
              limit: vi.fn().mockResolvedValue([{
                id: 7, sorteoId: 1, status: "ACTIVO", expectedAmount: "100",
                paymentAddress: "bc1q...", n1: 1, n2: 2, n3: 3, n4: 4, n5: 5,
                powerball: 6, userReturnAddress: null, recibidoEn: null,
              }]),
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
            where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
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
```

- [ ] **Step 3: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/routes/tickets.js'".

- [ ] **Step 4: Implementar `apps/backend/src/routes/tickets.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { tickets } from "@myloto/db";
import { buildBip21Uri, renderQrSvg } from "@myloto/crypto";
import type { AppDeps } from "../dependencies.js";
import {
  getActiveSorteo,
  createTicket,
  getTicketById,
} from "../services/tickets.js";
import { resolveTicketPrice } from "../services/pricing.js";

const TicketBodySchema = z
  .object({
    n1: z.number().int().min(1).max(69),
    n2: z.number().int().min(1).max(69),
    n3: z.number().int().min(1).max(69),
    n4: z.number().int().min(1).max(69),
    n5: z.number().int().min(1).max(69),
    powerball: z.number().int().min(1).max(26),
    returnAddress: z.string().optional(),
    brc20Address: z.string().optional(),
  })
  .refine(
    (d) => d.n1 < d.n2 && d.n2 < d.n3 && d.n3 < d.n4 && d.n4 < d.n5,
    { message: "las balotas deben ir ordenadas de menor a mayor sin repetir" },
  );

/**
 * Registra los endpoints de tickets:
 * - POST /tickets   → compra: valida, deriva dirección HD, calcula precio, inserta
 * - GET  /tickets/:id → estado del ticket
 */
export function registerTicketRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): void {
  app.post("/tickets", async (req, reply) => {
    const parsed = TicketBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.issues[0]?.message ?? "body inválido" };
    }
    const body = parsed.data;

    const sorteo = await getActiveSorteo(deps.db.db);
    if (!sorteo) {
      reply.code(409);
      return { error: "no hay sorteo ABIERTO activo" };
    }

    const brc20 = body.brc20Address ?? null;
    const price = await resolveTicketPrice(brc20, {
      unisatClient: deps.unisat,
      ticker: deps.env.BRC20_TICKER,
      basePrice: deps.env.TICKET_PRICE_FB,
      discountPrice: deps.env.TICKET_DISCOUNT_PRICE_FB,
      logger: deps.logger,
    });

    // INSERT con placeholder; el id generado es el índice de derivación HD.
    const ticket = await createTicket(deps.db.db, {
      sorteoId: Number(sorteo.id),
      paymentAddress: "PLACEHOLDER",
      expectedAmount: price.amount,
      n1: body.n1,
      n2: body.n2,
      n3: body.n3,
      n4: body.n4,
      n5: body.n5,
      powerball: body.powerball,
      ...(body.returnAddress !== undefined
        ? { userReturnAddress: body.returnAddress }
        : {}),
    });

    // Derivar dirección real y actualizar la fila.
    const derived = deps.wallet.deriveAddress(Number(ticket.id));
    await deps.db.db
      .update(tickets)
      .set({ paymentAddress: derived.address })
      .where(eq(tickets.id, ticket.id));

    const bip21Uri = buildBip21Uri(derived.address, price.amount);
    const qrSvg = renderQrSvg(bip21Uri);

    reply.code(201);
    return {
      id: Number(ticket.id),
      sorteoId: Number(ticket.sorteoId),
      status: ticket.status,
      expectedAmount: price.amount,
      hasDiscount: price.hasDiscount,
      paymentAddress: derived.address,
      bip21Uri,
      qrSvg,
    };
  });

  app.get("/tickets/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      reply.code(400);
      return { error: "id inválido" };
    }
    const ticket = await getTicketById(deps.db.db, id);
    if (!ticket) {
      reply.code(404);
      return { error: "ticket no encontrado" };
    }
    return {
      id: Number(ticket.id),
      sorteoId: Number(ticket.sorteoId),
      status: ticket.status,
      expectedAmount: ticket.expectedAmount,
      paymentAddress: ticket.paymentAddress,
      combinacion: {
        n1: ticket.n1, n2: ticket.n2, n3: ticket.n3, n4: ticket.n4, n5: ticket.n5,
        powerball: ticket.powerball,
      },
      recibidoEn: ticket.recibidoEn,
    };
  });
}
```

- [ ] **Step 5: Actualizar `apps/backend/test/health.test.ts` mockDeps**

Añadir `wallet` y `unisat` al retorno de `mockDeps` (para que cumpla `AppDeps`). Después de `db,` añadir:

```typescript
    wallet: { deriveAddress: vi.fn() } as unknown as HdWallet,
    unisat: { getBrc20Balance: vi.fn() } as unknown as UnisatClient,
```

Y los imports correspondientes al top del archivo:

```typescript
import type { HdWallet } from "@myloto/crypto";
import type { UnisatClient } from "@myloto/brc20";
```

- [ ] **Step 6: Correr tests para verificar que pasan**

Run: `pnpm install` (para que se resuelvan las nuevas deps `@myloto/crypto`, `@myloto/brc20`, `@myloto/payments`)
Run: `pnpm --filter @myloto/backend test`
Expected: 6 routes-tickets + 4 services-pricing + 6 services-tickets + 4 health = 20 PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend pnpm-lock.yaml
git commit -m "feat(backend): POST/GET /tickets con derivación HD + descuento Hold-to-Earn"
```

---

## Task 9: Wire-up del servidor (registrar /tickets)

**Objetivo:** Que el servidor Fastify sirva `/tickets` además de `/health`.

**Files:**
- Modify: `apps/backend/src/server.ts`

- [ ] **Step 1: Modificar `apps/backend/src/server.ts`**

Añadir el import después del import de health:

```typescript
import { registerTicketRoutes } from "./routes/tickets.js";
```

Añadir el registro después de `registerHealthRoutes(app, deps);`:

```typescript
  registerTicketRoutes(app, deps);
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter @myloto/backend typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): servidor registra rutas /tickets"
```

---

## Task 10: Worker `payment-verifier` (TDD)

**Objetivo:** Worker que transiciona `PENDIENTE → ACTIVO`.

**Files:**
- Create: `apps/backend/test/worker-payment-verifier.test.ts`
- Create: `apps/backend/src/workers/payment-verifier.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi } from "vitest";
import { runRound } from "../src/workers/payment-verifier.js";
import type { Logger } from "@myloto/config";

const logger: Logger = {
  trace: vi.fn(), debug: vi.fn(), info: vi.fn(),
  warn: vi.fn(), error: vi.fn(), fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function makeDeps(overrides: Partial<{
  getPending: ReturnType<typeof vi.fn>;
  markActive: ReturnType<typeof vi.fn>;
  getReceived: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getPendingTickets: overrides.getPending ?? vi.fn().mockResolvedValue([]),
    markActive: overrides.markActive ?? vi.fn().mockResolvedValue(undefined),
    getReceived: overrides.getReceived ?? vi.fn().mockResolvedValue(0),
    logger,
    minconf: 1,
  };
}

describe("runRound (worker)", () => {
  it("sin tickets pendientes → checked 0, activated 0", async () => {
    const result = await runRound(makeDeps());
    expect(result).toEqual({ checked: 0, activated: 0 });
  });

  it("ticket pagado (received >= expected) → activado", async () => {
    const getPending = vi.fn().mockResolvedValue([
      { id: 1n, paymentAddress: "bc1q1", expectedAmount: "100" },
    ]);
    const getReceived = vi.fn().mockResolvedValue(100);
    const markActive = vi.fn().mockResolvedValue(undefined);
    const result = await runRound(makeDeps({ getPending, getReceived, markActive }));
    expect(result).toEqual({ checked: 1, activated: 1 });
    expect(markActive).toHaveBeenCalledWith(1);
  });

  it("ticket no pagado (received < expected) → no activado", async () => {
    const getPending = vi.fn().mockResolvedValue([
      { id: 2n, paymentAddress: "bc1q2", expectedAmount: "100" },
    ]);
    const getReceived = vi.fn().mockResolvedValue(50);
    const markActive = vi.fn();
    const result = await runRound(makeDeps({ getPending, getReceived, markActive }));
    expect(result).toEqual({ checked: 1, activated: 0 });
    expect(markActive).not.toHaveBeenCalled();
  });

  it("error individual no mata el round", async () => {
    const getPending = vi.fn().mockResolvedValue([
      { id: 1n, paymentAddress: "bc1q1", expectedAmount: "100" },
      { id: 2n, paymentAddress: "bc1q2", expectedAmount: "100" },
    ]);
    const getReceived = vi.fn()
      .mockRejectedValueOnce(new Error("rpc down"))   // ticket 1 falla
      .mockResolvedValueOnce(100);                     // ticket 2 ok
    const markActive = vi.fn();
    const result = await runRound(makeDeps({ getPending, getReceived, markActive }));
    expect(result).toEqual({ checked: 2, activated: 1 });
    expect(markActive).toHaveBeenCalledTimes(1);
    expect(markActive).toHaveBeenCalledWith(2);
    expect(logger.warn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/workers/payment-verifier.js'".

- [ ] **Step 3: Implementar `apps/backend/src/workers/payment-verifier.ts`**

```typescript
import { buildDeps } from "../dependencies.js";
import { getPendingTickets, markActive } from "../services/tickets.js";
import { verifyPayment } from "@myloto/payments";
import type { Logger } from "@myloto/config";

export interface WorkerDeps {
  getPendingTickets: () => Promise<
    { id: bigint; paymentAddress: string; expectedAmount: string }[]
  >;
  markActive: (id: number) => Promise<void>;
  getReceived: (address: string, minconf: number) => Promise<number>;
  logger: Logger;
  minconf: number;
}

/**
 * Una ronda de verificación. Exportada para tests.
 */
export async function runRound(
  deps: WorkerDeps,
): Promise<{ checked: number; activated: number }> {
  const pending = await deps.getPendingTickets();
  let activated = 0;
  for (const ticket of pending) {
    try {
      const expected = Number(ticket.expectedAmount);
      const result = await verifyPayment({
        getReceived: deps.getReceived,
        ticket: {
          paymentAddress: ticket.paymentAddress,
          expectedAmount: expected,
        },
        minconf: deps.minconf,
      });
      if (result.paid) {
        await deps.markActive(Number(ticket.id));
        activated++;
        deps.logger.info("ticket activado", {
          id: Number(ticket.id),
          received: result.received,
        });
      }
    } catch (err) {
      // Error individual no mata el round.
      deps.logger.warn("verificación fallida", {
        id: Number(ticket.id),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return { checked: pending.length, activated };
}

/**
 * Loop infinito con shutdown graceful (SIGTERM/SIGINT).
 */
export function runLoop(deps: WorkerDeps, intervalMs: number): void {
  let stopping = false;
  const stop = (): void => {
    stopping = true;
    deps.logger.info("worker recibió señal de shutdown, esperando ronda actual");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  const tick = async (): Promise<void> => {
    if (stopping) {
      deps.logger.info("worker detenido");
      process.exit(0);
    }
    try {
      const stats = await runRound(deps);
      deps.logger.info("ronda completa", stats);
    } catch (err) {
      deps.logger.error("ronda falló (no fatal)", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    setTimeout(tick, intervalMs);
  };
  tick();
}

async function main(): Promise<void> {
  const deps = buildDeps();
  const workerDeps: WorkerDeps = {
    getPendingTickets: () => getPendingTickets(deps.db.db),
    markActive: (id) => markActive(deps.db.db, id),
    getReceived: (addr, minconf) =>
      deps.rpc.getReceivedByAddress(addr, minconf),
    logger: deps.logger,
    minconf: deps.env.PAYMENT_MIN_CONFIRMATIONS,
  };
  deps.logger.info("arrancando worker de verificación de pagos", {
    intervalMs: deps.env.PAYMENT_CHECK_INTERVAL_MS,
    minconf: deps.env.PAYMENT_MIN_CONFIRMATIONS,
  });
  runLoop(workerDeps, deps.env.PAYMENT_CHECK_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 4 worker + 6 routes-tickets + 4 services-pricing + 6 services-tickets + 4 health = 24 PASS.

- [ ] **Step 5: Añadir script npm en `apps/backend/package.json`**

Añadir a `scripts`:

```json
    "worker:payments": "tsx src/workers/payment-verifier.ts",
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): worker payment-verifier (PENDIENTE→ACTIVO, shutdown graceful)"
```

---

## Task 11: Verificación global + demo E2E

**Objetivo:** Confirmar workspace verde + demo E2E con FB real contra nodo Fractal.

**Files:**
- Create (temporal): `scripts/demo-cycle4.ts`

- [ ] **Step 1: Typecheck global**

Run: `pnpm -r typecheck`
Expected: todos los paquetes Done, exit 0.

- [ ] **Step 2: Tests unitarios globales**

Run: `pnpm -r test`
Expected: todo verde (payments ~11 + config 17 + brc20 37 + rpc-client 24 + crypto 36 + backend 24).

- [ ] **Step 3: Crear script demo `scripts/demo-cycle4.ts`**

```typescript
import { config } from "dotenv";
import { createDb } from "../packages/db/src/index.js";
import { FractalRpcClient, FractalTransport } from "../packages/rpc-client/src/index.js";
import { HdWallet } from "../packages/crypto/src/index.js";
import { buildBip21Uri, renderQrSvg } from "../packages/crypto/src/index.js";
import { calculatePrice } from "../packages/payments/src/index.js";

config();

async function main(): Promise<void> {
  const db = createDb(process.env.DATABASE_URL!);
  const transport = new FractalTransport({
    url: process.env.FRACTAL_RPC_URL!,
    username: process.env.FRACTAL_RPC_USER!,
    password: process.env.FRACTAL_RPC_PASSWORD!,
  });
  const rpc = new FractalRpcClient(transport);
  const wallet = new HdWallet({ xpub: process.env.XPUB_BIP86! });

  console.log("=== Demo MYLoto Ciclo 4 — Motor de Pagos ===\n");

  // 1. Info del nodo
  const info = await rpc.getBlockchainInfo();
  console.log(`Nodo: chain=${info.chain} blocks=${info.blocks}`);

  // 2. Derivar dirección para un ticketId de demo
  const derived = wallet.deriveAddress(1);
  console.log(`\nDirección derivada (ticketId=1): ${derived.address}`);
  console.log(`Ruta: ${derived.path}`);

  // 3. Precio
  const price = calculatePrice(false);
  console.log(`\nPrecio (sin descuento): ${price.amount} FB`);

  // 4. BIP21 + QR
  const bip21 = buildBip21Uri(derived.address, price.amount);
  console.log(`\nBIP21: ${bip21}`);
  console.log(`QR generado (${renderQrSvg(bip21).length} bytes SVG)`);

  // 5. Estado de pago actual (esperado: 0 si nadie ha pagado)
  const received = await rpc.getReceivedByAddress(derived.address, 1);
  console.log(`\nRecibido en la dirección: ${received} FB`);
  console.log(`¿Pagado? ${received >= price.amount}`);

  await db.pool.end();
}

main().catch((err) => {
  console.error("Demo falló:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Ejecutar demo contra nodo Fractal real**

Run (con timeout 20s):
```
cd apps/backend && env $(grep -v '^#' ../../.env | xargs) node_modules/.bin/tsx ../../scripts/demo-cycle4.ts
```
Expected: muestra info del nodo, dirección derivada, precio, BIP21, y estado de pago (0 si nadie pagó).

- [ ] **Step 5: Demo E2E con pago FB real (manual)**

Esta es la verificación completa end-to-end, requiere intervención manual:

1. Confirmar que hay un sorteo ABIERTO en la DB (si no, insertar uno vía SQL: `INSERT INTO sorteos (bloque_cierre, estado) VALUES (<altura_actual + 100>, 'ABIERTO');`).
2. Arrancar el backend: `pnpm dev`.
3. POST /tickets (sin brc20Address → precio completo 100 FB):
   ```
   curl -X POST http://localhost:3000/tickets \
     -H 'Content-Type: application/json' \
     -d '{"n1":5,"n2":17,"n3":23,"n4":42,"n5":60,"powerball":13}'
   ```
   → Anotar el `paymentAddress` y `bip21Uri` de la respuesta.
4. Enviar 100 FB desde una wallet Fractal al `paymentAddress` (wallet del operador o test wallet).
5. Esperar 1 confirmación (~10-30s en Fractal).
6. Arrancar el worker: `pnpm --filter @myloto/backend worker:payments`.
7. Verificar que el worker loguea "ticket activado" para el ticket creado.
8. GET http://localhost:3000/tickets/<id> → `status: "ACTIVO"`.
9. Detener el worker (Ctrl-C → shutdown graceful).

Registrar el output observado. Si el pago FB no es posible en este momento, documentar el paso 4-5 como pendiente y ejecutar el resto.

- [ ] **Step 6: Borrar script demo temporal**

Run: `rm -f scripts/demo-cycle4.ts && rmdir scripts 2>/dev/null || true`

- [ ] **Step 7: Commit final**

```bash
git add -A
git commit -m "chore: verificación end-to-end del Ciclo 4 completa"
```

- [ ] **Step 8: Marcar el ciclo como completo**

Entregables verificados (spec §9):
1. ✅ `pnpm install` sin errores
2. ✅ `pnpm --filter @myloto/payments typecheck` exit 0
3. ✅ `pnpm --filter @myloto/payments test` (unitarios) todo verde
4. ✅ `pnpm --filter @myloto/backend test` (unitarios) todo verde
5. ✅ `pnpm -r test` todo verde
6. ✅ `pnpm -r typecheck` todo verde
7. ✅ Demo E2E: POST /tickets → pago FB real → worker → ACTIVO

---

## Self-Review del Plan

### Especificación cubierta

| Sección del spec | Tarea que lo implementa |
|---|---|
| §3 Estructura (packages/payments + backend services/routes/workers) | Tasks 1, 6, 7, 8, 9, 10 |
| §4.1 calculatePrice | Task 3 |
| §4.2 verifyPayment | Task 4 |
| §4.3 PaymentError | Task 2 |
| §5.1 services/tickets (DB ops) | Task 6 |
| §5.2 services/pricing (bridge fail-closed) | Task 7 |
| §5.3 routes/tickets (POST/GET HTTP) | Task 8 |
| §5.4 workers/payment-verifier | Task 10 |
| §6 Variables de entorno + buildDeps | Task 5, Task 8 |
| §7 Validación balotas (Zod + DB) | Task 8 |
| §8 Tests | Tasks 2, 3, 4, 6, 7, 8, 10 |
| §9 Entregables | Task 11 |

Todas las secciones del spec tienen al menos una tarea. ✓

### Placeholder scan

- Sin "TBD", "implement later", "add appropriate error handling", ni bloques de redacción a corregir. ✓

### Type consistency

- `calculatePrice(hasDiscount, base?, discount?): TicketPrice` — consistente en Tasks 3, 7, 8, 11.
- `verifyPayment({getReceived, ticket, minconf?}): VerifyPaymentResult` — consistente en Tasks 4, 10.
- `resolveTicketPrice(brc20Address: string | null, deps): TicketPrice` — consistente en Tasks 7, 8.
- `WorkerDeps.getPendingTickets → {id: bigint, paymentAddress, expectedAmount: string}[]` — consistente en Task 10 (test y impl).
- `createTicket(db, input)` con `expectedAmount: number` (convierte a string internamente) — consistente en Tasks 6, 8.
- `markActive(db, id: number)` — consistente en Tasks 6, 10.
- `AppDeps` gana `wallet: HdWallet` y `unisat: UnisatClient` — consistente en Tasks 8, 9, 10.
- Variables env: `XPUB_BIP86` (required), `TICKET_PRICE_FB`, `TICKET_DISCOUNT_PRICE_FB`, `PAYMENT_CHECK_INTERVAL_MS`, `PAYMENT_MIN_CONFIRMATIONS` — consistentes en Tasks 5, 8, 10, 11.

Sin inconsistencias. ✓
