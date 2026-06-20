# Diseño: Motor de Pagos Híbrido + Compra de Tickets (Ciclo 4)

**Fecha:** 2026-06-20
**Ciclo:** 4 de 8
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)
**Depende de:** Ciclo 1 (config, db, rpc-client), Ciclo 2 (crypto/HD), Ciclo 3 (brc20/UniSat).

---

## 1. Contexto y Alcance

MYLoto vende boletos Powerball pagaderos en FB (Fractal Bitcoin). Cada boleto deriva una dirección Taproot única (BIP86) de la XPUB del operador; el usuario paga a esa dirección y un worker verifica el pago contra el nodo `fractald` vía `getreceivedbyaddress`. Los holders del token BRC-20 `Moonyetis` reciben un 20% de descuento (Hold-to-Earn).

### Objetivos de este ciclo

- Crear `packages/payments` con la lógica financiera pura (precio + verificación de pago).
- Implementar `POST /tickets` (comprar: validar, derivar dirección HD, calcular precio con/sin descuento, insertar) y `GET /tickets/:id` (estado).
- Implementar un worker separado que verifica pagos pendientes y transiciona tickets `PENDIENTE → ACTIVO`.
- Integrar el descuento Hold-to-Earn con fail-closed (precio completo si UniSat falla).
- Demo E2E con envío real de FB contra el nodo Fractal.

### No incluye este ciclo (explícito)

- Gestión completa de sorteos (crear/cerrar sorteos, cron de cierre por bloque) — Ciclo 7.
- Escrutinio y reparto de premios — Ciclo 6.
- Frontend de compra — Ciclo 8.
- Concurrencia/paralelismo en el worker (procesamiento secuencial) — se evalúa en Ciclo 7 si el volumen lo justifica.
- Caché de balances UniSat — YAGNI (decisión ya tomada en Ciclo 3).
- Captura obligatoria de la dirección BRC-20 del usuario: es opcional en la compra; sin ella, precio completo.

---

## 2. Stack y Decisiones Consolidadas

| Decisión | Elección | Justificación |
|---|---|---|
| Alcance | Cron + compra de ticket (POST/GET /tickets) | Permite demo E2E real sin solapar con gestión de sorteos (Ciclo 7) |
| Arquitectura | Paquete nuevo `packages/payments` + `services/` en backend + worker separado | Sigue el patrón de los Ciclos 1-3: dominio puro en `packages/`, composición en `apps/` |
| Ejecución del cron | Worker separado (`pnpm worker:payments`) | El servidor Fastify no se bloquea; si el worker cae, la API sigue. Patrón estándar en dApps |
| Confirmación de pago | `minconf=1`, monto recibido ≥ esperado | 1 confirmación (~10-30s en Fractal) equilibra velocidad y seguridad; el sorteo cierra por bloque así que habrá varias confirmaciones antes del escrutinio |
| Fail-closed UniSat | Precio completo si UniSat falla al calcular precio | El usuario nunca recibe descuento al que no tiene derecho. Más seguro financieramente |
| Sorteo activo | Auto: único sorteo con `estado='ABIERTO'` | Sin `sorteoId` en el body; los sorteos se crean vía seed/SQL por ahora (Ciclo 7 los gestiona) |
| Precios | 100 FB base / 80 FB con descuento (20% off), configurables por env | Números redondos para la demo; ajustables sin redeploys |
| `brc20Address` | Opcional en `POST /tickets` | Si no se declara, precio completo; el descuento es opt-in del usuario |
| `XPUB_BIP86` | Pasa de opcional a **required** | El Ciclo 4 deriva direcciones por ticket; no opera sin XPUB |
| Concurrencia del worker | Secuencial por ticket | YAGNI; suficiente para el volumen esperado (cientos, no millones pendientes a la vez) |
| Dependencias de `payments` | Ninguna de infra (sin rpc-client, sin db) | `getReceived` inyectable como función; dominio puro testeable con stubs |

### Endpoint RPC confirmado

```
getreceivedbyaddress <address> <minconf>
→ número (total recibido en FB por esa dirección, con ≥ minconf confirmaciones)
```

Ya implementado en `FractalRpcClient.getReceivedByAddress(address, minconf)` (Ciclo 1).

### Librerías

- **Sin dependencias nuevas.** Reutilizamos: `@myloto/config`, `@myloto/db`, `@myloto/rpc-client`, `@myloto/crypto`, `@myloto/brc20`, `@myloto/types`, Fastify, Drizzle, Zod.

---

## 3. Estructura

