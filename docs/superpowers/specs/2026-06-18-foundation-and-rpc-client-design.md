# Diseño: Fundación del Proyecto + Cliente RPC de Fractal Bitcoin

**Fecha:** 2026-06-18
**Ciclo:** 1 de 8 (Fundación + Cliente RPC)
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)

---

## 1. Contexto y Alcance

MYLoto es una dApp de lotería estilo Powerball sobre la red Fractal Bitcoin. El proyecto completo comprende 8 subsistemas:

1. Fundación del proyecto + estructura monorepo (este ciclo)
2. Cliente RPC de Fractal Bitcoin (este ciclo)
3. Servicio BRC-20 (UniSat) para descuento Hold-to-Earn
4. Motor de pagos híbrido (direcciones HD únicas por boleto)
5. Motor de aleatoriedad on-chain (Fisher-Yates sobre SHA-256 de 3 bloques)
6. Escrutinio y reparto de premios
7. Backend / API (endpoints de negocio + cron jobs)
8. Frontend Next.js

**Este ciclo cubre los subsistemas 1 y 2**, que constituyen la base sin dependencias externas y desbloquean todos los demás. Los subsistemas 3–8 quedan explícitamente fuera de alcance.

### Objetivos de este ciclo

- Establecer un monorepo pnpm + workspaces con TypeScript estricto.
- Definir el esquema de base de datos PostgreSQL 16 con Drizzle ORM.
- Implementar un cliente RPC resiliente y tipado hacia el nodo `fractald` remoto vía Tailscale.
- Exponer un endpoint `/health` que valide conectividad de extremo a extremo contra el nodo real.

### No incluye este ciclo

- Derivación HD de direcciones (`packages/crypto`).
- Cron de verificación de pagos.
- Motor de aleatoriedad Fisher-Yates (`packages/randomness`).
- Cliente UniSat BRC-20 (`packages/brc20`).
- Escrutinio y reparto de premios.
- Frontend Next.js (`apps/web`).
- Endpoints de negocio (comprar ticket, estado de sorteo, etc.).

---

## 2. Stack Tecnológico

| Decisión | Elección | Justificación |
|---|---|---|
| Lenguaje | TypeScript estricto (`strict: true`) | Atrapa errores de tipos en seeds, hashes y payloads RPC en compilación |
| Monorepo | pnpm + workspaces | Un lockfile, dependencias entre paquetes declaradas y enforced |
| Base de datos | PostgreSQL 16 (Homebrew local) | JSONB indexable, índices para escrutinio masivo |
| ORM/migraciones | Drizzle ORM | Schema TS como fuente única de verdad, tipos inferidos end-to-end |
| API | Fastify + Zod | Rápido, esquemas nativos, logs estructurados con pino |
| Criptografía | Suite noble (`@scure/bip32`, `@noble/hashes`) | Sin dependencias nativas, auditable, referencia moderna para Bitcoin |
| Cliente RPC | A medida sobre fetch nativo (undici) | Control total de reintentos, timeouts y circuit breaker |
| Testing | Vitest + testcontainers-postgres | Nativo ESM/TS, DB efímera hermética por test |
| Secretos | dotenv + Zod env schema fail-fast | Muere en arranque si falta algo crítico |
| Logger | pino (vía `packages/config`) | JSON estructurado, compatible con Fastify |

---

## 3. Arquitectura del Monorepo

```
MYLoto/
├── apps/
│   ├── backend/              # ESTE CICLO: Fastify mínimo con /health
│   └── web/                  # futuro: Next.js frontend
├── packages/
│   ├── rpc-client/           # ESTE CICLO: FractalTransport + FractalRpcClient
│   ├── db/                   # ESTE CICLO: esquema Drizzle + migraciones + pool
│   ├── config/               # ESTE CICLO: env schema Zod + logger pino
│   ├── crypto/               # futuro: derivación HD (suite noble)
│   ├── brc20/                # futuro: cliente UniSat
│   ├── randomness/           # futuro: motor on-chain
│   └── types/                # ESTE CICLO: tipos de dominio + tipos RPC
├── docs/
│   └── superpowers/specs/    # specs de diseño
├── .env.example
├── pnpm-workspace.yaml
├── package.json              # root, scripts compartidos
├── tsconfig.base.json        # config TS estricta compartida
└── README.md
```

