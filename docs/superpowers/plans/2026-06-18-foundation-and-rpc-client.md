# Fundación + Cliente RPC de Fractal Bitcoin — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establecer el monorepo pnpm con TypeScript estricto, el esquema PostgreSQL/Drizzle, un cliente RPC resiliente y tipado hacia el nodo `fractald` remoto vía Tailscale, y un backend Fastify mínimo con endpoint `/health` que valide conectividad de extremo a extremo contra el nodo real.

**Architecture:** Monorepo pnpm + workspaces. Cliente RPC en dos capas — `FractalTransport` (resiliencia: reintentos, timeout, circuit breaker) y `FractalRpcClient` (métodos tipados). Schema Drizzle como fuente única de verdad para PostgreSQL. TDD estricto: cada componente se testa antes de implementarse.

**Tech Stack:** TypeScript 5 estricto, pnpm workspaces, Node 22, PostgreSQL 16, Drizzle ORM, Fastify + Zod, suite noble (`@scure/bip32`, `@noble/hashes`), Vitest + testcontainers-postgres, pino.

**Spec de referencia:** `docs/superpowers/specs/2026-06-18-foundation-and-rpc-client-design.md`

---

## Prerrequisitos del entorno

Antes de empezar la Tarea 1, verifica lo siguiente (si falta, instalarlo antes):

```bash
# 1. Node 22 (ya confirmado: v22.16.0)
node --version    # debe dar v22.x

# 2. pnpm (vía corepack, recomendado)
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version    # debe dar 9.x o superior

# 3. Homebrew + PostgreSQL 16
brew install postgresql@16
brew services start postgresql@16

# 4. Crear la DB de desarrollo + usuario
createuser myloto
createdb -O myloto myloto
psql -d myloto -c "ALTER USER myloto WITH PASSWORD 'myloto';"

# 5. Docker Desktop (para testcontainers)
#    Descargar de https://docker.com/products/docker-desktop e instalar
docker --version  # debe dar Docker version 24.x o superior

# 6. Git ya inicializado (commit del spec ya existe)
git log --oneline -1   # debe mostrar 'docs: spec de diseño Ciclo 1'
```

---

## File Structure

```
MYLoto/
├── apps/
│   └── backend/
│       ├── src/
│       │   ├── server.ts            # punto de entrada Fastify
│       │   └── routes/
│       │       └── health.ts        # endpoints /health y /health/db
│       ├── test/
│       │   └── health.test.ts       # tests del endpoint /health
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── packages/
│   ├── config/
│   │   ├── src/
│   │   │   ├── env.ts               # schema Zod + loadEnv()
│   │   │   ├── logger.ts            # createLogger() con pino redact
│   │   │   └── index.ts             # exports públicos
│   │   ├── test/
│   │   │   └── env.test.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema.ts            # tablas sorteos + tickets (fuente de verdad)
│   │   │   ├── pool.ts              # createDb()
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   └── integration/
│   │   │       └── schema.test.ts   # testcontainers
│   │   ├── migrations/              # generadas por drizzle-kit
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── rpc-client/
│   │   ├── src/
│   │   │   ├── transport.ts         # FractalTransport (resiliencia)
│   │   │   ├── client.ts            # FractalRpcClient (métodos tipados)
│   │   │   ├── errors.ts            # jerarquía FractalRpcError
│   │   │   ├── circuit-breaker.ts   # lógica del circuit breaker
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   │   ├── transport.test.ts
│   │   │   │   ├── circuit-breaker.test.ts
│   │   │   │   ├── client.test.ts
│   │   │   │   └── fixtures.ts      # respuestas RPC capturadas
│   │   │   └── integration/
│   │   │       └── node.test.ts     # contra nodo real (RUN_INTEGRATION=1)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── types/
│       ├── src/
│       │   ├── rpc.ts               # BlockchainInfo, BlockHeader, etc.
│       │   ├── sorteo.ts            # tipos de dominio Sorteo/Ticket
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── docs/superpowers/
│   ├── specs/2026-06-18-foundation-and-rpc-client-design.md  # ya existe
│   └── plans/2026-06-18-foundation-and-rpc-client.md         # este archivo
├── .env.example
├── .gitignore
├── package.json                     # raíz con scripts compartidos
├── pnpm-workspace.yaml
└── tsconfig.base.json               # config TS estricta compartida
```

**Notas de decomposición:**
- `circuit-breaker.ts` se separa de `transport.ts` porque su lógica de estados (CLOSED/OPEN/HALF_OPEN) es compleja y testable de forma aislada.
- `errors.ts` vive en su propio archivo para que cualquier consumidor pueda importar la jerarquía completa sin arrastrar el transport.
- `fixtures.ts` agrupa respuestas RPC reales para que los tests unitarios sean deterministas.
- `packages/types` no depende de ningún runtime — solo tipos.

---

## Task 1: Esqueleto del monorepo (raíz + workspace + tsconfig base)

**Objetivo:** Tener `pnpm install` funcionando con la estructura mínima del workspace.

**Files:**
- Create: `/Users/osmanmarin/Desktop/MYLoto/package.json`
- Create: `/Users/osmanmarin/Desktop/MYLoto/pnpm-workspace.yaml`
- Create: `/Users/osmanmarin/Desktop/MYLoto/tsconfig.base.json`
- Create: `/Users/osmanmarin/Desktop/MYLoto/.gitignore`
- Create: `/Users/osmanmarin/Desktop/MYLoto/.env.example`
- Create: `/Users/osmanmarin/Desktop/MYLoto/README.md`

- [ ] **Step 1: Crear `.gitignore`**

```gitignore
# Dependencias
node_modules/
.pnpm-store/

# Builds
dist/
*.tsbuildinfo

# Entorno
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# OS
.DS_Store

# IDE
.vscode/
.idea/

# Drizzle
drizzle/meta/

# Test artifacts
coverage/
```

- [ ] **Step 2: Crear `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Crear `tsconfig.base.json`**

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

- [ ] **Step 4: Crear `package.json` raíz**

```json
{
  "name": "myloto",
  "version": "0.1.0",
  "private": true,
  "description": "dApp de lotería Powerball sobre Fractal Bitcoin",
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=22.0.0"
  },
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

- [ ] **Step 5: Crear `.env.example`**

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

- [ ] **Step 6: Crear `README.md` mínimo**

```markdown
# MYLoto

dApp de lotería estilo Powerball sobre la red Fractal Bitcoin.

## Setup

Ver `docs/superpowers/specs/2026-06-18-foundation-and-rpc-client-design.md` §9.

## Scripts

- `pnpm install` — instalar dependencias
- `pnpm db:migrate` — aplicar migraciones de DB
- `pnpm dev` — arrancar backend en :3000
- `pnpm test` — tests unitarios
- `RUN_INTEGRATION=1 pnpm test:integration` — tests contra nodo real + DB real
```

- [ ] **Step 7: Verificar que `pnpm install` corre sin errores (aún sin paquetes)**

Run: `pnpm install`
Expected: "Progress: resolved 0, reused 0" sin errores. Como no hay `package.json` en los workspaces todavía, pnpm puede advertir pero no fallar.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example README.md
git commit -m "chore: esqueleto del monorepo pnpm + tsconfig base"
```

---

## Task 2: Paquete `packages/types` (tipos de dominio y RPC)

**Objetivo:** Definir todos los tipos compartidos que consumirán `rpc-client`, `db` y `backend`. Sin runtime, solo tipos — para que cualquier paquete pueda depender de él sin acoplamiento.

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/rpc.ts`
- Create: `packages/types/src/sorteo.ts`

- [ ] **Step 1: Crear `packages/types/package.json`**

```json
{
  "name": "@myloto/types",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Crear `packages/types/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear `packages/types/src/rpc.ts`**

```typescript
/**
 * Tipos de respuesta de los métodos RPC de Fractal Bitcoin que usamos.
 * Solo los campos que extraemos — el resto del payload se ignora.
 */

export interface BlockchainInfo {
  /** Nombre de la red: "main", "test", "regtest", o el nombre de Fractal */
  chain: string;
  /** Altura del bloque más procesado */
  blocks: number;
  /** Número de headers válidos conocidos */
  headers: number;
  /** True si el nodo está en Initial Block Download */
  initialblockdownload: boolean;
  /** Progreso de verificación de encadenamiento (0–1) */
  verificationprogress: number;
}

export interface BlockHeader {
  hash: string;
  confirmations: number;
  height: number;
  /** Tiempo del bloque en segundos UNIX */
  time: number;
  nonce: number;
}

/**
 * Estructura de una respuesta JSON-RPC 2.0 exitosa.
 */
export interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

/**
 * Estructura de una respuesta JSON-RPC 2.0 de error.
 * El código de error sigue la convención de Bitcoin Core.
 */
export interface JsonRpcError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}
```

- [ ] **Step 4: Crear `packages/types/src/sorteo.ts`**

