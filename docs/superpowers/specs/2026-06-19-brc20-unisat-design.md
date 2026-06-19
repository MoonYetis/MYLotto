# Diseño: Cliente UniSat BRC-20 + Descuento Hold-to-Earn (Ciclo 3)

**Fecha:** 2026-06-19
**Ciclo:** 3 de 8
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)
**Depende de:** Ciclo 1 (`@myloto/config`) — completado.

---

## 1. Contexto y Alcance

MYLoto ofrece un descuento promocional "Hold-to-Earn" a usuarios que poseen el token BRC-20 `Moonyetis`. El nodo `fractald` no incluye el indexador FIP-101, así que delegamos la consulta de balances BRC-20 a la **API Pública de UniSat** (`https://open-api-fractal.unisat.io`).

### Objetivos de este ciclo

- Implementar `packages/brc20` con un cliente UniSat tipado y resiliente.
- Consultar balance BRC-20 del token `Moonyetis` para una dirección declarada por el usuario.
- Determinar si el balance califica para el descuento Hold-to-Earn (regla: balance disponible > 0).
- Tests unitarios con fixtures + integración contra UniSat real.

### No incluye este ciclo (explícito)

- Aplicación real del descuento en el precio del boleto (Ciclo 4).
- Endpoint HTTP `/tickets/:id/discount-eligibility` (Ciclo 4 o 7).
- Captura de la dirección del usuario en el flujo de compra (Ciclo 7/8).
- Caché de balances (YAGNI — se evaluará en Ciclo 4 si el patrón de uso lo justifica).
- Decisión fail-closed/fail-open (vive en el Ciclo 4; este paquete solo reporta errores).

---

## 2. Stack y Decisiones Consolidadas

| Decisión | Elección | Justificación |
|---|---|---|
| Dirección a consultar | Wallet address **declarada por el usuario** | Estándar Hold-to-Earn, no acopla al sistema de pagos |
| Monto mínimo | Cualquier balance disponible > 0 | MVP simple, fomenta adopción del token |
| API del paquete | `getBrc20Balance(addr, ticker)` + `qualifiesForDiscount(balance)` pura | Separa infraestructura de lógica de negocio |
| Ticker BRC-20 | `Moonyetis` configurable vía `BRC20_TICKER` | Permite cambios sin redeploys |
| API key | `UNISAT_API_KEY` required (ya obtenida por el usuario) | Bearer auth en header |
| Formato dirección | Cualquier Bitcoin/Fractal válido (bc1p, bc1q, 1..., 3...) | Cubre todos los holders posibles |
| Resiliencia | Transport propio + reintentos + circuit breaker | Protección anti-cascada si UniSat cae |
| Si UniSat falla | Fail-closed (decisión del Ciclo 4) | Este paquete reporta errores, no decide |
| Caché | Sin caché (YAGNI) | Se añadirá si el patrón de uso lo justifica |
| CircuitBreaker | **Duplicado** del Ciclo 1 (con TODO para extraer a `http-utils` cuando haya 3+ consumidores) | YAGNI: no refactoramos Ciclo 1 verde por caso hipotético |

### Endpoint UniSat confirmado

```
GET /v1/indexer/address/{address}/brc20/{ticker}/info
Authorization: Bearer <UNISAT_API_KEY>
```

Respuesta (formato UniSat estándar):
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "ticker": "Moonyetis",
    "overallBalance": "1000",
    "availableBalance": "950",
    "transferableBalance": "50"
  }
}
```

Si `code !== 0`, es un error lógico de la API (dirección inválida, ticker no encontrado, etc.).

### Librerías

- `@scure/base` — `bech32`, `bech32m`, `base58check(sha256)` para validación de direcciones.
- `@myloto/config` — logger pino.
- Sin dependencia de `@myloto/db`, `@myloto/rpc-client`, ni `@myloto/crypto`.

---

## 3. Estructura del Paquete

```
packages/brc20/
├── src/
│   ├── circuit-breaker.ts     # Duplicado del Ciclo 1 (mismo algoritmo, ver §2)
│   ├── transport.ts           # UnisatTransport: GET + Bearer + reintentos + breaker
│   ├── client.ts              # UnisatClient: getBrc20Balance(address, ticker)
│   ├── discount.ts            # qualifiesForDiscount(availableBalance) — función pura
│   ├── validate-address.ts    # isValidBitcoinAddress(address) — 4 formatos
│   ├── errors.ts              # jerarquía Brc20Error
│   └── index.ts               # exports públicos
├── test/
│   ├── unit/
│   │   ├── circuit-breaker.test.ts
│   │   ├── transport.test.ts
│   │   ├── client.test.ts
│   │   ├── discount.test.ts
│   │   ├── validate-address.test.ts
│   │   ├── errors.test.ts
│   │   └── fixtures.ts
│   └── integration/
│       └── unisat.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── vitest.integration.config.ts
```

### Principios

- **`circuit-breaker.ts`** — duplicado del Ciclo 1. Comentario: `// TODO: extraer a @myloto/http-utils cuando haya 3+ consumidores (regla de tres)`.
- **`transport.ts`** — UniSat usa GET + Bearer (distinto al POST + Basic de fractald), requiere transport propio.
- **`discount.ts`** y **`validate-address.ts`** — funciones puras, deterministas, testeables sin red.
- **Sin dependencia** de otros paquetes del workspace excepto `@myloto/config`.