### Principios

- **Límites duros entre paquetes.** Cada paquete declara sus dependencias en su `package.json`. pnpm lo enforcement — ningún import cruzado sin declaración.
- **`packages/config` es la raíz de la dependencia.** Dependen de él tanto `rpc-client` como `db`. `config` no depende de nadie.
- **`packages/types` contiene tipos de dominio puros** (sin imports de Drizzle ni runtime) para que cualquier paquete los use sin acoplamiento a DB.
- **`apps/backend` y `apps/web` son consumidores** que orquestan paquetes.

### Alcance de carpetas en este ciclo

Se crean con contenido: `rpc-client`, `db`, `config`, `types`, y `apps/backend`.
Las carpetas `crypto`, `brc20`, `randomness`, `apps/web` se crean vacías con un `package.json` placeholder para que el workspace reconozca los nombres y el roadmap futuro quede esqueletizado.

---

## 4. Esquema de Base de Datos

PostgreSQL 16. Schema Drizzle en `packages/db/src/schema.ts` como fuente única de verdad; `drizzle-kit` genera migraciones SQL a `packages/db/migrations/`.

### 4.1 Tabla `sorteos`

```sql
CREATE TABLE sorteos (
  id                    BIGSERIAL PRIMARY KEY,
  bloque_cierre         INTEGER NOT NULL,
  estado                TEXT NOT NULL DEFAULT 'ABIERTO',
  combinacion_ganadora  JSONB,
  seed_maestra          TEXT,
  bloques_semilla       JSONB,
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en            TIMESTAMPTZ,
  calculado_en          TIMESTAMPTZ,
  CONSTRAINT chk_sorteo_estado CHECK (estado IN ('ABIERTO','CERRADO','CALCULADO'))
);
CREATE UNIQUE INDEX sorteos_bloque_cierre_unique ON sorteos(bloque_cierre);
```

- `bloque_cierre INTEGER` — bloque límite N del spec (cierre de ventas).
- `estado` — ciclo de vida del sorteo. Solo tres valores permitidos via CHECK.
- `combinacion_ganadora JSONB` — `null` hasta el escrutinio. JSONB (no TEXT) para indexabilidad futura.
- `seed_maestra TEXT` — hash SHA-256 de los 3 bloques, persistido para auditoría.
- `bloques_semilla JSONB` — `{ "n1": "<hash>", "n2": "<hash>", "n3": "<hash>" }`, los hashes usados.
- `UNIQUE(bloque_cierre)` — imposibilidad de dos sorteos con el mismo bloque límite.

### 4.2 Tabla `tickets`

```sql
CREATE TABLE tickets (
  id                   BIGSERIAL PRIMARY KEY,
  sorteo_id            BIGINT NOT NULL REFERENCES sorteos(id) ON DELETE CASCADE,
  payment_address      TEXT NOT NULL,
  expected_amount      NUMERIC(18,8) NOT NULL,
  status               TEXT NOT NULL DEFAULT 'PENDIENTE',
  n1 SMALLINT NOT NULL, n2 SMALLINT NOT NULL,
  n3 SMALLINT NOT NULL, n4 SMALLINT NOT NULL,
  n5 SMALLINT NOT NULL,
  powerball            SMALLINT NOT NULL,
  user_return_address  TEXT,
  recibido_en          TIMESTAMPTZ,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ticket_status CHECK (status IN ('PENDIENTE','ACTIVO')),
  CONSTRAINT chk_balotas_sorted CHECK (n1<n2 AND n2<n3 AND n3<n4 AND n4<n5),
  CONSTRAINT chk_balotas_range CHECK (
    n1 BETWEEN 1 AND 69 AND n2 BETWEEN 1 AND 69
    AND n3 BETWEEN 1 AND 69 AND n4 BETWEEN 1 AND 69
    AND n5 BETWEEN 1 AND 69
  ),
  CONSTRAINT chk_powerball_range CHECK (powerball BETWEEN 1 AND 26)
);
CREATE INDEX tickets_sorteo_status        ON tickets(sorteo_id, status);
CREATE INDEX tickets_payment_address      ON tickets(payment_address);
CREATE INDEX tickets_sorteo_combinacion   ON tickets(sorteo_id, n1, n2, n3, n4, n5, powerball);
```