```typescript
/**
 * Tipos de dominio del juego de lotería.
 * Estos tipos reflejan las reglas de Powerball y NO deben duplicarse
 * — `packages/db` los re-exporta desde Drizzle, y los endpoints los usan.
 */

export const SORTEO_ESTADO = {
  ABIERTO: "ABIERTO",
  CERRADO: "CERRADO",
  CALCULADO: "CALCULADO",
} as const;
export type SorteoEstado = (typeof SORTEO_ESTADO)[keyof typeof SORTEO_ESTADO];

export const TICKET_STATUS = {
  PENDIENTE: "PENDIENTE",
  ACTIVO: "ACTIVO",
} as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

/** Rangos del spec de Powerball */
export const BALOTA_MIN = 1;
export const BALOTA_MAX = 69;
export const POWERBALL_MIN = 1;
export const POWERBALL_MAX = 26;
export const CANTIDAD_BALOTAS = 5;

/** Combinación ganadora persistida en sorteos.combinacion_ganadora (JSONB) */
export interface CombinacionGanadora {
  balotas: [number, number, number, number, number]; // ordenadas asc
  powerball: number;
}

/** Hashes de los 3 bloques usados como semilla, persistidos en sorteos.bloques_semilla (JSONB) */
export interface BloquesSemilla {
  n1: string; // hash del bloque N+1
  n2: string; // hash del bloque N+2
  n3: string; // hash del bloque N+3
}
```

- [ ] **Step 5: Crear `packages/types/src/index.ts`**

```typescript
export * from "./rpc.js";
export * from "./sorteo.js";
```

- [ ] **Step 6: Instalar dependencias**

Run: `pnpm install`
Expected: crea `node_modules` en raíz y `packages/types/node_modules`. Sin errores.

- [ ] **Step 7: Verificar typecheck**

Run: `pnpm --filter @myloto/types typecheck`
Expected: sin salida, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add packages/types pnpm-lock.yaml
git commit -m "feat(types): paquete @myloto/types con tipos de dominio y RPC"
```

---

## Task 3: Paquete `packages/config` — env schema con Zod (TDD)

**Objetivo:** Implementar `loadEnv()` con validación Zod fail-fast.

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/vitest.config.ts`
- Create: `packages/config/test/env.test.ts`
- Create: `packages/config/src/env.ts`
- Create: `packages/config/src/index.ts`

- [ ] **Step 1: Crear `packages/config/package.json`**

```json
{
  "name": "@myloto/config",
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
    "@myloto/types": "workspace:*",
    "dotenv": "^16.4.5",
    "pino": "^9.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `packages/config/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Crear `packages/config/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Escribir tests que FALLARÁN (`packages/config/test/env.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  const valid = {
    NODE_ENV: "development",
    FRACTAL_RPC_URL: "http://100.64.0.1:8332",
    FRACTAL_RPC_USER: "moonyetis_rpc",
    FRACTAL_RPC_PASSWORD: "secret",
    FRACTAL_RPC_TIMEOUT_MS: "15000",
    DATABASE_URL: "postgresql://u:p@localhost:5432/myloto",
    PORT: "3000",
    LOG_LEVEL: "info",
  } as const;

  it("acepta un env completo y válido", () => {
    const env = loadEnv(valid);
    expect(env.FRACTAL_RPC_URL).toBe("http://100.64.0.1:8332");
    expect(env.FRACTAL_RPC_TIMEOUT_MS).toBe(15000); // coerce number
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
  });

  it("aplica defaults cuando faltan opcionales", () => {
    const env = loadEnv({
      ...valid,
      NODE_ENV: undefined,
      FRACTAL_RPC_TIMEOUT_MS: undefined,
      PORT: undefined,
      LOG_LEVEL: undefined,
    });
    expect(env.NODE_ENV).toBe("development");
    expect(env.FRACTAL_RPC_TIMEOUT_MS).toBe(15000);
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("lanza si falta FRACTAL_RPC_PASSWORD", () => {
    expect(() => loadEnv({ ...valid, FRACTAL_RPC_PASSWORD: undefined })).toThrow();
  });

  it("lanza si FRACTAL_RPC_URL no es IP Tailscale (no empieza con http://100.)", () => {
    expect(() => loadEnv({ ...valid, FRACTAL_RPC_URL: "http://192.168.1.1:8332" })).toThrow();
  });

  it("lanza si DATABASE_URL no es URL válida", () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("lanza si LOG_LEVEL no es valor permitido", () => {
    expect(() => loadEnv({ ...valid, LOG_LEVEL: "verbose" })).toThrow();
  });

  it("lanza si NODE_ENV no es valor permitido", () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: "staging" })).toThrow();
  });
});
```

- [ ] **Step 5: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/config install && pnpm --filter @myloto/config test`
Expected: FAIL con "Cannot find module '../src/env.js'" o error de resolución.

- [ ] **Step 6: Implementar `packages/config/src/env.ts`**

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Nodo Fractal RPC (Tailscale) ---
  FRACTAL_RPC_URL: z
    .string()
    .url()
    .refine((u) => /^http:\/\/100\./.test(u), {
      message: "FRACTAL_RPC_URL debe ser http://100.x.x.x:8332 (IP Tailscale)",
    }),
  FRACTAL_RPC_USER: z.string().min(1),
  FRACTAL_RPC_PASSWORD: z.string().min(1),
  FRACTAL_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // --- Postgres ---
  DATABASE_URL: z.string().url(),

  // --- Backend ---
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida y parsea el entorno. Lanza ZodError con la lista precisa de
 * variables faltantes/inválidas si la validación falla (fail-fast).
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}
```

- [ ] **Step 7: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/config test`
Expected: 7 tests PASS.

- [ ] **Step 8: Crear `packages/config/src/index.ts` (placeholder — logger se añade en Task 4)**

```typescript
export { loadEnv } from "./env.js";
export type { Env } from "./env.js";
```

- [ ] **Step 9: Verificar typecheck**

Run: `pnpm --filter @myloto/config typecheck`
Expected: exit code 0.

- [ ] **Step 10: Commit**

```bash
git add packages/config pnpm-lock.yaml
git commit -m "feat(config): env schema con Zod fail-fast + tests"
```

---

## Task 4: Logger pino con redacción de secretos

**Objetivo:** Añadir `createLogger()` a `packages/config` con redacción automática de secretos.

**Files:**
- Modify: `packages/config/src/logger.ts` (create)
- Modify: `packages/config/src/index.ts` (exportar logger)
- Create: `packages/config/test/logger.test.ts`