---

## 4. `UnisatTransport` + `UnisatClient`

### 4.1 API del Transport

```typescript
export interface UnisatTransportOptions {
  baseUrl: string;           // https://open-api-fractal.unisat.io
  apiKey: string;            // Bearer token
  timeoutMs?: number;        // default 15000
  maxRetries?: number;       // default 3 (intentos adicionales)
  retryBackoffMs?: number;   // default 500
  breakerThreshold?: number; // default 5
  breakerResetMs?: number;   // default 30000
  fetchImpl?: typeof fetch;  // para tests
  logger?: Logger;
}

export class UnisatTransport {
  constructor(opts: UnisatTransportOptions);
  async get<T>(path: string, params?: Record<string, string>): Promise<T>;
}
```

#### Diferencias con `FractalTransport` (Ciclo 1)

| Aspecto | FractalTransport | UnisatTransport |
|---|---|---|
| Método HTTP | POST | GET |
| Auth | Basic (user:pass) | Bearer (apiKey) |
| Body | JSON-RPC 2.0 | Sin body (query string) |
| Respuesta error | JSON-RPC `error` con code negativo | `{ code: N, msg, data }` con code != 0 |
| Reintenta en | 5xx, timeout, ECONNRESET, RPC -28 | 5xx, timeout, ECONNRESET |
| No reintenta | 401, RPC -3 | 401, 429, code != 0 |

#### Comportamiento detallado

- **Bearer auth**: header `Authorization: Bearer <apiKey>`.
- **Query params**: construye `?key1=val1&key2=val2` desde el objeto `params`.
- **Timeout**: AbortController, default 15s.
- **Reintentos**: solo transitorios (5xx, timeout, errores de red). Backoff exponencial con jitter.
- **Circuit breaker**: CLOSED → OPEN tras `threshold` fallos consecutivos → HALF_OPEN tras `resetMs`.
- **Response parsing**: espera `{ code, msg, data }`. Si `code !== 0`, lanza `UnisatApiError(code, msg)` sin reintento.

### 4.2 API del Client

```typescript
export interface Brc20Balance {
  ticker: string;
  overallBalance: string;      // string: BRC-20 usa decimales arbitrarios
  availableBalance: string;    // balance líquido (no en transfer)
  transferableBalance: string; // en tx pendientes
}

export class UnisatClient {
  constructor(private transport: UnisatTransport);

  /**
   * Consulta el balance BRC-20 de un ticker para una dirección.
   * Endpoint: GET /v1/indexer/address/{address}/brc20/{ticker}/info
   *
   * @throws InvalidAddressError si la dirección no es Bitcoin válida.
   * @throws UnisatApiError si UniSat devuelve code !== 0.
   * @throws UnisatNetworkError si hay fallo de red agotando reintentos.
   * @throws CircuitOpenError si el breaker está abierto.
   */
  async getBrc20Balance(address: string, ticker: string): Promise<Brc20Balance>;
}
```

**Validación previa**: antes de llamar a UniSat, `isValidBitcoinAddress(address)` rechaza direcciones malformadas → `InvalidAddressError`. Ahorra un request y da error claro.

---

## 5. `discount.ts` + `validate-address.ts`

### 5.1 `isValidBitcoinAddress(address)`

```typescript
/**
 * Valida cualquier dirección Bitcoin/Fractal mainnet:
 * Legacy (1...), P2SH (3...), SegWit (bc1q...), Taproot (bc1p...).
 * Rechaza testnet (tb1..., m/n...).
 */
export function isValidBitcoinAddress(address: string): boolean;
```

**Algoritmo**:
1. Intentar `bech32m.decode` (Taproot `bc1p`) — HRP `bc`, witver 1, witness 32 bytes.
2. Si falla, intentar `bech32.decode` (SegWit `bc1q`) — HRP `bc`.
3. Si falla, intentar `base58check(sha256).decode` (Legacy/P2SH) — versión 0x00 (Legacy) o 0x05 (P2SH).
4. Si todo falla → `false`.