### 4.3 Decisiones de tipos e índices

- **`BIGSERIAL`** en ambas PKs — un sorteo exitoso puede tener millones de tickets.
- **`SMALLINT`** para n1–n5 y powerball (rangos 1–69 y 1–26 caben holgados). Ahorra 6 bytes/fila vs INTEGER, relevante a escala.
- **`NUMERIC(18,8)`** para `expected_amount` — precisión monetaria cripto (FB tiene hasta 8 decimales).
- **`CHECK (n1<n2<n3<n4<n5)`** — garantiza a nivel DB el invariant "ordenadas de menor a mayor" del spec. Defensa en profundidad: si un bug futuro en el backend lo olvida, la DB lo rechaza.
- **`CHECK ... BETWEEN 1 AND 69 / 1 AND 26`** — validación de rango del spec a nivel DB.
- **`tickets_sorteo_combinacion`** — índice compuesto que cubre exactamente la query de escrutinio (JOIN por combinación exacta).
- **`tickets_payment_address`** — el cron de verificación de pagos buscará tickets por dirección.
- **`tickets_sorteo_status`** — consultas frecuentes "tickets activos de un sorteo".

### 4.4 Tipos inferidos (Drizzle)

```typescript
export type Sorteo       = typeof sorteos.$inferSelect;
export type NuevoSorteo  = typeof sorteos.$inferInsert;
export type Ticket       = typeof tickets.$inferSelect;
export type NuevoTicket  = typeof tickets.$inferInsert;
```

Sin interfaces duplicadas — los tipos se derivan del schema.

---

## 5. Cliente RPC

Núcleo de este ciclo. Dos capas con responsabilidades estrictamente separadas.

### 5.1 `FractalTransport` — capa de transporte resiliente

**Archivo:** `packages/rpc-client/src/transport.ts`

Responsabilidades exclusivas: red, autenticación, reintentos, timeout, circuit breaker, logging. Cero lógica de dominio RPC.

```typescript
export interface FractalTransportOptions {
  url: string;                 // http://100.x.x.x:8332
  username: string;
  password: string;
  timeoutMs?: number;          // default 15000
  maxRetries?: number;         // intentos ADICIONALES tras el fallo inicial, default 3 (máx 4 llamadas totales)
  retryBackoffMs?: number;     // base de backoff exponencial, default 500
  breakerThreshold?: number;   // fallos consecutivos para abrir circuito, default 5
  breakerResetMs?: number;     // tiempo hasta semi-open, default 30000
}

export class FractalTransport {
  constructor(opts: FractalTransportOptions);
  async call<T>(method: string, params?: unknown[]): Promise<T>;
}
```

#### Comportamiento detallado

**Autenticación:** HTTP Basic Auth header `Authorization: Basic base64(user:pass)`.

**Payload JSON-RPC 2.0:**
```json
{ "jsonrpc": "2.0", "id": "<uuid>", "method": "<method>", "params": [...] }
```
El `id` único por call permite correlacionar logs.

**Timeout:** por petición vía `AbortController` (undici). Al excederse, cuenta como fallo transitorio.

**Reintentos selectivos — solo errores transitorios:**
- Timeout (`AbortError`).
- Errores de red: `ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`.
- HTTP 5xx.
- Errores RPC Bitcoin con código `-28` ("verifying blocks" / "loading block index") — transitorio en Fractal durante IBD.

**No se reintenta en:**
- HTTP 401 (autenticación) → `RpcAuthError`.
- HTTP 4xx (excepto 429) → error de cliente.
- Errores RPC con código `-3` (`INVALID_PARAMETER`) o cualquier código negativo de error lógico → `RpcMethodError`.
- HTTP 429 (rate limit) → se reintenta pero con backoff más largo.

**Backoff exponencial con jitter:**
```
delay = retryBackoffMs * 2^attempt + random(0, 250ms)
```
El jitter evita thundering herd si el nodo se recupera y muchos clientes reintentan a la vez.