- [ ] **Step 1: Escribir test que FALLARÁ (`packages/config/test/logger.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import { createLogger } from "../src/logger.js";

describe("createLogger", () => {
  it("crea un logger con método info", () => {
    const log = createLogger("info", "test");
    expect(typeof log.info).toBe("function");
    expect(typeof log.child).toBe("function");
  });

  it("no lanza al loguear un objeto con password", () => {
    const log = createLogger("info", "test");
    expect(() => log.info("msg", { password: "secret", FRACTAL_RPC_PASSWORD: "secret" })).not.toThrow();
  });

  it("redacta password del output (síncrono vía write callback)", () => {
    const captured: string[] = [];
    const log = createLogger("info", "test", {
      destination: { write: (chunk: string) => captured.push(chunk) },
    });
    log.info("auth attempt", { password: "supersecret", user: "alice" });
    const output = captured.join("");
    expect(output).not.toContain("supersecret");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("alice");
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `pnpm --filter @myloto/config test`
Expected: FAIL con "Cannot find module '../src/logger.js'".

- [ ] **Step 3: Implementar `packages/config/src/logger.ts`**

```typescript
import pino, { type Logger as PinoLogger, type DestinationStream } from "pino";

export interface Logger {
  trace(msg: string, data?: object): void;
  debug(msg: string, data?: object): void;
  info(msg: string, data?: object): void;
  warn(msg: string, data?: object): void;
  error(msg: string, data?: object): void;
  fatal(msg: string, data?: object): void;
  child(bindings: { service: string }): Logger;
}

export interface LoggerOptions {
  /** Permite inyectar un destino custom (útil para tests). Si no se da, usa stdout. */
  destination?: DestinationStream;
}

const REDACT_PATHS = [
  "password",
  "*.password",
  "FRACTAL_RPC_PASSWORD",
  "*.FRACTAL_RPC_PASSWORD",
  "Authorization",
  "*.Authorization",
];

export function createLogger(level: string, service: string, opts: LoggerOptions = {}): Logger {
  const pinoLogger = pino(
    {
      level,
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    },
    opts.destination ?? undefined,
  );
  return wrapPino(pinoLogger.child({ service }));
}

function wrapPino(p: PinoLogger): Logger {
  return {
    trace: (msg, data) => p.trace(data ?? {}, msg),
    debug: (msg, data) => p.debug(data ?? {}, msg),
    info: (msg, data) => p.info(data ?? {}, msg),
    warn: (msg, data) => p.warn(data ?? {}, msg),
    error: (msg, data) => p.error(data ?? {}, msg),
    fatal: (msg, data) => p.fatal(data ?? {}, msg),
    child: (bindings) => wrapPino(p.child(bindings)),
  };
}
```

- [ ] **Step 4: Actualizar `packages/config/src/index.ts` para exportar logger**

```typescript
export { loadEnv } from "./env.js";
export type { Env } from "./env.js";
export { createLogger } from "./logger.js";
export type { Logger, LoggerOptions } from "./logger.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/config test`
Expected: 3 tests de logger PASS + 7 tests de env PASS = 10 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/config
git commit -m "feat(config): logger pino con redacción automática de secretos"
```

---

## Task 5: Paquete `packages/rpc-client` — errores tipados

**Objetivo:** Jerarquía de errores del cliente RPC.

**Files:**
- Create: `packages/rpc-client/package.json`
- Create: `packages/rpc-client/tsconfig.json`
- Create: `packages/rpc-client/vitest.config.ts`
- Create: `packages/rpc-client/src/errors.ts`
- Create: `packages/rpc-client/src/index.ts` (placeholder)
- Create: `packages/rpc-client/test/unit/errors.test.ts`

- [ ] **Step 1: Crear `packages/rpc-client/package.json`**

```json
{
  "name": "@myloto/rpc-client",
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
    "test:watch": "vitest",
    "test:integration": "RUN_INTEGRATION=1 vitest run --config vitest.integration.config.ts"
  },
  "dependencies": {
    "@myloto/config": "workspace:*",
    "@myloto/types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `packages/rpc-client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Crear `packages/rpc-client/vitest.config.ts` (unit tests)**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Crear `packages/rpc-client/vitest.integration.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Escribir test que FALLARÁ (`packages/rpc-client/test/unit/errors.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import {
  FractalRpcError,
  RpcTimeoutError,
  CircuitOpenError,
  RpcAuthError,
  RpcMethodError,
  RpcNetworkError,
} from "../../src/errors.js";

describe("errores RPC", () => {
  it("FractalRpcError guarda message, code y method", () => {
    const err = new FractalRpcError("boom", -32600, "getblock");
    expect(err.message).toBe("boom");
    expect(err.code).toBe(-32600);
    expect(err.method).toBe("getblock");
    expect(err.name).toBe("FractalRpcError");
  });

  it("todas las subclases extienden FractalRpcError", () => {
    expect(new RpcTimeoutError("t")).toBeInstanceOf(FractalRpcError);
    expect(new CircuitOpenError("c")).toBeInstanceOf(FractalRpcError);
    expect(new RpcAuthError("a")).toBeInstanceOf(FractalRpcError);
    expect(new RpcMethodError("m", -3)).toBeInstanceOf(FractalRpcError);
    expect(new RpcNetworkError("n")).toBeInstanceOf(FractalRpcError);
  });

  it("RpcMethodError acepta code RPC opcional", () => {
    const err = new RpcMethodError("invalid param", -3);
    expect(err.code).toBe(-3);
  });
});
```

- [ ] **Step 6: Correr test para verificar que falla**

Run: `pnpm --filter @myloto/rpc-client install && pnpm --filter @myloto/rpc-client test`
Expected: FAIL con "Cannot find module '../../src/errors.js'".

- [ ] **Step 7: Implementar `packages/rpc-client/src/errors.ts`**

```typescript
/**
 * Jerarquía de errores del cliente RPC de Fractal Bitcoin.
 * Todas las subclases extienden FractalRpcError para que el backend
 * pueda atraparlas con un solo instanceof check.
 */
export class FractalRpcError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly method?: string,
  ) {
    super(message);
    this.name = "FractalRpcError";
  }
}

/** Timeout de la petición HTTP (AbortController). */
export class RpcTimeoutError extends FractalRpcError {
  constructor(method?: string) {
    super(`RPC timeout llamando a ${method ?? "método"}`, undefined, method);
    this.name = "RpcTimeoutError";
  }
}

/** Circuit breaker abierto — la petición ni siquiera se intentó. */
export class CircuitOpenError extends FractalRpcError {
  constructor(method?: string) {
    super(`Circuit breaker abierto para ${method ?? "método"}`, undefined, method);
    this.name = "CircuitOpenError";
  }
}

/** HTTP 401 — credenciales RPC inválidas. No se reintenta. */
export class RpcAuthError extends FractalRpcError {
  constructor(method?: string) {
    super(`Autenticación RPC fallida (401) en ${method ?? "método"}`, 401, method);
    this.name = "RpcAuthError";
  }
}

/** Error lógico devuelto por el nodo (código RPC negativo, ej. -3 INVALID_PARAMETER). */
export class RpcMethodError extends FractalRpcError {
  constructor(message: string, code?: number, method?: string) {
    super(message, code, method);
    this.name = "RpcMethodError";
  }
}

/** Error de red (ECONNRESET, ECONNREFUSED, ETIMEDOUT, etc.). */
export class RpcNetworkError extends FractalRpcError {
  constructor(message: string, method?: string) {
    super(message, undefined, method);
    this.name = "RpcNetworkError";
  }
}
```

- [ ] **Step 8: Crear `packages/rpc-client/src/index.ts` (placeholder)**

```typescript
export * from "./errors.js";
// transport y client se añaden en siguientes tareas
```

- [ ] **Step 9: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/rpc-client test`
Expected: 3 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/rpc-client pnpm-lock.yaml
git commit -m "feat(rpc-client): jerarquía de errores tipados"
```

---

## Task 6: Circuit breaker (TDD)

**Objetivo:** Lógica pura del circuit breaker, testable sin red.

**Files:**
- Create: `packages/rpc-client/src/circuit-breaker.ts`
- Create: `packages/rpc-client/test/unit/circuit-breaker.test.ts`
- Modify: `packages/rpc-client/src/index.ts` (exportar)

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, type CircuitState } from "../../src/circuit-breaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("empieza en CLOSED", () => {
    const cb = new CircuitBreaker({ threshold: 5, resetMs: 30000 });
    expect(cb.state).toBe<CircuitState>("CLOSED");
  });

  it("pasa a OPEN tras threshold fallos consecutivos", () => {
    const cb = new CircuitBreaker({ threshold: 3, resetMs: 30000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("CLOSED"); // 2 < 3
    cb.recordFailure();
    expect(cb.state).toBe("OPEN"); // 3 == 3
  });

  it("allow() retorna true en CLOSED, false en OPEN", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    expect(cb.allow()).toBe(true);
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
    expect(cb.allow()).toBe(false);
  });

  it("pasa a HALF_OPEN tras resetMs", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
    vi.advanceTimersByTime(30000);
    expect(cb.allow()).toBe(true); // permite una petición de prueba
    expect(cb.state).toBe("HALF_OPEN");
  });

  it("HALF_OPEN → CLOSED si la petición de prueba tiene éxito", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    cb.recordFailure();
    vi.advanceTimersByTime(30000);
    cb.allow(); // ahora HALF_OPEN
    cb.recordSuccess();
    expect(cb.state).toBe("CLOSED");
  });

  it("HALF_OPEN → OPEN si la petición de prueba falla", () => {
    const cb = new CircuitBreaker({ threshold: 1, resetMs: 30000 });
    cb.recordFailure();
    vi.advanceTimersByTime(30000);
    cb.allow(); // ahora HALF_OPEN
    cb.recordFailure();
    expect(cb.state).toBe("OPEN");
  });

  it("recordSuccess resetea el contador en CLOSED", () => {
    const cb = new CircuitBreaker({ threshold: 3, resetMs: 30000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.state).toBe("CLOSED"); // no llegó a 3 consecutivos
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/rpc-client test`
Expected: FAIL con "Cannot find module '../../src/circuit-breaker.js'".

- [ ] **Step 3: Implementar `packages/rpc-client/src/circuit-breaker.ts`**

```typescript
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Fallos consecutivos para abrir el circuito */
  threshold: number;
  /** Milisegundos en OPEN antes de pasar a HALF_OPEN */
  resetMs: number;
}

/**
 * Implementa el patrón Circuit Breaker con 3 estados.
 *
 * - CLOSED: peticiones permitidas. Cada fallo incrementa el contador.
 *   Al alcanzar threshold → OPEN.
 * - OPEN: peticiones rechazadas inmediatamente. Tras resetMs → HALF_OPEN.
 * - HALF_OPEN: se permite UNA petición de prueba. Éxito → CLOSED. Fallo → OPEN.
 */
export class CircuitBreaker {
  private _state: CircuitState = "CLOSED";
  private failureCount = 0;
  private openedAt = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  get state(): CircuitState {
    return this._state;
  }

  /**
   * ¿Se permite una petición? En HALF_OPEN consume el "token" de prueba.
   * Debe llamarse antes de cada call al RPC.
   */
  allow(now: number = Date.now()): boolean {
    if (this._state === "OPEN") {
      if (now - this.openedAt >= this.opts.resetMs) {
        this._state = "HALF_OPEN";
        return true;
      }
      return false;
    }
    // CLOSED y HALF_OPEN permiten
    return true;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this._state = "CLOSED";
  }

  recordFailure(now: number = Date.now()): void {
    this.failureCount++;
    if (this._state === "HALF_OPEN") {
      this.trip(now);
      return;
    }
    if (this.failureCount >= this.opts.threshold) {
      this.trip(now);
    }
  }

  private trip(now: number): void {
    this._state = "OPEN";
    this.openedAt = now;
    this.failureCount = 0;
  }
}
```