```
packages/payments/                    # NUEVO — dominio puro, testeable sin DB/red
├── src/
│   ├── pricing.ts                    # calculatePrice(hasDiscount, base, discount): TicketPrice
│   ├── verifier.ts                   # verifyPayment({getReceived, ticket, minconf}): result
│   ├── errors.ts                     # PaymentError jerarquía
│   └── index.ts                      # exports públicos
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
│   │   ├── tickets.ts                # NUEVO — DB ops Drizzle
│   │   └── pricing.ts                # NUEVO — bridge brc20 + payments + fail-closed
│   ├── routes/
│   │   ├── tickets.ts                # NUEVO — POST /tickets, GET /tickets/:id
│   │   └── health.ts                 # existe
│   ├── workers/
│   │   └── payment-verifier.ts       # NUEVO — loop del worker
│   ├── dependencies.ts               # MODIFICADO — añade wallet + unisat
│   └── server.ts                     # MODIFICADO — registra ruta /tickets
└── test/
    ├── services-tickets.test.ts
    ├── services-pricing.test.ts
    ├── routes-tickets.test.ts
    ├── worker-payment-verifier.test.ts
    └── health.test.ts                # existe (actualizado mocks)
```

**Modifica (otros paquetes):**
- `packages/config/src/env.ts` — `XPUB_BIP86` required + 4 vars nuevas.
- `packages/config/test/env.test.ts` — tests de las nuevas vars.
- `.env.example` — añadir las nuevas vars.

### Principios

- **`packages/payments`** — dominio puro: `calculatePrice` y `verifyPayment` no tocan DB ni red. `verifyPayment` recibe `getReceived` como función inyectable.
- **`services/`** — capa de composición del backend: acopla DB (Drizzle) y paquetes de dominio (crypto, brc20, payments). Inyectable en tests.
- **`routes/`** — HTTP fino: validación Zod, llama a services, formatea respuesta.
- **`workers/`** — loop independiente, mismo `buildDeps` (o `buildWorkerDeps`) pero sin Fastify.

---

## 4. `packages/payments`

### 4.1 `pricing.ts`

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

### 4.2 `verifier.ts`

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

### 4.3 `errors.ts`

```typescript
/**
 * Jerarquía de errores del motor de pagos.
 * Subclases para casos futuros (monto incorrecto, etc.); hoy solo la base.
 */
export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// Reservada para validaciones futuras (ej. monto recibido != esperado).
export class InsufficientPaymentError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPaymentError";
  }
}
```

---

## 5. Backend — Services, Routes, Worker

### 5.1 `services/tickets.ts` (DB ops Drizzle)

```typescript
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@myloto/db";
import type { Sorteo, Ticket } from "@myloto/db";

export interface CreateTicketInput {
  sorteoId: number;
  paymentAddress: string;
  /** Precio en FB. Drizzle recibe number y lo persiste como NUMERIC(18,8). */
  expectedAmount: number;
  n1: number; n2: number; n3: number; n4: number; n5: number;
  powerball: number;
  userReturnAddress?: string;
}

/** Devuelve el único sorteo ABIERTO, o null si no hay. */
export async function getActiveSorteo(db: NodePgDatabase<typeof schema>): Promise<Sorteo | null>;

/** Inserta un ticket y devuelve la fila completa (con id generado). */
export async function createTicket(db: NodePgDatabase<typeof schema>, input: CreateTicketInput): Promise<Ticket>;

/** Devuelve un ticket por id, o null. */
export async function getTicketById(db: NodePgDatabase<typeof schema>, id: number): Promise<Ticket | null>;

/** Tickets pendientes de pago (para el worker). */
export async function getPendingTickets(db: NodePgDatabase<typeof schema>): Promise<Ticket[]>;

/** Transición idempotente PENDIENTE → ACTIVO. UPDATE WHERE status='PENDIENTE'. */
export async function markActive(db: NodePgDatabase<typeof schema>, id: number): Promise<void>;
```

**Idempotencia de `markActive`:** el `UPDATE ... WHERE id = $1 AND status = 'PENDIENTE'` garantiza que si el worker re-procesa un ticket ya activado, no haya doble transición ni error. El CHECK constraint `chk_ticket_status` impide `ACTIVO → *` a nivel DB (defensa en profundidad).

### 5.2 `services/pricing.ts` (bridge brc20 + payments + fail-closed)