**Circuit breaker (3 estados):**
- `CLOSED` — peticiones fluyen. Cada fallo consecutivo incrementa un contador; al alcanzar `breakerThreshold` → transición a `OPEN`.
- `OPEN` — peticiones fallan inmediatamente con `CircuitOpenError` sin tocar la red. Tras `breakerResetMs` → transición a `HALF_OPEN`.
- `HALF_OPEN` — se permite **exactamente una** petición de prueba. Si pasa → `CLOSED` (contador reseteado). Si falla → `OPEN` de nuevo.

**Logging:** cada call loguea `{ method, id, attempt, durationMs, status }` vía el logger de `packages/config`. En errores se loguea el código RPC y el mensaje, **redactando** la contraseña (nunca aparece, ni en el header ni en el cuerpo). El redact se configura a nivel de logger (ver §6.2).

### 5.2 `FractalRpcClient` — capa de dominio tipada

**Archivo:** `packages/rpc-client/src/client.ts`

Capa fina sobre el transport. Expone métodos tipados. Cero lógica de red aquí.

```typescript
export class FractalRpcClient {
  constructor(private transport: FractalTransport);

  // --- Salud ---
  async getBlockchainInfo(): Promise<BlockchainInfo>;
  async getBlockCount(): Promise<number>;

  // --- Aleatoriedad (consume futuro motor Fisher-Yates) ---
  async getBlockHash(height: number): Promise<string>;
  async getBlock(hash: string): Promise<BlockHeader>;

  // --- Pagos (consume futuro motor de depósitos) ---
  // Nota: getReceivedByAddress consulta el total recibido por una dirección individual.
  // Trabaja sobre direcciones derivadas ya conocidas por el backend; NO usa scantxoutset
  // ni expone la XPUB al nodo. minconf default 1 (mínimo del spec).
  async getReceivedByAddress(address: string, minconf?: number): Promise<number>;
}
```

Cada método devuelve un tipo estricto (definido en `packages/types/src/rpc.ts`) que refleja exactamente los campos usados del payload RPC. Sin `any` ni `unknown` en firmas públicas.

**Tipos de respuesta** (`packages/types/src/rpc.ts`):
```typescript
export interface BlockchainInfo {
  chain: string;          // "main" | "test" | "regtest" | "fractal"
  blocks: number;         // altura actual
  headers: number;        // altura de headers
  initialblockdownload: boolean;
  verificationprogress: number;
}

export interface BlockHeader {
  hash: string;
  confirmations: number;
  height: number;
  time: number;
  nonce: number;
}
```

### 5.3 Errores tipados

**Archivo:** `packages/rpc-client/src/errors.ts`

```typescript
export class FractalRpcError extends Error {
  constructor(message: string, public code?: number, public method?: string) {}
}
export class RpcTimeoutError    extends FractalRpcError {}
export class CircuitOpenError   extends FractalRpcError {}
export class RpcAuthError       extends FractalRpcError {}  // 401, no se reintenta
export class RpcMethodError     extends FractalRpcError {}  // error lógico del nodo (-3, etc.)
export class RpcNetworkError    extends FractalRpcError {}  // ECONNRESET, etc.
```

Todas heredan de `FractalRpcError` para que el backend pueda hacer `catch (err) { if (err instanceof FractalRpcError) ... }` con un solo check.

### 5.4 Testing del cliente RPC

**Unitarios** (`packages/rpc-client/test/unit/`):
- Mock de `fetch` global (o `undici.fetch`) con respuestas JSON-RPC fixture.
- Fixtures capturadas de la documentación de Bitcoin Core / Fractal.
- Verifican: reintentos en errores transitorios, no-reintento en 401/lógicos, circuit breaker (paso CLOSED→OPEN→HALF_OPEN→CLOSED), redacción de contraseña en logs, parsing correcto de tipos de respuesta.

**Integración contra nodo real** (`packages/rpc-client/test/integration/`):
- Suite marcada con `describe.skipIf(!process.env.RUN_INTEGRATION)` — requiere `RUN_INTEGRATION=1` explícito.
- Se ejecuta con `RUN_INTEGRATION=1 pnpm test:integration` (requiere `FRACTAL_RPC_URL` real en `.env`).
- Valida: `getBlockchainInfo()` devuelve `chain` y `blocks > 0`; `getBlockCount()` coincide con `info.blocks`; `getBlockHash(getBlockCount())` devuelve un hex válido de 64 chars; `getBlock(hash)` devuelve `confirmations >= 1`.
- Estos tests **no** se ejecutan en el `pnpm test` normal — son lentos y tocan el nodo real; se corren manualmente o en CI con red Tailscale disponible.