- [ ] **Step 4: Actualizar `packages/rpc-client/src/index.ts`**

```typescript
export * from "./errors.js";
export { CircuitBreaker } from "./circuit-breaker.js";
export type { CircuitState, CircuitBreakerOptions } from "./circuit-breaker.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/rpc-client test`
Expected: 7 tests de circuit breaker + 3 de errors = 10 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/rpc-client
git commit -m "feat(rpc-client): circuit breaker CLOSED/OPEN/HALF_OPEN"
```

---

## Task 7: FractalTransport — fixtures y helper de red (TDD)

**Objetivo:** Crear los fixtures de respuestas RPC y un helper para mockear `fetch` en tests. Esto prepara el terreno para testear el transport.

**Files:**
- Create: `packages/rpc-client/test/unit/fixtures.ts`
- Create: `packages/rpc-client/test/unit/fetch-mock.ts`

- [ ] **Step 1: Crear `packages/rpc-client/test/unit/fixtures.ts`**

```typescript
/**
 * Respuestas JSON-RPC capturadas/representativas para tests.
 * Mantener deterministas — nunca llaman a la red real.
 */

import type { JsonRpcSuccess, JsonRpcError, BlockchainInfo, BlockHeader } from "@myloto/types";

export const fixtureBlockchainInfo: BlockchainInfo = {
  chain: "fractal",
  blocks: 850000,
  headers: 850000,
  initialblockdownload: false,
  verificationprogress: 0.99998,
};

export const fixtureBlockHeader: BlockHeader = {
  hash: "0000000000000000000123456789abcdef0123456789abcdef0123456789abcdef",
  confirmations: 5,
  height: 850000,
  time: 1718700000,
  nonce: 1234567890,
};

export const fixtureBlockHash = "0000000000000000000123456789abcdef0123456789abcdef0123456789abcdef";