```typescript
import { UnisatClient } from "@myloto/brc20";
import { qualifiesForDiscount } from "@myloto/brc20";
import { calculatePrice, type TicketPrice } from "@myloto/payments";
import type { Logger } from "@myloto/config";

export interface ResolvePriceDeps {
  unisatClient: UnisatClient;
  ticker: string;          // env.BRC20_TICKER
  basePrice: number;       // env.TICKET_PRICE_FB
  discountPrice: number;   // env.TICKET_DISCOUNT_PRICE_FB
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
  if (!brc20Address) {
    return calculatePrice(false, deps.basePrice, deps.discountPrice);
  }
  try {
    const balance = await deps.unisatClient.getBrc20Balance(brc20Address, deps.ticker);
    const hasDiscount = qualifiesForDiscount(balance.availableBalance);
    return calculatePrice(hasDiscount, deps.basePrice, deps.discountPrice);
  } catch (err) {
    // FAIL-CLOSED: UniSat falló → precio completo, sin descuento.
    deps.logger.warn("UniSat falló al verificar descuento; aplicando precio completo", {
      brc20Address: brc20Address.slice(0, 12) + "...",
      error: err instanceof Error ? err.message : "unknown",
    });
    return {
      amount: deps.basePrice,
      hasDiscount: false,
      reason: "UNISAT_FAILED",
    };
  }
}
```

### 5.3 `routes/tickets.ts` (HTTP)

**`POST /tickets`**
```
Body:   { n1, n2, n3, n4, n5, powerball, returnAddress?, brc20Address? }
  - n1-n5: enteros 1-69, estrictamente ordenados asc (valida Zod antes de DB)
  - powerball: entero 1-26
  - returnAddress: string opcional (dirección de devolución)
  - brc20Address: string opcional (para descuento Hold-to-Earn)
Éxito:  201 { id, sorteoId, status, expectedAmount, paymentAddress, bip21Uri, qrSvg }
Errores:
  400 — balotas fuera de rango / no ordenadas / powerball inválido / tipos incorrectos
  409 — no hay sorteo ABIERTO activo
  500 — error interno (DB, derivación HD)
```

**`GET /tickets/:id`**
```
Éxito:  200 { id, sorteoId, status, expectedAmount, paymentAddress, combinacion, recibidoEn }
Errores: 404 si no existe
```

**Flujo interno de `POST /tickets`:**
1. Validar body con Zod (rango, orden, tipos) → 400 si falla.
2. `getActiveSorteo()` → 409 si null.
3. `resolveTicketPrice(body.brc20Address, deps)` → `TicketPrice`.
4. `createTicket()` con `expectedAmount` = precio, `paymentAddress` placeholder temporal.
5. `wallet.deriveAddress(ticket.id)` → dirección real.
6. `UPDATE ticket SET payment_address = derivada`.
7. `generateTicketPayment({ wallet, ticketId, amountMb })` → bip21Uri + qrSvg.
8. Responder 201.

> **Nota sobre el orden INSERT→UPDATE:** El `id` BIGSERIAL solo existe tras el INSERT, y es el índice de derivación HD. Por eso insertamos primero con placeholder y actualizamos la dirección. Alternativa: reservar el id con una secuencia explícita, pero añade complejidad sin beneficio. El ticket está `PENDIENTE` durante el instante entre INSERT y UPDATE; si el proceso cae ahí, queda sin dirección válida — el worker lo ignora (no tiene dirección que verificar) y una query de limpieza periódica (Ciclo 7) puede marcarlo. Aceptable para MVP.

### 5.4 `workers/payment-verifier.ts`

```typescript
export interface WorkerDeps {
  db: NodePgDatabase<typeof schema>;
  rpc: { getReceivedByAddress(addr: string, minconf?: number): Promise<number> };
  logger: Logger;
  minconf: number;
}

/** Una ronda de verificación. Exportada para tests. */
export async function runRound(deps: WorkerDeps): Promise<{ checked: number; activated: number }>;

/** Loop infinito con shutdown graceful. */
export function runLoop(deps: WorkerDeps, intervalMs: number): void;

// main(): construye deps desde env y arranca runLoop. Captura SIGTERM/SIGINT.
```

**Comportamiento de `runRound`:**
```
pending = getPendingTickets(db)
activated = 0
for ticket in pending:
  try:
    # Drizzle devuelve expectedAmount como string (NUMERIC); convertir a number
    expected = Number(ticket.expectedAmount)
    result = verifyPayment({ getReceived: rpc.getReceivedByAddress.bind(rpc),
                             ticket: { paymentAddress: ticket.paymentAddress, expectedAmount: expected },
                             minconf })
    if result.paid: markActive(db, ticket.id); activated++
  catch err:
    logger.warn("verificación fallida", { id, err })  // continúa con el siguiente
return { checked: pending.length, activated }
```

**Shutdown graceful:** `runLoop` captura SIGTERM/SIGINT, pone un flag `stopping=true`, no inicia nueva ronda, espera a que termine la actual (con timeout), cierra el pool de DB. Previene activaciones duplicadas al reiniciar.