---

## 6. `packages/config` (env + logging)

### 6.1 Schema de variables de entorno (Zod, fail-fast)

**Archivo:** `packages/config/src/env.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),

  // --- Nodo Fractal RPC (Tailscale) ---
  FRACTAL_RPC_URL: z.string().url().refine(
    u => /^http:\/\/100\./.test(u),
    { message: "FRACTAL_RPC_URL debe ser http://100.x.x.x:8332 (IP Tailscale)" }
  ),
  FRACTAL_RPC_USER: z.string().min(1),
  FRACTAL_RPC_PASSWORD: z.string().min(1),
  FRACTAL_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // --- Postgres ---
  DATABASE_URL: z.string().url(),

  // --- Backend ---
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env;
```

**Comportamiento fail-fast:** `loadEnv()` valida `process.env`. Si la validación falla, lanza un `ZodError` formateado con la lista precisa de variables faltantes/inválidas:
```
[config] Variables de entorno inválidas:
  FRACTAL_RPC_PASSWORD: Required
  FRACTAL_RPC_URL: must start with http://100.
```
El proceso muere antes de arrancar Fastify, sin estado indeterminado.

### 6.2 Logger (pino, con redacción)

**Archivo:** `packages/config/src/logger.ts`

```typescript
export interface Logger {
  trace(msg: string, data?: object): void;
  debug(msg: string, data?: object): void;
  info(msg: string, data?: object): void;
  warn(msg: string, data?: object): void;
  error(msg: string, data?: object): void;
  fatal(msg: string, data?: object): void;
  child(bindings: { service: string }): Logger;
}

export function createLogger(level: string, service: string): Logger;
```

- **Implementación:** pino.
- **Cada paquete crea un logger hijo** con su nombre: `logger.child({ service: 'rpc-client' })`.
- **Redacción automática** configurada en pino con:
  ```typescript
  redact: { paths: ['*.password', '*.FRACTAL_RPC_PASSWORD', 'Authorization', 'password', 'Authorization'], censor: '[REDACTED]' }
  ```
  Ninguna contraseña aparece en logs, ni siquiera por accidente.

### 6.3 `.env.example` (versionado)

```bash
# --- Nodo Fractal RPC (Tailscale) ---
FRACTAL_RPC_URL=http://100.64.0.1:8332
FRACTAL_RPC_USER=moonyetis_rpc
FRACTAL_RPC_PASSWORD=changeme
FRACTAL_RPC_TIMEOUT_MS=15000

# --- Postgres ---
DATABASE_URL=postgresql://myloto:myloto@localhost:5432/myloto

# --- Backend ---
PORT=3000
LOG_LEVEL=info
```

`.env` (real) entra en `.gitignore`. `.env.example` se versiona.

### 6.4 Política de secretos

La contraseña real del spec (`D4st8A2kN6sR4jH7mP9qW3xY5zB1cV0eT8uM2nL4`) **NO** se versiona en ningún archivo. Se introduce solo en el `.env` local durante la configuración. Aparece en `.env.example` únicamente como `changeme`.

---

## 7. `packages/db` (Drizzle + migraciones + pool)

### 7.1 Schema (fuente única de verdad en TS)

**Archivo:** `packages/db/src/schema.ts`

El schema Drizzle replica exactamente las tablas de §4. Los `CHECK` constraints se declaran vía la función `check()` de `drizzle-orm/pg-core`. Los tipos inferidos se exportan como en §4.4.

### 7.2 Pool de conexiones

**Archivo:** `packages/db/src/pool.ts`

```typescript
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export function createDb(databaseUrl: string): { db: NodePgDatabase; pool: Pool } {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}
```

- **`max: 10`** — backend ligero de 8 GB; el cron de pagos + API no requieren más.
- Se expone tanto `db` (Drizzle) como `pool` (pg puro) para queries complejas futuras de escrutinio con SQL crudo.