export function rpcSuccess<T>(result: T, id = "test-id"): JsonRpcSuccess<T> {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(code: number, message: string, id = "test-id"): JsonRpcError {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
```

- [ ] **Step 2: Crear `packages/rpc-client/test/unit/fetch-mock.ts`**

```typescript
/**
 * Helper para mockear fetch global en tests del transport.
 * Permite registrar respuestas secuenciales y inspeccionar las llamadas hechas.
 */

export interface MockCall {
  url: string;
  init: RequestInit;
}

export interface MockResponse {
  status?: number;
  body: unknown;
}

export class FetchMock {
  private responses: MockResponse[] = [];
  public calls: MockCall[] = [];

  /** Encola una respuesta. Se consumen en orden FIFO. */
  queue(res: MockResponse): this {
    this.responses.push(res);
    return this;
  }

  /** Implementación compatible con el RequestInit que usa el transport. */
  fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlString = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    this.calls.push({ url: urlString, init: init ?? {} });

    const next = this.responses.shift();
    if (!next) {
      throw new Error("FetchMock: no hay respuestas encoladas");
    }
    const status = next.status ?? 200;
    return new Response(JSON.stringify(next.body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  reset(): void {
    this.responses = [];
    this.calls = [];
  }
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm --filter @myloto/rpc-client typecheck`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add packages/rpc-client
git commit -m "test(rpc-client): fixtures RPC + helper FetchMock"
```

---

## Task 8: FractalTransport — implementación (TDD)

**Objetivo:** El transport completo: JSON-RPC POST, Basic Auth, timeout, reintentos selectivos, circuit breaker, logging.

**Files:**
- Create: `packages/rpc-client/test/unit/transport.test.ts`
- Create: `packages/rpc-client/src/transport.ts`
- Modify: `packages/rpc-client/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN (`packages/rpc-client/test/unit/transport.test.ts`)**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FractalTransport } from "../../src/transport.js";
import { FetchMock } from "./fetch-mock.js";
import {
  rpcSuccess,
  rpcError,
  fixtureBlockchainInfo,
} from "./fixtures.js";
import { RpcAuthError, RpcMethodError, CircuitOpenError, FractalRpcError } from "../../src/errors.js";

function makeTransport(mock: FetchMock, overrides: Record<string, unknown> = {}) {
  const transport = new FractalTransport({
    url: "http://100.64.0.1:8332",
    username: "moonyetis_rpc",
    password: "secret",
    timeoutMs: 5000,
    maxRetries: 3,
    retryBackoffMs: 10, // bajo para tests rápidos
    breakerThreshold: 5,
    breakerResetMs: 1000,
    fetchImpl: mock.fetch,
    ...overrides,
  });
  return transport;
}

describe("FractalTransport", () => {
  let mock: FetchMock;
  beforeEach(() => {
    mock = new FetchMock();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parsea una respuesta exitosa", async () => {
    mock.queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock);
    const result = await t.call("getblockchaininfo");
    expect(result).toEqual(fixtureBlockchainInfo);
  });

  it("envía Basic Auth con las credenciales", async () => {
    mock.queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock);
    await t.call("getblockchaininfo");
    const init = mock.calls[0]?.init;
    const auth = init?.headers as Record<string, string>;
    expect(auth.Authorization).toMatch(/^Basic /);
    const decoded = Buffer.from(auth.Authorization.replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("moonyetis_rpc:secret");
  });

  it("lanza RpcAuthError en HTTP 401 sin reintentar", async () => {
    mock.queue({ status: 401, body: {} });
    const t = makeTransport(mock);
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(RpcAuthError);
    expect(mock.calls).toHaveLength(1); // sin reintentos
  });

  it("lanza RpcMethodError en error lógico RPC (-3) sin reintentar", async () => {
    mock.queue({ body: rpcError(-3, "Invalid parameters") });
    const t = makeTransport(mock);
    await expect(t.call("getblock")).rejects.toBeInstanceOf(RpcMethodError);
    expect(mock.calls).toHaveLength(1);
  });

  it("reintenta en HTTP 500 y termina exitosamente", async () => {
    mock
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} })
      .queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock, { retryBackoffMs: 1 });
    const result = await t.call("getblockchaininfo");
    expect(result).toEqual(fixtureBlockchainInfo);
    expect(mock.calls).toHaveLength(3);
  });

  it("agota reintentos y lanza FractalRpcError", async () => {
    mock
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} })
      .queue({ status: 500, body: {} }); // 4 intentos totales (1 + 3 retries)
    const t = makeTransport(mock, { retryBackoffMs: 1 });
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(FractalRpcError);
    expect(mock.calls).toHaveLength(4);
  });

  it("reintenta en error RPC transitorio -28 (verifying blocks)", async () => {
    mock
      .queue({ body: rpcError(-28, "Verifying blocks...") })
      .queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const t = makeTransport(mock, { retryBackoffMs: 1 });
    const result = await t.call("getblockchaininfo");
    expect(result).toEqual(fixtureBlockchainInfo);
    expect(mock.calls).toHaveLength(2);
  });

  it("circuito abre tras N fallos consecutivos y rechaza sin red", async () => {
    // threshold 2: 2 fallos abren el circuito
    const t = makeTransport(mock, { breakerThreshold: 2, retryBackoffMs: 1, maxRetries: 0 });
    mock.queue({ status: 500, body: {} });
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(FractalRpcError);
    mock.queue({ status: 500, body: {} });
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(FractalRpcError);
    // ahora circuito abierto
    await expect(t.call("getblockchaininfo")).rejects.toBeInstanceOf(CircuitOpenError);
    expect(mock.calls).toHaveLength(2); // la 3a ni tocó la red
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/rpc-client test`
Expected: FAIL con "Cannot find module '../../src/transport.js'".

- [ ] **Step 3: Implementar `packages/rpc-client/src/transport.ts`**

```typescript
import { randomUUID } from "node:crypto";
import type { JsonRpcError, JsonRpcSuccess } from "@myloto/types";
import { createLogger, type Logger } from "@myloto/config";
import {
  CircuitBreaker,
  CircuitOpenError,
  FractalRpcError,
  RpcAuthError,
  RpcMethodError,
  RpcNetworkError,
  RpcTimeoutError,
} from "./errors.js";

export type FetchImpl = typeof fetch;

export interface FractalTransportOptions {
  url: string;
  username: string;
  password: string;
  timeoutMs?: number; // default 15000
  maxRetries?: number; // intentos ADICIONALES, default 3 (máx 4 llamadas totales)
  retryBackoffMs?: number; // base backoff exponencial, default 500
  breakerThreshold?: number; // default 5
  breakerResetMs?: number; // default 30000
  /** Inyectar fetch para tests. Default: global fetch (undici). */
  fetchImpl?: FetchImpl;
  /** Inyectar logger para tests. Default: createLogger de @myloto/config. */
  logger?: Logger;
}

/** Códigos RPC transitorios que sí merecen reintento (Bitcoin Core convention). */
const TRANSIENT_RPC_CODES = new Set<number>([-28]); // -28 = verifying blocks / loading index

/** Códigos de error de Node que indican problema de red transitorio. */
const TRANSIENT_ERRNO = new Set<string>([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_SOCKET",
]);

export class FractalTransport {
  private readonly opts: Required<Omit<FractalTransportOptions, "fetchImpl" | "logger">>;
  private readonly breaker: CircuitBreaker;
  private readonly fetchImpl: FetchImpl;
  private readonly logger: Logger;
  private readonly authHeader: string;

  constructor(options: FractalTransportOptions) {
    this.opts = {
      url: options.url,
      username: options.username,
      password: options.password,
      timeoutMs: options.timeoutMs ?? 15000,
      maxRetries: options.maxRetries ?? 3,
      retryBackoffMs: options.retryBackoffMs ?? 500,
      breakerThreshold: options.breakerThreshold ?? 5,
      breakerResetMs: options.breakerResetMs ?? 30000,
    };
    this.breaker = new CircuitBreaker({
      threshold: this.opts.breakerThreshold,
      resetMs: this.opts.breakerResetMs,
    });
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? createLogger("info", "rpc-client");
    const token = Buffer.from(`${this.opts.username}:${this.opts.password}`).toString("base64");
    this.authHeader = `Basic ${token}`;
  }

  /**
   * Ejecuta una llamada JSON-RPC 2.0 con resiliencia completa.
   * @throws FractalRpcError o subclase.
   */
  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.breaker.allow()) {
      this.logger.warn("circuit open, rejecting call", { method });
      throw new CircuitOpenError(method);
    }

    const maxAttempts = this.opts.maxRetries + 1;
    let lastError: FractalRpcError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const id = randomUUID();
      const started = Date.now();
      try {
        const result = await this.doFetch<T>(method, params, id);
        const durationMs = Date.now() - started;
        this.breaker.recordSuccess();
        this.logger.debug("rpc ok", { method, id, attempt, durationMs });
        return result;
      } catch (err) {
        const durationMs = Date.now() - started;
        lastError = toRpcError(err, method);
        this.logger.warn("rpc fail", {
          method,
          id,
          attempt,
          durationMs,
          errorCode: lastError.code,
          errorMsg: lastError.message,
        });

        if (!isTransient(lastError) || attempt === maxAttempts - 1) {
          break; // no reintenta
        }
        await sleep(backoffMs(this.opts.retryBackoffMs, attempt));
      }
    }

    this.breaker.recordFailure();
    throw lastError ?? new FractalRpcError("unknown RPC error", undefined, method);
  }

  private async doFetch<T>(
    method: string,
    params: unknown[],
    id: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      const response = await this.fetchImpl(this.opts.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.authHeader,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new RpcAuthError(method);
      }
      if (response.status >= 500) {
        throw new FractalRpcError(`HTTP ${response.status}`, response.status, method);
      }
      if (response.status === 429) {
        throw new FractalRpcError("HTTP 429 rate limited", 429, method);
      }
      if (response.status >= 400) {
        throw new FractalRpcError(`HTTP ${response.status}`, response.status, method);
      }

      const payload = (await response.json()) as JsonRpcSuccess<T> | JsonRpcError;
      if ("error" in payload && payload.error) {
        throw new RpcMethodError(payload.error.message, payload.error.code, method);
      }
      return payload.result;
    } catch (err) {
      if (err instanceof FractalRpcError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new RpcTimeoutError(method);
      }
      if (err instanceof Error) {
        const errno = (err as NodeJS.ErrnoException).code;
        if (errno && TRANSIENT_ERRNO.has(errno)) {
          throw new RpcNetworkError(`${errno}: ${err.message}`, method);
        }
      }
      throw new FractalRpcError(err instanceof Error ? err.message : "fetch error", undefined, method);
    } finally {
      clearTimeout(timer);
    }
  }
}

function isTransient(err: FractalRpcError): boolean {
  // Errores de red, timeout y 5xx son transitorios
  if (err instanceof RpcNetworkError) return true;
  if (err instanceof RpcTimeoutError) return true;
  // HTTP 5xx o 429
  if (err.code === 500 || err.code === 502 || err.code === 503 || err.code === 504 || err.code === 429) {
    return true;
  }
  // Código RPC -28 (verifying blocks)
  if (err instanceof RpcMethodError && err.code !== undefined && TRANSIENT_RPC_CODES.has(err.code)) {
    return true;
  }
  return false;
}

function toRpcError(err: unknown, method: string): FractalRpcError {
  if (err instanceof FractalRpcError) return err;
  if (err instanceof Error && err.name === "AbortError") return new RpcTimeoutError(method);
  return new FractalRpcError(err instanceof Error ? err.message : "unknown", undefined, method);
}

function backoffMs(base: number, attempt: number): number {
  const exp = base * Math.pow(2, attempt);
  const jitter = Math.random() * 250;
  return exp + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Actualizar `packages/rpc-client/src/index.ts`**

```typescript
export * from "./errors.js";
export { CircuitBreaker } from "./circuit-breaker.js";
export type { CircuitState, CircuitBreakerOptions } from "./circuit-breaker.js";
export { FractalTransport } from "./transport.js";
export type { FractalTransportOptions, FetchImpl } from "./transport.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/rpc-client test`
Expected: 8 tests de transport + 7 de circuit-breaker + 3 de errors = 18 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/rpc-client
git commit -m "feat(rpc-client): FractalTransport con reintentos, timeout y circuit breaker"
```

---

## Task 9: FractalRpcClient — métodos tipados (TDD)

**Objetivo:** La capa fina sobre el transport que expone métodos tipados.

**Files:**
- Create: `packages/rpc-client/test/unit/client.test.ts`
- Create: `packages/rpc-client/src/client.ts`
- Modify: `packages/rpc-client/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN (`packages/rpc-client/test/unit/client.test.ts`)**

```typescript
import { describe, it, expect, vi } from "vitest";
import { FractalRpcClient } from "../../src/client.js";
import { FractalTransport } from "../../src/transport.js";
import { FetchMock } from "./fetch-mock.js";
import {
  rpcSuccess,
  fixtureBlockchainInfo,
  fixtureBlockHeader,
  fixtureBlockHash,
} from "./fixtures.js";

function makeClient(mock: FetchMock) {
  const transport = new FractalTransport({
    url: "http://100.64.0.1:8332",
    username: "user",
    password: "pass",
    retryBackoffMs: 1,
    fetchImpl: mock.fetch,
  });
  return new FractalRpcClient(transport);
}

describe("FractalRpcClient", () => {
  it("getBlockchainInfo devuelve BlockchainInfo tipado", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(fixtureBlockchainInfo) });
    const client = makeClient(mock);
    const info = await client.getBlockchainInfo();
    expect(info.chain).toBe("fractal");
    expect(info.blocks).toBe(850000);
  });

  it("getBlockCount devuelve número", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(850000) });
    const client = makeClient(mock);
    const count = await client.getBlockCount();
    expect(count).toBe(850000);
    // verificar que llamó al método correcto
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getblockcount");
  });

  it("getBlockHash devuelve hex string", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(fixtureBlockHash) });
    const client = makeClient(mock);
    const hash = await client.getBlockHash(850000);
    expect(hash).toBe(fixtureBlockHash);
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getblockhash");
    expect(body.params).toEqual([850000]);
  });

  it("getBlock devuelve BlockHeader", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(fixtureBlockHeader) });
    const client = makeClient(mock);
    const block = await client.getBlock(fixtureBlockHash);
    expect(block.hash).toBe(fixtureBlockHash);
    expect(block.confirmations).toBe(5);
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getblock");
  });

  it("getReceivedByAddress pasa address y minconf", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(0.5) });
    const client = makeClient(mock);
    const amount = await client.getReceivedByAddress("bc1q...", 1);
    expect(amount).toBe(0.5);
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.method).toBe("getreceivedbyaddress");
    expect(body.params).toEqual(["bc1q...", 1]);
  });

  it("getReceivedByAddress default minconf = 1", async () => {
    const mock = new FetchMock();
    mock.queue({ body: rpcSuccess(0) });
    const client = makeClient(mock);
    await client.getReceivedByAddress("bc1q...");
    const body = JSON.parse(mock.calls[0]?.init.body as string);
    expect(body.params).toEqual(["bc1q...", 1]);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/rpc-client test`
Expected: FAIL con "Cannot find module '../../src/client.js'".

- [ ] **Step 3: Implementar `packages/rpc-client/src/client.ts`**

```typescript
import type { BlockchainInfo, BlockHeader } from "@myloto/types";
import type { FractalTransport } from "./transport.js";

/**
 * Capa de dominio tipada sobre FractalTransport.
 * Cada método envuelve exactamente un método RPC y devuelve un tipo estricto.
 * Cero lógica de red aquí — solo mapeo de tipos.
 */
export class FractalRpcClient {
  constructor(private readonly transport: FractalTransport) {}

  /** Salud del nodo: cadena, altura, IBD, progreso. */
  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.transport.call<BlockchainInfo>("getblockchaininfo");
  }

  /** Altura actual del mejor bloque. */
  async getBlockCount(): Promise<number> {
    return this.transport.call<number>("getblockcount");
  }

  /** Hash del bloque a la altura dada (hex de 64 chars). */
  async getBlockHash(height: number): Promise<string> {
    return this.transport.call<string>("getblockhash", [height]);
  }

  /** Header + metadata del bloque. */
  async getBlock(hash: string): Promise<BlockHeader> {
    return this.transport.call<BlockHeader>("getblock", [hash]);
  }

  /**
   * Total recibido por una dirección en FB.
   * NOTA: consulta direcciones ya conocidas por el backend; NO usa scantxoutset
   * ni expone la XPUB al nodo.
   */
  async getReceivedByAddress(address: string, minconf = 1): Promise<number> {
    return this.transport.call<number>("getreceivedbyaddress", [address, minconf]);
  }
}
```

- [ ] **Step 4: Actualizar `packages/rpc-client/src/index.ts`**

```typescript
export * from "./errors.js";
export { CircuitBreaker } from "./circuit-breaker.js";
export type { CircuitState, CircuitBreakerOptions } from "./circuit-breaker.js";
export { FractalTransport } from "./transport.js";
export type { FractalTransportOptions, FetchImpl } from "./transport.js";
export { FractalRpcClient } from "./client.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/rpc-client test`
Expected: 6 tests de client + 8 de transport + 7 de circuit-breaker + 3 de errors = 24 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/rpc-client
git commit -m "feat(rpc-client): FractalRpcClient con métodos tipados"
```

---

## Task 10: Tests de integración contra nodo real

**Objetivo:** Suite opcional que valida el cliente contra el nodo Fractal real vía Tailscale. Se ejecuta solo con `RUN_INTEGRATION=1`.

**Files:**
- Create: `packages/rpc-client/test/integration/node.test.ts`
- Create: `packages/rpc-client/.env.example` (para el runner de integración, opcional)

- [ ] **Step 1: Crear `packages/rpc-client/test/integration/node.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { config } from "dotenv";
import { FractalTransport } from "../../src/transport.js";
import { FractalRpcClient } from "../../src/client.js";

// Cargar .env de la raíz del proyecto para RUN_INTEGRATION
config({ path: "../../.env" });

const shouldRun = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!shouldRun)("FractalRpcClient — integración contra nodo real", () => {
  function makeClient(): FractalRpcClient {
    const url = process.env.FRACTAL_RPC_URL;
    const username = process.env.FRACTAL_RPC_USER;
    const password = process.env.FRACTAL_RPC_PASSWORD;
    if (!url || !username || !password) {
      throw new Error("Faltan FRACTAL_RPC_URL/USER/PASSWORD en .env para tests de integración");
    }
    const transport = new FractalTransport({ url, username, password });
    return new FractalRpcClient(transport);
  }

  it("getBlockchainInfo devuelve chain y blocks > 0", async () => {
    const client = makeClient();
    const info = await client.getBlockchainInfo();
    expect(typeof info.chain).toBe("string");
    expect(info.chain.length).toBeGreaterThan(0);
    expect(info.blocks).toBeGreaterThan(0);
  }, 30000);

  it("getBlockCount coincide con info.blocks", async () => {
    const client = makeClient();
    const [info, count] = await Promise.all([client.getBlockchainInfo(), client.getBlockCount()]);
    expect(count).toBe(info.blocks);
  }, 30000);

  it("getBlockHash devuelve hex de 64 chars", async () => {
    const client = makeClient();
    const count = await client.getBlockCount();
    const hash = await client.getBlockHash(count);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  }, 30000);

  it("getBlock devuelve confirmaciones >= 1", async () => {
    const client = makeClient();
    const count = await client.getBlockCount();
    const hash = await client.getBlockHash(count);
    const block = await client.getBlock(hash);
    expect(block.confirmations).toBeGreaterThanOrEqual(1);
    expect(block.hash).toBe(hash);
  }, 30000);
});
```

- [ ] **Step 2: Añadir `dotenv` a devDependencies del rpc-client**

Modificar `packages/rpc-client/package.json`, sección `devDependencies`, añadir:
```json
"dotenv": "^16.4.5"
```

- [ ] **Step 3: Instalar**

Run: `pnpm install`
Expected: sin errores.

- [ ] **Step 4: Verificar que la suite se SKIPEA sin RUN_INTEGRATION**

Run: `pnpm --filter @myloto/rpc-client test:integration`
Expected: "4 tests skipped" (porque `RUN_INTEGRATION` no está set).

- [ ] **Step 5: Documentar cómo ejecutarla en README del paquete**

Crear `packages/rpc-client/README.md`:
```markdown
# @myloto/rpc-client

Cliente RPC tipado y resiliente para el nodo `fractald` de Fractal Bitcoin.

## Tests

```bash
# Unitarios (rápidos, sin red)
pnpm test

# Integración contra nodo real (requiere .env con credenciales y Tailscale activo)
RUN_INTEGRATION=1 pnpm test:integration
```
```

- [ ] **Step 6: Commit**

```bash
git add packages/rpc-client
git commit -m "test(rpc-client): suite de integración contra nodo real (RUN_INTEGRATION=1)"
```

---

## Task 11: Paquete `packages/db` — schema Drizzle

**Objetivo:** Definir el schema como fuente única de verdad y generar la primera migración.

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/vitest.config.ts`
- Create: `packages/db/vitest.integration.config.ts`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Crear `packages/db/package.json`**

```json
{
  "name": "@myloto/db",
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
    "test:watch": "vitest",
    "test:integration": "RUN_INTEGRATION=1 vitest run --config vitest.integration.config.ts",
    "drizzle:generate": "drizzle-kit generate",
    "drizzle:migrate": "tsx src/migrate.ts"
  },
  "dependencies": {
    "@myloto/types": "workspace:*",
    "drizzle-orm": "^0.35.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.26.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@testcontainers/postgresql": "^10.13.0",
    "testcontainers": "^10.13.0"
  }
}
```

- [ ] **Step 2: Crear `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Crear `packages/db/vitest.config.ts` (unit)**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Crear `packages/db/vitest.integration.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 60000,
  },
});
```

- [ ] **Step 5: Crear `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://myloto:myloto@localhost:5432/myloto",
  },
});
```

- [ ] **Step 6: Crear `packages/db/src/schema.ts`**

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
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { BALOTA_MIN, BALOTA_MAX, POWERBALL_MIN, POWERBALL_MAX } from "@myloto/types";

export const sorteos = pgTable(
  "sorteos",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    bloqueCierre: integer("bloque_cierre").notNull(),
    estado: text("estado").notNull().default("ABIERTO"),
    combinacionGanadora: jsonb("combinacion_ganadora"),
    seedMaestra: text("seed_maestra"),
    bloquesSemilla: jsonb("bloques_semilla"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
    calculadoEn: timestamp("calculado_en", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sorteos_bloque_cierre_unique").on(t.bloqueCierre),
    check(
      "chk_sorteo_estado",
      sql`${t.estado} IN ('ABIERTO', 'CERRADO', 'CALCULADO')`,
    ),
  ],
);

export const tickets = pgTable(
  "tickets",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    sorteoId: bigserial("sorteo_id", { mode: "bigint" })
      .notNull()
      .references(() => sorteos.id, { onDelete: "cascade" }),
    paymentAddress: text("payment_address").notNull(),
    expectedAmount: numeric("expected_amount", { precision: 18, scale: 8 }).notNull(),
    status: text("status").notNull().default("PENDIENTE"),
    n1: smallint("n1").notNull(),
    n2: smallint("n2").notNull(),
    n3: smallint("n3").notNull(),
    n4: smallint("n4").notNull(),
    n5: smallint("n5").notNull(),
    powerball: smallint("powerball").notNull(),
    userReturnAddress: text("user_return_address"),
    recibidoEn: timestamp("recibido_en", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tickets_sorteo_status").on(t.sorteoId, t.status),
    index("tickets_payment_address").on(t.paymentAddress),
    index("tickets_sorteo_combinacion").on(
      t.sorteoId,
      t.n1,
      t.n2,
      t.n3,
      t.n4,
      t.n5,
      t.powerball,
    ),
    check("chk_ticket_status", sql`${t.status} IN ('PENDIENTE', 'ACTIVO')`),
    check(
      "chk_balotas_sorted",
      sql`${t.n1} < ${t.n2} AND ${t.n2} < ${t.n3} AND ${t.n3} < ${t.n4} AND ${t.n4} < ${t.n5}`,
    ),
    check(
      "chk_balotas_range",
      sql`${t.n1} BETWEEN ${BALOTA_MIN} AND ${BALOTA_MAX}
          AND ${t.n2} BETWEEN ${BALOTA_MIN} AND ${BALOTA_MAX}
          AND ${t.n3} BETWEEN ${BALOTA_MIN} AND ${BALOTA_MAX}
          AND ${t.n4} BETWEEN ${BALOTA_MIN} AND ${BALOTA_MAX}
          AND ${t.n5} BETWEEN ${BALOTA_MIN} AND ${BALOTA_MAX}`,
    ),
    check(
      "chk_powerball_range",
      sql`${t.powerball} BETWEEN ${POWERBALL_MIN} AND ${POWERBALL_MAX}`,
    ),
  ],
);

export type Sorteo = typeof sorteos.$inferSelect;
export type NuevoSorteo = typeof sorteos.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NuevoTicket = typeof tickets.$inferInsert;
```