### 5.2 `qualifiesForDiscount(availableBalance)`

```typescript
/**
 * Determina si un balance califica para Hold-to-Earn.
 * Regla: availableBalance > 0.
 *
 * Usa availableBalance (no overallBalance) porque representa el balance
 * líquido: tokens no bloqueados en transfers pendientes.
 *
 * Fail-closed: strings inválidos o NaN → false.
 */
export function qualifiesForDiscount(availableBalance: string): boolean;
```

**Lógica**:
```typescript
export function qualifiesForDiscount(availableBalance: string): boolean {
  const n = Number(availableBalance);
  return Number.isFinite(n) && n > 0;
}
```

**Decisión `availableBalance` vs `overallBalance`**: `availableBalance` es lo que el usuario realmente tiene líquido. Si tiene tokens pero todos están "in transfer", no los tiene disponibles para justificar el descuento. Defensivo financieramente.

---

## 6. Errores Tipados

```typescript
export class Brc20Error extends Error {
  constructor(message: string) { super(message); this.name = "Brc20Error"; }
}

// --- Errores de validación ---
export class InvalidAddressError extends Brc20Error {}

// --- Errores de UniSat ---
export class UnisatAuthError extends Brc20Error {}        // 401
export class UnisatRateLimitError extends Brc20Error {}   // 429
export class UnisatApiError extends Brc20Error {          // code !== 0
  constructor(message: string, public code: number) { super(message); this.name = "UnisatApiError"; }
}
export class UnisatNetworkError extends Brc20Error {}     // ECONNRESET, etc.
export class UnisatTimeoutError extends Brc20Error {}
export class CircuitOpenError extends Brc20Error {}       // breaker abierto
```

Todas heredan de `Brc20Error` → el backend hace un único `instanceof Brc20Error`. La API key nunca se incluye en mensajes de error ni logs (redacción via logger pino).

---

## 7. Integración con `@myloto/config`

### 7.1 Variables de entorno nuevas

Añadir al schema Zod (`packages/config/src/env.ts`):

```typescript
// --- UniSat BRC-20 API ---
UNISAT_BASE_URL: z.string().url().default("https://open-api-fractal.unisat.io"),
UNISAT_API_KEY: z.string().min(1),  // required
UNISAT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

// --- Ticker BRC-20 para Hold-to-Earn ---
BRC20_TICKER: z.string().min(1).default("Moonyetis"),
```

### 7.2 `.env.example`

```bash
# --- UniSat BRC-20 API (para descuento Hold-to-Earn Moonyetis) ---
UNISAT_BASE_URL=https://open-api-fractal.unisat.io
UNISAT_API_KEY=your-api-key-from-developer.unisat.io
UNISAT_TIMEOUT_MS=15000
BRC20_TICKER=Moonyetis
```

### 7.3 Uso en backend (Ciclo 4, documentado para contexto)

```typescript
const transport = new UnisatTransport({
  baseUrl: env.UNISAT_BASE_URL,
  apiKey: env.UNISAT_API_KEY,
  timeoutMs: env.UNISAT_TIMEOUT_MS,
});
const client = new UnisatClient(transport);

const balance = await client.getBrc20Balance(userAddress, env.BRC20_TICKER);
const hasDiscount = qualifiesForDiscount(balance.availableBalance);
// El Ciclo 4 decide el precio según hasDiscount; si getBrc20Balance lanzó,
// el Ciclo 4 aplica fail-closed (precio completo).
```

---

## 8. Tests

### 8.1 Unitarios

**`circuit-breaker.test.ts`** — 7 tests (copia del Ciclo 1 adaptada).

**`transport.test.ts`** (FetchMock):
- GET con Bearer auth en header.
- Response `code: 0` parsea `data`.
- Response `code: 1` → `UnisatApiError` sin reintento.
- 401 → `UnisatAuthError` sin reintento.
- 429 → `UnisatRateLimitError`.
- 500 reintenta y termina OK.
- Timeout → reintenta.
- Circuit breaker abre tras N fallos consecutivos.

**`client.test.ts`**:
- `getBrc20Balance(addr, ticker)` llama al path `/v1/indexer/address/{addr}/brc20/{ticker}/info`.
- Devuelve `Brc20Balance` tipado.
- Dirección inválida → `InvalidAddressError` **sin llamar a UniSat**.