### 7.3 Migraciones con drizzle-kit

**Archivo:** `packages/db/drizzle.config.ts`

```typescript
export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
};
```

Comandos:
```bash
pnpm --filter @myloto/db drizzle:generate   # genera SQL desde cambios de schema
pnpm --filter @myloto/db drizzle:migrate    # aplica migraciones
```

Las migraciones generadas son **archivos SQL planos** en `packages/db/migrations/` — auditable, revertible.

### 7.4 Testing de DB con testcontainers

- Suite de integración en `packages/db/test/integration/`.
- Levanta un **Postgres 16 efímero en contenedor Docker** por ejecución de tests, aplica las migraciones, corre queries, y lo destruye al final.
- Verifica explícitamente:
  - Los `CHECK` constraints rechazan balotas desordenadas (`n1=5, n2=3` → error).
  - Los `CHECK` constraints rechazan balotas fuera de rango (`n1=70` → error; `powerball=27` → error).
  - El `UNIQUE(bloque_cierre)` impide dos sorteos con el mismo bloque.
  - Los índices existen tras migrar (consulta a `pg_indexes`).
- **Requisito:** Docker Desktop instalado (prerrequisito §9).

---

## 8. `apps/backend` (servidor Fastify mínimo)

### 8.1 Punto de entrada

**Archivo:** `apps/backend/src/server.ts`

```typescript
import Fastify from 'fastify';
import { loadEnv, createLogger } from '@myloto/config';
import { createDb } from '@myloto/db';
import { FractalRpcClient, FractalTransport } from '@myloto/rpc-client';

async function main() {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, 'backend');
  const { db, pool } = createDb(env.DATABASE_URL);

  const transport = new FractalTransport({
    url: env.FRACTAL_RPC_URL,
    username: env.FRACTAL_RPC_USER,
    password: env.FRACTAL_RPC_PASSWORD,
    timeoutMs: env.FRACTAL_RPC_TIMEOUT_MS,
  });
  const rpc = new FractalRpcClient(transport);

  const app = Fastify({ logger });

  app.get('/health', async (_req, reply) => {
    try {
      const info = await rpc.getBlockchainInfo();
      return { status: 'ok', node: { chain: info.chain, blocks: info.blocks, headers: info.headers } };
    } catch (err) {
      reply.code(503);
      return { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
    }
  });

  app.get('/health/db', async (_req, reply) => {
    try {
      const result = await db.execute('SELECT 1');
      return { status: 'ok', db: 'reachable' };
    } catch (err) {
      reply.code(503);
      return { status: 'error', error: err instanceof Error ? err.message : 'unknown' };
    }
  });

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT }, 'MYLoto backend listening');
}

main();
```

### 8.2 Endpoints de este ciclo

Solo dos:
- `GET /health` — valida RPC contra el nodo Fractal real.
- `GET /health/db` — valida conectividad a Postgres con `SELECT 1`.

El resto de endpoints (comprar ticket, estado de sorteo, listado de tickets, etc.) viven en ciclos posteriores.

---

## 9. Prerrequisitos de Instalación

1. **Homebrew** — gestor de paquetes macOS.
2. **`postgresql@16`** vía Homebrew. Crear DB: `createdb myloto`.
3. **Docker Desktop** — necesario para los tests de integración con testcontainers (DB y futuras pruebas RPC mockeadas vía contenedor si se desea).
4. **Node 22** — ya disponible (v22.16). ✓
5. **pnpm** — vía `corepack enable pnpm` (recomendado) o `brew install pnpm`.

### Pasos de configuración

1. `git init` en `/Users/osmanmarin/Desktop/MYLoto`.
2. `pnpm install` (tras crear el monorepo).
3. Copiar `.env.example` → `.env`, rellenar credenciales reales:
   - `FRACTAL_RPC_URL` con la IP Tailscale real del nodo.
   - `FRACTAL_RPC_PASSWORD` con la contraseña del spec.
   - `DATABASE_URL` con las credenciales locales de Postgres.
4. `pnpm db:generate && pnpm db:migrate`.
5. `pnpm dev`.

---

## 10. Scripts del Workspace

**Archivo:** `package.json` (raíz)