- [ ] **Step 7: Crear `packages/db/src/index.ts`**

```typescript
export * from "./schema.js";
export { createDb } from "./pool.js";
```

- [ ] **Step 8: Crear `packages/db/src/pool.ts`**

```typescript
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export interface DbHandle {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
}

export function createDb(databaseUrl: string): DbHandle {
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

- [ ] **Step 9: Crear `packages/db/src/migrate.ts`**

```typescript
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./pool.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL no definida");
    process.exit(1);
  }
  const { db, pool } = createDb(url);
  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("Migraciones aplicadas.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 10: Instalar y generar migración**

Run:
```bash
pnpm install
pnpm --filter @myloto/db drizzle:generate
```
Expected: crea `packages/db/migrations/0000_*.sql` con las dos tablas, constraints e índices.

- [ ] **Step 11: Verificar que la migración generada incluye los CHECKs e índices**

Run: `cat packages/db/migrations/0000_*.sql | grep -E "CHECK|CREATE INDEX"`
Expected: ver `chk_sorteo_estado`, `chk_ticket_status`, `chk_balotas_sorted`, `chk_balotas_range`, `chk_powerball_range`, y los 4 índices.

- [ ] **Step 12: Aplicar la migración a la DB local de dev**

Run: `pnpm db:migrate`
Expected: "Migraciones aplicadas." (requiere `DATABASE_URL` en `.env` o el default de drizzle.config).

- [ ] **Step 13: Verificar el esquema en psql**

Run: `psql -d myloto -c "\d sorteos" -c "\d tickets"`
Expected: ambas tablas con todas las columnas, constraints e índices visibles.

- [ ] **Step 14: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): schema Drizzle para sorteos + tickets, migración inicial"
```

---

## Task 12: Tests de DB con testcontainers (TDD)

**Objetivo:** Verificar que las constraints e índices funcionan con un Postgres efímero.

**Files:**
- Create: `packages/db/test/integration/schema.test.ts`

- [ ] **Step 1: Escribir tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { sorteos, tickets } from "../../src/schema.js";

const shouldRun = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!shouldRun)("Schema DB — integración con testcontainers", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const url = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}`;
    pool = new Pool({ connectionString: url });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./packages/db/migrations" });
  }, 120000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  it("inserta un sorteo válido", async () => {
    const [row] = await pool.query(
      "INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING *",
      [850100],
    );
    expect(row.rows[0].bloque_cierre).toBe(850100);
    expect(row.rows[0].estado).toBe("ABIERTO");
  });

  it("rechaza estado inválido", async () => {
    await expect(
      pool.query("INSERT INTO sorteos (bloque_cierre, estado) VALUES ($1, $2)", [850101, "INVALIDO"]),
    ).rejects.toThrow();
  });

  it("rechaza bloque_cierre duplicado (unique)", async () => {
    await pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1)", [850200]);
    await expect(
      pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1)", [850200]),
    ).rejects.toThrow();
  });

  it("rechaza balotas desordenadas", async () => {
    const { rows } = await pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id", [850300]);
    const sorteoId = rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [sorteoId, "bc1q", "1.0", 5, 3, 10, 20, 30, 1], // n1>n2 viola sorted
      ),
    ).rejects.toThrow();
  });

  it("rechaza balota fuera de rango", async () => {
    const { rows } = await pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id", [850400]);
    const sorteoId = rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [sorteoId, "bc1q", "1.0", 1, 2, 3, 4, 70, 1], // n5=70 > 69
      ),
    ).rejects.toThrow();
  });

  it("rechaza powerball fuera de rango", async () => {
    const { rows } = await pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id", [850500]);
    const sorteoId = rows[0].id;
    await expect(
      pool.query(
        "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [sorteoId, "bc1q", "1.0", 1, 2, 3, 4, 5, 27], // powerball=27 > 26
      ),
    ).rejects.toThrow();
  });

  it("acepta ticket válido completo", async () => {
    const { rows } = await pool.query("INSERT INTO sorteos (bloque_cierre) VALUES ($1) RETURNING id", [850600]);
    const sorteoId = rows[0].id;
    const result = await pool.query(
      "INSERT INTO tickets (sorteo_id, payment_address, expected_amount, n1, n2, n3, n4, n5, powerball, user_return_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [sorteoId, "bc1qxyz", "5.0", 5, 12, 23, 45, 67, 13, "bc1qreturn"],
    );
    expect(result.rows[0].status).toBe("PENDIENTE");
    expect(result.rows[0].n1).toBe(5);
    expect(result.rows[0].powerball).toBe(13);
  });

  it("los índices existen tras migrar", async () => {
    const result = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename IN ('sorteos','tickets') ORDER BY indexname",
    );
    const names = result.rows.map((r: { indexname: string }) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "sorteos_bloque_cierre_unique",
        "tickets_sorteo_status",
        "tickets_payment_address",
        "tickets_sorteo_combinacion",
      ]),
    );
  });
});
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter @myloto/db typecheck`
Expected: exit code 0.

- [ ] **Step 3: Correr los tests de integración (requiere Docker Desktop corriendo)**

Run: `RUN_INTEGRATION=1 pnpm --filter @myloto/db test:integration`
Expected: 8 tests PASS. (Si Docker no está corriendo, fallará con error de conexión a Docker daemon — arrancarlo primero).

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "test(db): tests de schema con testcontainers verifican CHECKs e índices"
```