---

## 6. Integración con `@myloto/config`

### 6.1 Variables de entorno nuevas

```typescript
// --- XPUB BIP86 (era opcional, AHORA REQUIRED) ---
XPUB_BIP86: z.string().min(1),

// --- Precios de boleto (Hold-to-Earn) ---
TICKET_PRICE_FB: z.coerce.number().positive().default(100),
TICKET_DISCOUNT_PRICE_FB: z.coerce.number().positive().default(80),

// --- Worker de verificación de pagos ---
PAYMENT_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
PAYMENT_MIN_CONFIRMATIONS: z.coerce.number().int().min(0).default(1),
```

### 6.2 `.env.example`

```bash
# --- XPUB BIP86 (OBLIGATORIO desde Ciclo 4 — derivación de direcciones de boleto) ---
XPUB_BIP86=xpub6BgBgspe...

# --- Precios de boleto (Hold-to-Earn) ---
TICKET_PRICE_FB=100
TICKET_DISCOUNT_PRICE_FB=80

# --- Worker de verificación de pagos ---
PAYMENT_CHECK_INTERVAL_MS=30000
PAYMENT_MIN_CONFIRMATIONS=1
```

### 6.3 `buildDeps()` extendido

```typescript
export interface AppDeps {
  env: Env;
  logger: Logger;
  db: DbHandle;
  rpc: FractalRpcClient;
  wallet: HdWallet;          // NUEVO
  unisat: UnisatClient;      // NUEVO
}

export function buildDeps(): AppDeps {
  // ... existente ...
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

---

## 7. Validación de Balotas (defensa en profundidad)

La DB ya impone (Ciclo 1): `chk_balotas_sorted` (n1<n2<n3<n4<n5), `chk_balotas_range` (1-69), `chk_powerball_range` (1-26).

El backend valida **antes** con Zod para dar error 400 claro en vez de un 500 de constraint violation:

```typescript
const TicketBodySchema = z.object({
  n1: z.number().int().min(1).max(69),
  // ... n2-n5 igual
  powerball: z.number().int().min(1).max(26),
  returnAddress: z.string().optional(),
  brc20Address: z.string().optional(),
}).refine(
  (d) => d.n1 < d.n2 && d.n2 < d.n3 && d.n3 < d.n4 && d.n4 < d.n5,
  { message: "las balotas deben ir ordenadas de menor a mayor sin repetir" },
);
```

Doble defensa: Zod (UX) + CHECK DB (invariant).

---

## 8. Tests

### 8.1 `packages/payments` (unitarios, sin DB/red)

**`pricing.test.ts`** (~4 tests):
- `calculatePrice(true)` → `{ amount: 80, hasDiscount: true, reason: "HOLDER" }`.
- `calculatePrice(false)` → `{ amount: 100, hasDiscount: false, reason: "NO_HOLDER" }`.
- `calculatePrice` con base/discount custom respeta los valores.
- `calculatePrice(true)` con custom discount aplica el custom.

**`verifier.test.ts`** (~4 tests):
- `received >= expected` → `paid: true`.
- `received < expected` → `paid: false`.
- `received == expected` exacto → `paid: true` (límite).
- `getReceived` recibe `(address, minconf)` correctos; respeta minconf custom.

**`errors.test.ts`** (~2 tests):
- `PaymentError` guarda message y name.
- `InsufficientPaymentError extends PaymentError`.

### 8.2 Backend (unitarios con stubs/mocks)

**`services/tickets.test.ts`** (~6 tests): DB ops con Drizzle mockeado. `getActiveSorteo` devuelve ABIERTO/null, `createTicket` inserta y devuelve fila, `getTicketById` null si no existe, `markActive` transiciona, `getPendingTickets` filtra por status.

**`services/pricing.test.ts`** (~4 tests): `brc20Address` null → precio completo; holder con balance → descuento; UniSat lanza → fail-closed con `reason: "UNISAT_FAILED"` y precio base.

**`routes/tickets.test.ts`** (~6 tests): Fastify inject con deps mock. POST 201 body válido (devuelve id, paymentAddress, qrSvg), POST 400 balotas mal/ordenadas, POST 409 sin sorteo, GET 200 existente, GET 404 inexistente.

**`worker-payment-verifier.test.ts`** (~4 tests): `runRound` con stubs activa tickets pagados, ignora no pagados, continúa ante error individual de un ticket, idempotente.

### 8.3 Integración (`RUN_INTEGRATION=1`)

Demo E2E (ver §9): POST /tickets → enviar FB real → arrancar worker → verificar ACTIVO contra nodo Fractal real.

---

## 9. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `pnpm install` sin errores | OK |
| 2 | `pnpm --filter @myloto/payments typecheck` | Exit 0 |
| 3 | `pnpm --filter @myloto/payments test` (unitarios) | Todos pasan (~10) |
| 4 | `pnpm --filter @myloto/backend test` (unitarios) | Todos pasan (~20 nuevos) |
| 5 | `pnpm -r test` (todos los paquetes) | Todo verde |
| 6 | `pnpm -r typecheck` (todos los paquetes) | Todo verde |
| 7 | Demo E2E con FB real: POST /tickets → QR → pago FB → worker → ACTIVO | Script + output visible |

---

## 10. Decisiones de Diseño Clave (resumen)

1. **Paquete `payments` sin dependencias de infra** — `getReceived` inyectable desacopla el dominio del rpc-client; testeable con stubs. Igual que `brc20` no depende de `db`.
2. **`reason` de auditoría en `TicketPrice`** — `HOLDER | NO_HOLDER | UNISAT_FAILED` permite saber por qué se cobró un precio concreto; útil para debugging y métricas del fail-closed.
3. **Fail-closed en `services/pricing.ts`**, no en `payments` — la decisión financiera vive en el bridge, que es donde se acopla UniSat. El paquete `payments` no sabe nada de UniSat.
4. **Derivación HD tras INSERT** — el `id` BIGSERIAL es el índice de derivación; insertamos primero y actualizamos la dirección. Pequeña ventana PENDIENTE-sin-dirección aceptable para MVP.
5. **Worker separado del servidor** — Fastify y el worker comparten `buildDeps` pero no proceso. Robustez operacional.
6. **Shutdown graceful del worker** — SIGTERM/SIGINT esperan la ronda actual antes de cerrar el pool. Previene activaciones duplicadas al reiniciar.
7. **`markActive` idempotente** — `WHERE status='PENDIENTE'` + CHECK constraint `chk_ticket_status` = defensa en profundidad.
8. **Validación Zod previa + CHECK DB** — UX clara (400) + invariant fuerte (DB).
9. **`XPUB_BIP86` required** — correcto: el backend del Ciclo 4 no opera sin XPUB. Tests mockean deps, no rompen.
10. **Procesamiento secuencial del worker** — YAGNI; el volumen esperado no justifica concurrencia ahora.

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Pago llega pero worker caído → ticket no activado | Media | Medio | Worker reiniciable; `getreceivedbyaddress` es acumulativo, no se pierde pagos. Monitoreo del worker (Ciclo 7) |
| Pago parcial (received < expected) | Baja | Bajo | `verifyPayment` reporta `paid:false`; el ticket sigue PENDIENTE hasta completar o el sorteo cierre |
| Doble activación al reiniciar worker | Baja | Bajo | `markActive` idempotente (`WHERE status='PENDIENTE'`) + CHECK DB |
| UniSat cae durante compra | Media | Bajo | Fail-closed: precio completo. Usuario paga de más puntualmente; no recibe descuento indebido |
| Derivación HD falla tras INSERT | Baja | Medio | Ticket queda PENDIENTE sin dirección válida; limpieza periódica (Ciclo 7). No afecta a otros tickets |
| `getreceivedbyaddress` lento con muchas direcciones | Baja | Medio | Secuencial por ahora; concurrencia con semáforo en Ciclo 7 si el volumen crece |
| XPUB mal configurada → todas las derivaciones inválidas | Baja | Alto | `HdWallet` valida XPUB al construir (Ciclo 2); `buildDeps` falla al arrancar si es inválida (fail-fast) |
| Usuario paga después del cierre del sorteo | Media | Bajo | El worker activa el ticket igual (pago válido), pero el escrutinio (Ciclo 6) determina si cuenta para el sorteo |

---

## 12. Próximos Ciclos (Roadmap actualizado)

1. ✅ **Ciclo 1:** Fundación + Cliente RPC
2. ✅ **Ciclo 2:** Derivación HD + QR
3. ✅ **Ciclo 3:** `packages/brc20` — cliente UniSat + descuento
4. 🔄 **Ciclo 4:** Motor de pagos híbrido + compra de tickets (este spec)
5. **Ciclo 5:** `packages/randomness` — motor on-chain Fisher-Yates, listener de bloques
6. **Ciclo 6:** Escrutinio y reparto de premios
7. **Ciclo 7:** Backend completo — gestión de sorteos (crear/cerrar por bloque), orquestación, concurrencia del worker, monitoreo
8. **Ciclo 8:** Frontend Next.js — UI de selección, pago + QR, animación de sorteo