```json
{
  "scripts": {
    "dev": "pnpm --filter @myloto/backend dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:integration": "pnpm -r --workspace-concurrency=1 test:integration",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "db:generate": "pnpm --filter @myloto/db drizzle:generate",
    "db:migrate": "pnpm --filter @myloto/db drizzle:migrate"
  }
}
```

Cada paquete define sus propios `dev`, `build`, `test`, `test:integration`, `typecheck`, `lint` en su `package.json`.

---

## 11. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | Monorepo levanta con `pnpm install` | Sin errores de instalación |
| 2 | `pnpm typecheck` pasa en todos los paquetes | Exit code 0 |
| 3 | `pnpm test` (unitarios) pasa | Verde |
| 4 | `pnpm db:migrate` crea las 2 tablas con constraints/índices | `\d sorteos` y `\d tickets` en psql muestran estructura completa |
| 5 | `pnpm test:integration` (DB con testcontainers + RPC contra nodo real) pasa | Verde |
| 6 | `pnpm dev` arranca backend en `:3000` | Log "MYLoto backend listening" |
| 7 | `GET /health` responde OK con altura real del nodo Fractal | JSON con `node.blocks` real > 0 |
| 8 | `GET /health/db` responde OK | JSON `{ status: "ok", db: "reachable" }` |

---

## 12. Configuración TypeScript

**Archivo:** `tsconfig.base.json` (raíz)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Cada paquete tiene su `tsconfig.json` que extiende el base y añade sus paths.

---

## 13. Decisiones de Diseño Clave (resumen)

1. **Transport y Client separados** — la resiliencia (reintentos, circuit breaker) es testable aislada del tipado de métodos RPC.
2. **Circuit breaker** — protege al backend de colapsar si Tailscale o el nodo caen, fallando rápido en lugar de acumular timeouts.
3. **Reintentos selectivos** — solo en errores transitorios; no se reintenta autenticación ni errores lógicos.
4. **Constraints a nivel DB** — el invariant "balotas ordenadas" y los rangos se validan en la base de datos como defensa en profundidad, no solo en el backend.
5. **JSONB para combinación ganadora** — indexable y consultable para escrutinio futuro.
6. **Zod env schema fail-fast** — el proceso muere con un mensaje claro si falta un secreto, en lugar de fallar silenciosamente.
7. **Redacción de secretos en logger** — la contraseña nunca aparece en logs, ni por accidente.
8. **Tipos inferidos de Drizzle** — sin interfaces duplicadas entre schema y código.
9. **Suite noble para cripto** — sin dependencias nativas, auditable, referencia moderna (se usa en ciclo futuro para HD).
10. **testcontainers** — DB de prueba hermética, no compartida con dev.

---

## 14. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| IP Tailscale del nodo cambia | Media | Alto | Variable de entorno; documentar rotación en README |
| Tailscale no conecta desde dev | Baja | Alto | Endpoint `/health` da feedback inmediato; logs con código de error tipado |
| Docker Desktop no instalado | Alta (no está hoy) | Medio | Documentado como prerrequisito; tests unitarios no lo requieren |
| Respuestas RPC de Fractal difieren de Bitcoin Core | Media | Medio | Tipos flexibles que solo extraen campos usados; tests de integración contra nodo real validan |
| Sobrecarga del nodo por reintentos | Baja | Medio | Circuit breaker + backoff con jitter limitan presión |

---

## 15. Próximos Ciclos (Roadmap)

1. ✓ **Ciclo 1:** Fundación + Cliente RPC (este spec)
2. **Ciclo 2:** `packages/crypto` — derivación HD de direcciones desde XPUB (`m/0/ticketId`), generación de QR.
3. **Ciclo 3:** `packages/brc20` — cliente UniSat para validación de balance `Moonyetis`.
4. **Ciclo 4:** Motor de pagos híbrido — cron de verificación vía `getreceivedbyaddress`, estado `ACTIVO`.
5. **Ciclo 5:** `packages/randomness` — motor on-chain Fisher-Yates, listener de bloques.
6. **Ciclo 6:** Escrutinio y reparto de premios.
7. **Ciclo 7:** Backend completo — endpoints de negocio, orquestación.
8. **Ciclo 8:** Frontend Next.js — UI de selección, pago + QR, animación de sorteo.