---

## Task 13: Paquete `apps/backend` — servidor Fastify con /health (TDD)

**Objetivo:** Servidor Fastify mínimo que expone `/health` y `/health/db`, integrando el cliente RPC y la DB.

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/vitest.config.ts`
- Create: `apps/backend/src/server.ts`
- Create: `apps/backend/src/routes/health.ts`
- Create: `apps/backend/test/health.test.ts`
- Create: `apps/backend/src/dependencies.ts`

- [ ] **Step 1: Crear `apps/backend/package.json`**

```json
{
  "name": "@myloto/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/server.ts",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@myloto/config": "workspace:*",
    "@myloto/db": "workspace:*",
    "@myloto/rpc-client": "workspace:*",
    "@myloto/types": "workspace:*",
    "fastify": "^5.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `apps/backend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Crear `apps/backend/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Crear `apps/backend/src/dependencies.ts`**

```typescript
import { loadEnv, createLogger, type Env, type Logger } from "@myloto/config";
import { createDb, type DbHandle } from "@myloto/db";
import { FractalRpcClient, FractalTransport } from "@myloto/rpc-client";

export interface AppDeps {
  env: Env;
  logger: Logger;
  db: DbHandle;
  rpc: FractalRpcClient;
}

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
  return { env, logger, db, rpc };
}
```

- [ ] **Step 5: Crear `apps/backend/src/routes/health.ts`**

```typescript
import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../dependencies.js";

export function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get("/health", async (_req, reply) => {
    try {
      const info = await deps.rpc.getBlockchainInfo();
      return {
        status: "ok",
        node: {
          chain: info.chain,
          blocks: info.blocks,
          headers: info.headers,
        },
      };
    } catch (err) {
      deps.logger.error("health RPC failed", { error: err instanceof Error ? err.message : "unknown" });
      reply.code(503);
      return {
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      };
    }
  });

  app.get("/health/db", async (_req, reply) => {
    try {
      await deps.db.db.execute("SELECT 1");
      return { status: "ok", db: "reachable" };
    } catch (err) {
      deps.logger.error("health DB failed", { error: err instanceof Error ? err.message : "unknown" });
      reply.code(503);
      return {
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      };
    }
  });
}
```

- [ ] **Step 6: Crear `apps/backend/src/server.ts`**

```typescript
import Fastify from "fastify";
import { buildDeps } from "./dependencies.js";
import { registerHealthRoutes } from "./routes/health.js";

async function main(): Promise<void> {
  const deps = buildDeps();
  const app = Fastify({
    logger: {
      level: deps.env.LOG_LEVEL,
      redact: {
        paths: ["*.password", "*.FRACTAL_RPC_PASSWORD", "Authorization", "*.Authorization"],
        censor: "[REDACTED]",
      },
    },
  });

  registerHealthRoutes(app, deps);

  const shutdown = async (signal: string) => {
    deps.logger.info("shutting down", { signal });
    await app.close();
    await deps.db.pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: deps.env.PORT, host: "0.0.0.0" });
    deps.logger.info("MYLoto backend listening", { port: deps.env.PORT });
  } catch (err) {
    deps.logger.error("failed to start", { error: err instanceof Error ? err.message : "unknown" });
    process.exit(1);
  }
}

main();
```

- [ ] **Step 7: Escribir tests que FALLARÁN (`apps/backend/test/health.test.ts`)**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerHealthRoutes } from "../src/routes/health.js";
import type { AppDeps } from "../src/dependencies.js";
import type { Logger } from "@myloto/config";
import type { DbHandle } from "@myloto/db";
import type { FractalRpcClient } from "@myloto/rpc-client";