**`discount.test.ts`**:
- `qualifiesForDiscount("1000")` → `true`.
- `qualifiesForDiscount("0")` → `false`.
- `qualifiesForDiscount("0.5")` → `true`.
- `qualifiesForDiscount("invalid")` → `false` (fail-closed).
- `qualifiesForDiscount("")` → `false`.

**`validate-address.test.ts`**:
- `bc1p...` (Taproot) → `true`.
- `bc1q...` (SegWit) → `true`.
- `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2` (Legacy) → `true`.
- `3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy` (P2SH) → `true`.
- `tb1q...` (testnet) → `false`.
- `"invalid"` → `false`.
- `""` → `false`.

**`errors.test.ts`** — jerarquía correcta, `instanceof Brc20Error`.

### 8.2 Integración (`unisat.test.ts`, `RUN_INTEGRATION=1`)

Carga `UNISAT_API_KEY`, `UNISAT_BASE_URL`, `BRC20_TICKER` desde `.env`.

1. `getBrc20Balance("dirección_con_Moonyetis", "Moonyetis")` → `Brc20Balance` válido.
2. `getBrc20Balance("bc1q...sin_tokens", "Moonyetis")` → balance "0" o response controlada.
3. `getBrc20Balance("invalid", "Moonyetis")` → `InvalidAddressError` sin tocar UniSat.

> La dirección pública con Moonyetis la proporciona el usuario. Sin ella, estos tests se skippean.

---

## 9. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `pnpm install` sin errores | OK |
| 2 | `pnpm --filter @myloto/brc20 typecheck` | Exit 0 |
| 3 | `pnpm --filter @myloto/brc20 test` (unitarios) | Todos pasan |
| 4 | `RUN_INTEGRATION=1 pnpm --filter @myloto/brc20 test:integration` | UniSat real responde balance |
| 5 | `pnpm -r test` (todos los paquetes) | Todo verde |
| 6 | `pnpm -r typecheck` (todos los paquetes) | Todo verde |
| 7 | Demo E2E: script que consulta balance y aplica `qualifiesForDiscount` | Output visible |

---

## 10. Decisiones de Diseño Clave (resumen)

1. **Cliente UniSat separado del FractalTransport** — UniSat usa GET + Bearer (no POST + Basic); transport distinto, mismo patrón de resiliencia.
2. **`CircuitBreaker` duplicado** — YAGNI hasta 3+ consumidores; comentario TODO para extraer a `@myloto/http-utils`.
3. **`availableBalance` para el descuento** (no `overallBalance`) — representa tokens líquidos, no en transfer. Defensivo.
4. **Validación previa de dirección** — ahorra requests a UniSat y da error claro sin tocar la red.
5. **Ticker configurable** — `BRC20_TICKER` con default `"Moonyetis"`, permite cambio sin redeploys.
6. **Fail-closed en Ciclo 4, no aquí** — este paquete reporta errores; la decisión financiera vive en el motor de pagos. Separación de responsabilidades.
7. **Sin caché (YAGNI)** — se añadirá si el patrón de uso real lo justifica.
8. **Tests con API key real** — posible porque el usuario ya la tiene; valida de extremo a extremo.

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| UniSat cambia el formato de respuesta | Baja | Medio | Tests de integración detectan el cambio |
| API key filtrada en logs | Baja | Alto | Redacción pino `*.apiKey`, `Authorization` |
| UniSat rate-limits (429) durante picos | Media | Medio | `UnisatRateLimitError`, reintentos con backoff |
| Dirección inválida consume request UniSat | Baja | Bajo | `isValidBitcoinAddress` previene el request |
| Ticker BRC-20 cambia de nombre | Baja | Bajo | `BRC20_TICKER` configurable |
| UniSat cae y bloquea descuentos | Media | Medio | Fail-closed (Ciclo 4); usuario paga precio completo |

---

## 12. Próximos Ciclos (Roadmap actualizado)

1. ✅ **Ciclo 1:** Fundación + Cliente RPC
2. ✅ **Ciclo 2:** Derivación HD + QR
3. 🔄 **Ciclo 3:** `packages/brc20` — cliente UniSat + descuento (este spec)
4. **Ciclo 4:** Motor de pagos híbrido — cron de verificación vía `getreceivedbyaddress`, estado `ACTIVO`, integración DB + descuento.
5. **Ciclo 5:** `packages/randomness` — motor on-chain Fisher-Yates, listener de bloques.
6. **Ciclo 6:** Escrutinio y reparto de premios.
7. **Ciclo 7:** Backend completo — endpoints de negocio, orquestación.
8. **Ciclo 8:** Frontend Next.js — UI de selección, pago + QR, animación de sorteo.