function mockDeps(overrides: Partial<{ rpc: FractalRpcClient; db: DbHandle }> = {}): AppDeps {
  const logger: Logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
  const rpc = overrides.rpc ?? ({
    getBlockchainInfo: vi.fn().mockResolvedValue({
      chain: "fractal",
      blocks: 100,
      headers: 100,
      initialblockdownload: false,
      verificationprogress: 1,
    }),
  } as unknown as FractalRpcClient);
  const db = overrides.db ?? ({
    db: { execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]) },
    pool: { end: vi.fn() },
  } as unknown as DbHandle);
  return {
    env: {
      NODE_ENV: "test",
      FRACTAL_RPC_URL: "http://100.0.0.1:8332",
      FRACTAL_RPC_USER: "u",
      FRACTAL_RPC_PASSWORD: "p",
      FRACTAL_RPC_TIMEOUT_MS: 15000,
      DATABASE_URL: "postgresql://u:p@localhost:5432/x",
      PORT: 3000,
      LOG_LEVEL: "info",
    },
    logger,
    rpc,
    db,
  };
}

async function buildApp(deps: AppDeps) {
  const app = Fastify();
  registerHealthRoutes(app, deps);
  await app.ready();
  return app;
}

describe("GET /health", () => {
  it("responde ok con info del nodo", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.node.chain).toBe("fractal");
    expect(body.node.blocks).toBe(100);
    await app.close();
  });

  it("responde 503 si el RPC falla", async () => {
    const rpc = {
      getBlockchainInfo: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as FractalRpcClient;
    const app = await buildApp(mockDeps({ rpc }));
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("error");
    expect(body.error).toBe("connection refused");
    await app.close();
  });
});

describe("GET /health/db", () => {
  it("responde ok si SELECT 1 funciona", async () => {
    const app = await buildApp(mockDeps());
    const res = await app.inject({ method: "GET", url: "/health/db" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("reachable");
    await app.close();
  });

  it("responde 503 si la DB falla", async () => {
    const db = {
      db: { execute: vi.fn().mockRejectedValue(new Error("connection refused")) },
      pool: { end: vi.fn() },
    } as unknown as DbHandle;
    const app = await buildApp(mockDeps({ db }));
    const res = await app.inject({ method: "GET", url: "/health/db" });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("error");
    await app.close();
  });
});
```

- [ ] **Step 8: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/backend install && pnpm --filter @myloto/backend test`
Expected: FAIL con "Cannot find module '../src/routes/health.js'" (la ruta aún no resuelve — las creamos arriba, así que ya debería pasar; si falla, verificar imports).

- [ ] **Step 9: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/backend test`
Expected: 4 tests PASS.

- [ ] **Step 10: Verificar typecheck**

Run: `pnpm --filter @myloto/backend typecheck`
Expected: exit code 0.

- [ ] **Step 11: Commit**

```bash
git add apps/backend pnpm-lock.yaml
git commit -m "feat(backend): servidor Fastify con /health y /health/db"
```

---

## Task 14: Verificación end-to-end manual

**Objetivo:** Levantar todo contra el nodo real y verificar los 8 entregables del spec.

- [ ] **Step 1: Crear `.env` real en la raíz**

Copiar `.env.example` a `.env` y rellenar con valores reales:
```bash
cp .env.example .env
# Editar .env:
#   FRACTAL_RPC_URL=http://<IP_TAILSCALE_REAL>:8332
#   FRACTAL_RPC_PASSWORD=<contraseña_real_del_spec>
#   DATABASE_URL=postgresql://myloto:myloto@localhost:5432/myloto
```

- [ ] **Step 2: Aplicar migraciones contra DB local**

Run: `pnpm db:migrate`
Expected: "Migraciones aplicadas."

- [ ] **Step 3: Typecheck global**

Run: `pnpm typecheck`
Expected: exit code 0 en todos los paquetes.

- [ ] **Step 4: Tests unitarios globales**

Run: `pnpm test`
Expected: todos PASS.

- [ ] **Step 5: Tests de integración (requiere Docker + Tailscale + nodo real)**

Run: `RUN_INTEGRATION=1 pnpm test:integration`
Expected: tests de DB (testcontainers) y de RPC (nodo real) todos PASS.

- [ ] **Step 6: Levantar el backend**

Run: `pnpm dev`
Expected: log "MYLoto backend listening { port: 3000 }".

- [ ] **Step 7: Verificar `/health` con curl**

En otra terminal:
```bash
curl -s http://localhost:3000/health | jq .
```
Expected:
```json
{
  "status": "ok",
  "node": {
    "chain": "fractal",
    "blocks": <altura_real>,
    "headers": <altura_real>
  }
}
```

- [ ] **Step 8: Verificar `/health/db` con curl**

```bash
curl -s http://localhost:3000/health/db | jq .
```
Expected:
```json
{ "status": "ok", "db": "reachable" }
```

- [ ] **Step 9: Detener el backend y commit final**

```bash
# Ctrl-C en la terminal del backend
git add -A
git commit -m "chore: verificación end-to-end del Ciclo 1 completa"
```

- [ ] **Step 10: Marcar el ciclo como completo**

Los 8 entregables del spec (§11) están verificados:
1. ✅ Monorepo levanta con `pnpm install`
2. ✅ `pnpm typecheck` pasa
3. ✅ `pnpm test` (unitarios) pasa
4. ✅ `pnpm db:migrate` crea las tablas
5. ✅ `pnpm test:integration` pasa
6. ✅ `pnpm dev` arranca en :3000
7. ✅ `GET /health` responde con altura real
8. ✅ `GET /health/db` responde OK

---

## Self-Review del Plan

### Especificación cubierta

| Sección del spec | Tarea que lo implementa |
|---|---|
| §3 Arquitectura monorepo | Task 1 (raíz) + Tasks 2–13 (paquetes) |
| §4 Esquema DB | Task 11 (schema) + Task 12 (tests) |
| §5.1 FractalTransport | Task 5 (errores) + Task 6 (breaker) + Task 8 (transport) |
| §5.2 FractalRpcClient | Task 9 |
| §5.3 Errores tipados | Task 5 |
| §5.4 Testing del cliente | Tasks 8 (unit), 10 (integration) |
| §6 packages/config | Tasks 3 (env), 4 (logger) |
| §7 packages/db | Tasks 11, 12 |
| §8 apps/backend | Task 13 |
| §9 Prerrequisitos | Header del plan |
| §10 Scripts workspace | Task 1 |
| §11 Entregables | Task 14 |
| §12 Config TypeScript | Task 1 (tsconfig.base) |

Todas las secciones del spec tienen al menos una tarea que la implementa. ✓

### Placeholder scan

Sin TBDs, TODOs, "implement later", ni "similar a Task N". Todo el código está completo. ✓

### Type consistency

- `FractalTransport.call<T>()` — usado en `client.ts` y testeado en `transport.test.ts`. ✓
- `FractalRpcClient` métodos: `getBlockchainInfo`, `getBlockCount`, `getBlockHash`, `getBlock`, `getReceivedByAddress` — idénticos en spec, client.ts, y tests. ✓
- `CircuitBreaker` API: `allow()`, `recordSuccess()`, `recordFailure()`, `state` — consistente. ✓
- `DbHandle` con `db` y `pool` — usado en `dependencies.ts` y `health.ts`. ✓
- `AppDeps` — usado en `routes/health.ts` y `server.ts`. ✓

Sin inconsistencias. ✓
