# Wallet Login + Panel de Usuario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de autenticación con wallet Bitcoin (BIP-322) + página "Mis Boletos" donde el usuario ve sus tickets vigentes/pasados y si ganó.

**Architecture:** Auth BIP-322 (mensaje firmado verificado con `bip322-js`) → JWT en cookie httpOnly. La `walletAddress` del comprador se guarda en cada ticket (columna nueva). Panel protegido con pestañas Vigentes/Pasados. Wizard exige login antes de comprar.

**Tech Stack:** Node 22, Fastify, Drizzle ORM, Postgres, `bip322-js`, `jsonwebtoken`, `@fastify/cookie`, Vitest, Next.js 15.

**Spec:** `docs/superpowers/specs/2026-06-27-wallet-login-user-panel-design.md`

---

## File Structure

### Crear (backend)
- `apps/backend/src/services/auth.ts` — generateNonce, verifyBip322Signature, signJwt, verifyJwt, requireAuth helper
- `apps/backend/src/routes/auth.ts` — POST /auth/nonce, /verify, /logout, GET /auth/me
- `apps/backend/src/routes/me.ts` — GET /me/tickets
- `apps/backend/src/services/me.ts` — getTicketsByWallet (query vigentes/pasados)
- `apps/backend/src/test/auth.test.ts` — tests de JWT + verificación BIP-322

### Crear (frontend)
- `apps/web/src/lib/wallet.ts` — connectWallet, signMessage (window.unisat/bitcoin)
- `apps/web/src/app/mis-boletos/page.tsx` — página del panel
- `apps/web/src/components/me/TicketCard.tsx` — tarjeta de boleto
- `apps/web/src/components/me/WalletConnect.tsx` — pantalla de conectar wallet

### Modificar
- `packages/config/src/env.ts` — JWT_SECRET (required)
- `packages/db/src/schema.ts` — wallet_sessions table + walletAddress column
- `apps/backend/src/server.ts` — registrar @fastify/cookie, rutas auth + me
- `apps/backend/src/routes/tickets.ts` — require auth + walletAddress
- `apps/backend/src/services/tickets.ts` — CreateTicketInput.walletAddress
- `apps/backend/test/health.test.ts` — mockDeps: añadir JWT_SECRET
- `apps/web/src/lib/hooks.ts` — useWallet, useAuth, useSession
- `apps/web/src/lib/api.ts` — auth API + getMyTickets
- `apps/web/src/components/wizard/BuyWizard.tsx` — paso 0 conectar wallet
- `apps/web/src/components/ui/Navbar.tsx` — wallet + link + salir
- `apps/web/src/components/dashboard/ComprarButton.tsx` — verificar sesión

---

## Task 1: Dependencias + JWT_SECRET + schema de DB

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `apps/backend/test/health.test.ts`

- [ ] **Step 1: Instalar dependencias backend**

```bash
cd /Users/osmanmarin/Desktop/MYLoto
pnpm --filter @myloto/backend add bip322-js jsonwebtoken @fastify/cookie
pnpm --filter @myloto/backend add -D @types/jsonwebtoken
```

- [ ] **Step 2: Añadir JWT_SECRET a env.ts**

En `packages/config/src/env.ts`, después de `BLOCK_TIME_MS: ...` y antes del cierre `});`, añadir:

```ts
  // --- Auth (wallet login BIP-322) ---
  // Secreto para firmar JWT de sesión. OBLIGATORIO en producción.
  JWT_SECRET: z.string().min(16),
  // Duración de la sesión JWT en segundos (default 7 días).
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(604800),
```

- [ ] **Step 3: Actualizar mockDeps del test de health**

En `apps/backend/test/health.test.ts`, dentro del objeto `env` del `mockDeps` (después de `BLOCK_TIME_MS: 600000,`), añadir:

```ts
      JWT_SECRET: "test-secret-at-least-16-chars",
      JWT_EXPIRES_IN: 604800,
```

- [ ] **Step 4: Añadir tabla wallet_sessions y columna walletAddress al schema**

En `packages/db/src/schema.ts`, después de la tabla `jackpotPool` (antes de los `export type`), añadir:

```ts
export const walletSessions = pgTable(
  "wallet_sessions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    address: text("address").notNull(),
    nonce: text("nonce").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    addressIdx: index("wallet_sessions_address").on(t.address),
  }),
);
```

Y en la tabla `tickets`, después de `userReturnAddress: text("user_return_address"),` añadir:

```ts
    walletAddress: text("wallet_address"),
```

Y en el objeto de indexes de tickets, después de `paymentAddressIdx`, añadir:

```ts
    walletAddressIdx: index("tickets_wallet_address").on(t.walletAddress, t.sorteoId),
```

- [ ] **Step 5: Rebuild packages config + db (dist desactualizado)**

```bash
cd /Users/osmanmarin/Desktop/MYLoto
pnpm --filter @myloto/config build
pnpm --filter @myloto/db build
```

- [ ] **Step 6: Generar y aplicar migración Drizzle**

```bash
cd /Users/osmanmarin/Desktop/MYLoto
pnpm --filter @myloto/db drizzle:generate
```
Expected: genera un nuevo archivo SQL en `packages/db/drizzle/` con `CREATE TABLE wallet_sessions` y `ALTER TABLE tickets ADD COLUMN wallet_address`.

Luego aplicar en la DB del nodo-desktop (Task de deploy). Por ahora solo generar.

- [ ] **Step 7: Verificar typecheck + tests**

```bash
pnpm --filter @myloto/backend typecheck 2>&1 | tail -3
pnpm --filter @myloto/backend test -- --run 2>&1 | tail -6
```
Expected: typecheck limpio, 69 tests pasan.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(db): wallet_sessions table + walletAddress column + JWT_SECRET env

- Tabla wallet_sessions para nonces BIP-322
- Columna walletAddress en tickets (nullable, retrocompatible)
- JWT_SECRET y JWT_EXPIRES_IN en env (required, fail-fast)
- Dependencias: bip322-js, jsonwebtoken, @fastify/cookie"
```

---

## Task 2: Servicio de auth — JWT + verificación BIP-322 (TDD)

**Files:**
- Create: `apps/backend/src/services/auth.ts`
- Create: `apps/backend/src/test/auth.test.ts`

- [ ] **Step 1: Crear el test (TDD)**

Crear `apps/backend/src/test/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt, generateNonce } from "../services/auth.js";

describe("JWT", () => {
  const secret = "test-secret-at-least-16-chars-long";

  it("signJwt produce un token verificable", () => {
    const token = signJwt({ address: "bc1qtest123" }, secret, 3600);
    expect(token).toBeTypeOf("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
  });

  it("verifyJwt devuelve el payload para un token válido", () => {
    const token = signJwt({ address: "bc1qtest123" }, secret, 3600);
    const payload = verifyJwt(token, secret);
    expect(payload.address).toBe("bc1qtest123");
  });

  it("verifyJwt devuelve null para un token inválido", () => {
    const payload = verifyJwt("invalid.token.here", secret);
    expect(payload).toBeNull();
  });

  it("verifyJwt devuelve null para un secreto incorrecto", () => {
    const token = signJwt({ address: "bc1qtest123" }, secret, 3600);
    const payload = verifyJwt(token, "wrong-secret-also-16-chars");
    expect(payload).toBeNull();
  });
});

describe("generateNonce", () => {
  it("genera un string aleatorio de 32 chars hex", () => {
    const nonce = generateNonce();
    expect(nonce).toBeTypeOf("string");
    expect(nonce).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(nonce).toMatch(/^[0-9a-f]+$/);
  });

  it("genera nonces diferentes cada vez", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test para verificar que falla**

Run: `cd /Users/osmanmarin/Desktop/MYLoto && pnpm --filter @myloto/backend test -- --run src/test/auth.test.ts 2>&1 | tail -8`
Expected: FAIL con "Cannot find module '../services/auth.js'"

- [ ] **Step 3: Implementar auth.ts**

Crear `apps/backend/src/services/auth.ts`:

```ts
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";

export interface JwtPayload {
  address: string;
}

/**
 * Genera un nonce aleatorio de 32 bytes (64 hex chars) para BIP-322.
 */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Firma un JWT con el payload y secreto dados.
 */
export function signJwt(payload: JwtPayload, secret: string, expiresInSec: number): string {
  return jwt.sign(payload, secret, { expiresIn: expiresInSec });
}

/**
 * Verifica un JWT. Devuelve el payload si es válido, null si no.
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return { address: decoded.address };
  } catch {
    return null;
  }
}

/**
 * Extrae y verifica el JWT de la cookie de una request Fastify.
 * Devuelve la wallet address si hay sesión válida, null si no.
 */
export function requireAuth(request: FastifyRequest, secret: string): string | null {
  const token = (request as any).cookies?.session;
  if (!token) return null;
  const payload = verifyJwt(token, secret);
  return payload?.address ?? null;
}
```

- [ ] **Step 4: Run test para verificar que pasa**

Run: `pnpm --filter @myloto/backend test -- --run src/test/auth.test.ts 2>&1 | tail -10`
Expected: PASS — 6 tests pasan (4 JWT + 2 nonce).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/auth.ts apps/backend/src/test/auth.test.ts
git commit -m "feat(backend): servicio auth (JWT + nonce) con tests"
```

---

## Task 3: Rutas de auth (/auth/nonce, /verify, /logout, /me)

**Files:**
- Create: `apps/backend/src/routes/auth.ts`
- Create: `apps/backend/src/services/wallet-sessions.ts`

- [ ] **Step 1: Crear servicio de wallet sessions**

Crear `apps/backend/src/services/wallet-sessions.ts`:

```ts
import { eq, lt } from "drizzle-orm";
import { walletSessions, type Database } from "@myloto/db";

/** Crea un nonce para una address. Borra nonces anteriores de la misma address. */
export async function createNonce(db: Database, address: string, nonce: string): Promise<void> {
  // Borrar nonces anteriores de esta address (un solo nonce activo por wallet)
  await db.delete(walletSessions).where(eq(walletSessions.address, address));
  await db.insert(walletSessions).values({ address, nonce });
}

/** Verifica si un nonce es válido para una address. Lo borra (uso único). */
export async function consumeNonce(db: Database, address: string, nonce: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(walletSessions)
    .where(eq(walletSessions.address, address))
    .limit(1);
  const row = rows[0];
  if (!row || row.nonce !== nonce) return false;
  // Nonce válido → borrarlo (uso único)
  await db.delete(walletSessions).where(eq(walletSessions.id, row.id));
  return true;
}

/** Borra nonces expirados (mayores a 5 minutos). Limpieza periódica. */
export async function cleanExpiredNonces(db: Database, maxAgeMs = 300_000): Promise<void> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  await db.delete(walletSessions).where(lt(walletSessions.creadoEn, cutoff));
}
```

- [ ] **Step 2: Crear rutas de auth**

Crear `apps/backend/src/routes/auth.ts`:

```ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../dependencies.js";
import { generateNonce, signJwt, verifyJwt, requireAuth } from "../services/auth.js";
import { createNonce, consumeNonce } from "../services/wallet-sessions.js";

const NonceBody = z.object({ address: z.string().min(1) });
const VerifyBody = z.object({
  address: z.string().min(1),
  message: z.string().min(1),
  signature: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, deps: AppDeps): void {
  // POST /auth/nonce — pide un nonce para firmar
  app.post("/auth/nonce", async (req, reply) => {
    const parsed = NonceBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "address requerida" };
    }
    const { address } = parsed.data;
    const nonce = generateNonce();
    const message = `Inicia sesión en MYLoto.\nWallet: ${address}\nNonce: ${nonce}`;
    await createNonce(deps.db.db, address, nonce);
    return { nonce, message };
  });

  // POST /auth/verify — verifica la firma BIP-322 y emite JWT
  app.post("/auth/verify", async (req, reply) => {
    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "address, message y signature requeridos" };
    }
    const { address, message, signature } = parsed.data;

    // Extraer el nonce del mensaje para validarlo
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
    const nonce = nonceMatch?.[1];
    if (!nonce) {
      reply.code(400);
      return { error: "mensaje sin nonce válido" };
    }

    // Verificar que el nonce existe y no se ha usado
    const validNonce = await consumeNonce(deps.db.db, address, nonce);
    if (!validNonce) {
      reply.code(401);
      return { error: "nonce inválido o expirado" };
    }

    // Verificar la firma BIP-322
    let signatureValid = false;
    try {
      // bip322-js exporta verifySimple
      const { verifySimple } = await import("bip322-js");
      signatureValid = verifySimple(address, message, signature);
    } catch (err) {
      deps.logger.error("BIP-322 verification error", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    if (!signatureValid) {
      reply.code(401);
      return { error: "firma inválida" };
    }

    // Emitir JWT en cookie httpOnly
    const token = signJwt({ address }, deps.env.JWT_SECRET, deps.env.JWT_EXPIRES_IN);
    reply.setCookie("session", token, {
      httpOnly: true,
      secure: deps.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: deps.env.JWT_EXPIRES_IN,
    });
    return { ok: true, address };
  });

  // POST /auth/logout — limpia la cookie
  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });

  // GET /auth/me — devuelve la wallet si hay sesión
  app.get("/auth/me", async (req, reply) => {
    const address = requireAuth(req, deps.env.JWT_SECRET);
    if (!address) {
      reply.code(401);
      return { error: "no autenticado" };
    }
    return { address };
  });
}
```

- [ ] **Step 3: Registrar rutas en server.ts**

En `apps/backend/src/server.ts`, añadir imports al inicio:

```ts
import cookie from "@fastify/cookie";
import { registerAuthRoutes } from "./routes/auth.js";
```

Dentro de `main()`, después de `await app.register(cors, {...});`, añadir:

```ts
  // --- Cookies (para JWT de sesión) ---
  await app.register(cookie);
```

Y después de `registerSorteoRoutes(app, deps);`, añadir:

```ts
  registerAuthRoutes(app, deps);
```

- [ ] **Step 4: Verificar typecheck + build**

```bash
pnpm --filter @myloto/backend typecheck 2>&1 | tail -3
pnpm --filter @myloto/backend build 2>&1 | tail -3
```
Expected: limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/auth.ts apps/backend/src/services/wallet-sessions.ts apps/backend/src/server.ts
git commit -m "feat(backend): rutas auth BIP-322 (/auth/nonce, /verify, /logout, /me)"
```

---

## Task 4: Modificar POST /tickets para requerir auth + walletAddress

**Files:**
- Modify: `apps/backend/src/services/tickets.ts`
- Modify: `apps/backend/src/routes/tickets.ts`

- [ ] **Step 1: Añadir walletAddress a CreateTicketInput y createTicket**

En `apps/backend/src/services/tickets.ts`, añadir `walletAddress: string;` al interface `CreateTicketInput` (después de `userReturnAddress?: string;`):

```ts
export interface CreateTicketInput {
  sorteoId: number;
  paymentAddress: string;
  expectedAmount: number;
  n1: number; n2: number; n3: number; n4: number; n5: number;
  powerball: number;
  userReturnAddress?: string;
  walletAddress: string;
}
```

Y en la función `createTicket`, dentro de `.values({...})`, después de la línea del `...(input.userReturnAddress !== undefined ? ...)`, añadir:

```ts
      walletAddress: input.walletAddress,
```

- [ ] **Step 2: Requerir auth en POST /tickets**

En `apps/backend/src/routes/tickets.ts`, añadir imports al inicio:

```ts
import { requireAuth } from "../services/auth.js";
```

Y al inicio del handler `app.post("/tickets", ...)`, antes de `const parsed = ...`, añadir:

```ts
    const walletAddress = requireAuth(req, deps.env.JWT_SECRET);
    if (!walletAddress) {
      reply.code(401);
      return { error: "debes iniciar sesión con tu wallet para comprar" };
    }
```

Y en la llamada a `createTicket`, añadir `walletAddress` al input. Cambiar:

```ts
    const ticket = await createTicket(deps.db.db, {
      sorteoId: Number(sorteo.id),
      paymentAddress: "PLACEHOLDER",
      expectedAmount: price.amount,
      n1: body.n1, n2: body.n2, n3: body.n3, n4: body.n4, n5: body.n5,
      powerball: body.powerball,
      ...(body.returnAddress !== undefined ? { userReturnAddress: body.returnAddress } : {}),
    });
```

por:

```ts
    const ticket = await createTicket(deps.db.db, {
      sorteoId: Number(sorteo.id),
      paymentAddress: "PLACEHOLDER",
      expectedAmount: price.amount,
      n1: body.n1, n2: body.n2, n3: body.n3, n4: body.n4, n5: body.n5,
      powerball: body.powerball,
      walletAddress,
      ...(body.returnAddress !== undefined ? { userReturnAddress: body.returnAddress } : {}),
    });
```

- [ ] **Step 3: Actualizar tests existentes que llaman createTicket**

Buscar tests que usen `createTicket` y añadir `walletAddress: "bc1qtest"` al input. Ejecutar:

```bash
cd /Users/osmanmarin/Desktop/MYLoto
grep -rn "createTicket\|CreateTicketInput" apps/backend/test/ apps/backend/src/test/
```

En cada test que construya un `CreateTicketInput` o llame `createTicket`, añadir `walletAddress: "bc1qtest"`.

- [ ] **Step 4: Verificar typecheck + tests**

```bash
pnpm --filter @myloto/backend typecheck 2>&1 | tail -3
pnpm --filter @myloto/backend test -- --run 2>&1 | tail -8
```
Expected: typecheck limpio, todos los tests pasan (incluyendo los modificados).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/tickets.ts apps/backend/src/routes/tickets.ts apps/backend/test/ apps/backend/src/test/
git commit -m "feat(backend): POST /tickets requiere auth + guarda walletAddress del comprador"
```

---

## Task 5: Servicio + ruta del panel (/me/tickets)

**Files:**
- Create: `apps/backend/src/services/me.ts`
- Create: `apps/backend/src/routes/me.ts`
- Modify: `apps/backend/src/server.ts`

- [ ] **Step 1: Crear servicio me.ts**

Crear `apps/backend/src/services/me.ts`:

```ts
import { eq } from "drizzle-orm";
import { tickets, sorteos, ganadores, type Database } from "@myloto/db";

export interface MyTicket {
  id: number;
  sorteoId: number;
  sorteoEstado: string;
  status: string;
  n1: number; n2: number; n3: number; n4: number; n5: number;
  powerball: number;
  expectedAmount: string;
  // Solo para pasados:
  gano?: boolean;
  tier?: number;
  monto?: string;
  pagado?: boolean;
}

/**
 * Devuelve los tickets de una wallet, separados en vigentes y pasados.
 * Vigentes = sorteo ABIERTO. Pasados = sorteo FINALIZADO/CERRADO/CALCULADO.
 */
export async function getTicketsByWallet(
  db: Database,
  walletAddress: string,
): Promise<{ vigentes: MyTicket[]; pasados: MyTicket[] }> {
  // Traer tickets de esta wallet con join al sorteo
  const rows = await db
    .select({
      id: tickets.id,
      sorteoId: tickets.sorteoId,
      sorteoEstado: sorteos.estado,
      status: tickets.status,
      n1: tickets.n1, n2: tickets.n2, n3: tickets.n3, n4: tickets.n4, n5: tickets.n5,
      powerball: tickets.powerball,
      expectedAmount: tickets.expectedAmount,
    })
    .from(tickets)
    .innerJoin(sorteos, eq(tickets.sorteoId, sorteos.id))
    .where(eq(tickets.walletAddress, walletAddress));

  const vigentes: MyTicket[] = [];
  const pasados: MyTicket[] = [];

  for (const row of rows) {
    const ticket: MyTicket = {
      id: Number(row.id),
      sorteoId: Number(row.sorteoId),
      sorteoEstado: row.sorteoEstado,
      status: row.status,
      n1: row.n1, n2: row.n2, n3: row.n3, n4: row.n4, n5: row.n5,
      powerball: row.powerball,
      expectedAmount: row.expectedAmount,
    };

    if (row.sorteoEstado === "ABIERTO") {
      vigentes.push(ticket);
    } else {
      // Buscar si este ticket ganó en ese sorteo
      const ganadorRows = await db
        .select({ tier: ganadores.tier, monto: ganadores.monto, pagado: ganadores.pagado })
        .from(ganadores)
        .where(eq(ganadores.ticketId, row.id))
        .limit(1);
      if (ganadorRows.length > 0) {
        ticket.gano = true;
        ticket.tier = ganadorRows[0].tier;
        ticket.monto = ganadorRows[0].monto;
        ticket.pagado = ganadorRows[0].pagado;
      } else {
        ticket.gano = false;
      }
      pasados.push(ticket);
    }
  }

  return { vigentes, pasados };
}
```

- [ ] **Step 2: Crear ruta me.ts**

Crear `apps/backend/src/routes/me.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../dependencies.js";
import { requireAuth } from "../services/auth.js";
import { getTicketsByWallet } from "../services/me.js";

export function registerMeRoutes(app: FastifyInstance, deps: AppDeps): void {
  // GET /me/tickets — boletos del usuario autenticado
  app.get("/me/tickets", async (req, reply) => {
    const address = requireAuth(req, deps.env.JWT_SECRET);
    if (!address) {
      reply.code(401);
      return { error: "debes iniciar sesión" };
    }
    const result = await getTicketsByWallet(deps.db.db, address);
    return result;
  });
}
```

- [ ] **Step 3: Registrar ruta en server.ts**

En `apps/backend/src/server.ts`, añadir import:

```ts
import { registerMeRoutes } from "./routes/me.js";
```

Y después de `registerAuthRoutes(app, deps);`, añadir:

```ts
  registerMeRoutes(app, deps);
```

- [ ] **Step 4: Verificar typecheck + build**

```bash
pnpm --filter @myloto/backend typecheck 2>&1 | tail -3
pnpm --filter @myloto/backend build 2>&1 | tail -3
```
Expected: limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/me.ts apps/backend/src/routes/me.ts apps/backend/src/server.ts
git commit -m "feat(backend): GET /me/tickets — panel del usuario (vigentes/pasados + si ganó)"
```

---

## Task 6: Frontend — wallet connector + auth hooks + API

**Files:**
- Create: `apps/web/src/lib/wallet.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/hooks.ts`

- [ ] **Step 1: Crear wallet.ts**

Crear `apps/web/src/lib/wallet.ts`:

```ts
/**
 * Conector de wallet Bitcoin (UniSat / Xverse / OYL).
 * Usa los providers que las extensiones inyectan en window.
 */

declare global {
  interface Window {
    unisat?: {
      requestAccounts: () => Promise<string[]>;
      signMessage: (message: string) => Promise<string>;
    };
    bitcoin?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

/** Detecta si hay una wallet instalada. */
export function hasWallet(): boolean {
  return typeof window !== "undefined" && (!!window.unisat || !!window.bitcoin);
}

/**
 * Conecta la wallet y devuelve la address del usuario.
 * Prioriza UniSat, luego Xverse/OYL (window.bitcoin).
 */
export async function connectWallet(): Promise<string> {
  if (window.unisat) {
    const accounts = await window.unisat.requestAccounts();
    if (!accounts[0]) throw new Error("No se obtuvo dirección de UniSat");
    return accounts[0];
  }
  if (window.bitcoin) {
    const result = await window.bitcoin.request({
      method: "connect",
      params: [{ purposes: ["payment"] }],
    });
    const address = (result as { addresses?: { address: string }[] })?.addresses?.[0]?.address;
    if (!address) throw new Error("No se obtuvo dirección de la wallet");
    return address;
  }
  throw new Error("No se encontró wallet. Instala UniSat o Xverse.");
}

/**
 * Pide a la wallet firmar un mensaje (BIP-322).
 */
export async function signMessage(address: string, message: string): Promise<string> {
  if (window.unisat) {
    return window.unisat.signMessage(message);
  }
  if (window.bitcoin) {
    const result = await window.bitcoin.request({
      method: "signMessage",
      params: [{ address, message }],
    });
    const signature = (result as { signature?: string })?.signature;
    if (!signature) throw new Error("No se obtuvo firma");
    return signature;
  }
  throw new Error("No se encontró wallet para firmar.");
}
```

- [ ] **Step 2: Añadir funciones de auth API en api.ts**

En `apps/web/src/lib/api.ts`, al final del archivo, añadir:

```ts
// --- Auth (wallet login BIP-322) ---

export async function getNonce(address: string): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/nonce`, {
    method: "POST",
    body: JSON.stringify({ address }),
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function verifySignature(address: string, message: string, signature: string): Promise<boolean> {
  const res = await fetch(`${BACKEND_URL}/auth/verify`, {
    method: "POST",
    body: JSON.stringify({ address, message, signature }),
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  return res.ok;
}

export async function logout(): Promise<void> {
  await fetch(`${BACKEND_URL}/auth/logout`, { method: "POST", credentials: "include" });
}

export async function getSession(): Promise<string | null> {
  const res = await fetch(`${BACKEND_URL}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.address ?? null;
}

export interface MyTicket {
  id: number;
  sorteoId: number;
  sorteoEstado: string;
  status: string;
  n1: number; n2: number; n3: number; n4: number; n5: number;
  powerball: number;
  expectedAmount: string;
  gano?: boolean;
  tier?: number;
  monto?: string;
  pagado?: boolean;
}

export async function getMyTickets(): Promise<{ vigentes: MyTicket[]; pasados: MyTicket[] }> {
  const res = await fetch(`${BACKEND_URL}/me/tickets`, { credentials: "include" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Añadir hooks useSession y useMyTickets en hooks.ts**

En `apps/web/src/lib/hooks.ts`, al final, añadir:

```ts
export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: getSession });
}

export function useMyTickets() {
  return useQuery({ queryKey: ["my-tickets"], queryFn: getMyTickets });
}
```

Y añadir imports de las funciones nuevas al inicio de hooks.ts (después de los imports existentes de api):

```ts
import { getSorteoActivo, getJackpot, createTicket, getTicket, getSorteo, getGanadores, createSorteo, markGanadorPagado, type TicketInput, getSession, getMyTickets } from "./api";
```

- [ ] **Step 4: Verificar typecheck + build**

```bash
pnpm --filter @myloto/web typecheck 2>&1 | tail -3
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -3
```
Expected: limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/wallet.ts apps/web/src/lib/api.ts apps/web/src/lib/hooks.ts
git commit -m "feat(web): wallet connector (UniSat/Xverse) + auth API + hooks useSession/useMyTickets"
```

---

## Task 7: Frontend — página /mis-boletos + componentes

**Files:**
- Create: `apps/web/src/components/me/TicketCard.tsx`
- Create: `apps/web/src/app/mis-boletos/page.tsx`

- [ ] **Step 1: Crear TicketCard.tsx**

Crear `apps/web/src/components/me/TicketCard.tsx`:

```tsx
"use client";

import { NumberBall } from "@/components/ui/NumberBall";
import { Badge } from "@/components/ui/Badge";
import { TIER_DESC, formatMonto } from "@/lib/constants";
import type { MyTicket } from "@/lib/api";

export function TicketCard({ ticket }: { ticket: MyTicket }) {
  const isVigente = ticket.sorteoEstado === "ABIERTO";
  return (
    <div className={`bg-background-card/80 border rounded-2xl p-4 ${
      ticket.gano === true ? "border-neon-yellow/50 shadow-glow-yellow" :
      ticket.gano === false ? "border-muted/30 opacity-75" :
      "border-neon-pink/20"
    }`}>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm">
          <span className="text-neon-cyan font-bold">Sorteo #{ticket.sorteoId}</span>
          <span className="text-muted text-xs ml-2">· {ticket.sorteoEstado}</span>
        </div>
        {isVigente ? (
          ticket.status === "ACTIVO" ? <Badge variant="activo">ACTIVO</Badge> : <Badge variant="pendiente">PENDIENTE</Badge>
        ) : ticket.gano ? (
          <Badge variant="finalizado">🏆 GANÓ</Badge>
        ) : (
          <Badge variant="cerrado">No ganó</Badge>
        )}
      </div>

      <div className="flex gap-2 justify-center items-center">
        {[ticket.n1, ticket.n2, ticket.n3, ticket.n4, ticket.n5].map((n, i) => (
          <NumberBall key={i} value={n} variant="balota" size="sm" />
        ))}
        <div className="w-0.5 h-6 bg-border mx-1" />
        <NumberBall value={ticket.powerball} variant="powerball" size="sm" />
      </div>

      {ticket.gano && ticket.monto && (
        <div className="text-center mt-3 text-neon-yellow font-bold text-sm">
          {TIER_DESC[ticket.tier!] ?? `Tier ${ticket.tier}`} · {formatMonto(ticket.monto)} FB
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear página mis-boletos**

Crear `apps/web/src/app/mis-boletos/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, useMyTickets } from "@/lib/hooks";
import { Navbar } from "@/components/ui/Navbar";
import { Spinner } from "@/components/ui/Spinner";
import { TicketCard } from "@/components/me/TicketCard";

export default function MisBoletosPage() {
  const [tab, setTab] = useState<"vigentes" | "pasados">("vigentes");
  const { data: address, isLoading: sessionLoading } = useSession();
  const { data: tickets, isLoading } = useMyTickets();
  const router = useRouter();

  if (sessionLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner label="Cargando..." /></div>;
  }

  if (!address) {
    // Sin sesión → redirigir a home
    router.push("/");
    return null;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-2xl mx-auto px-4 py-8 content-layer">
        <h1 className="text-2xl font-black text-white text-center mb-2">
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">🎫 Mis Boletos</span>
        </h1>
        <p className="text-center text-xs text-neon-purple mb-6">{address.slice(0, 8)}...{address.slice(-4)}</p>

        {/* Pestañas */}
        <div className="flex gap-2 mb-6 border-b border-neon-pink/20">
          <button
            onClick={() => setTab("vigentes")}
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
              tab === "vigentes" ? "border-neon-pink text-neon-pink" : "border-transparent text-muted hover:text-muted-light"
            }`}
          >
            🟢 Vigentes ({tickets?.vigentes.length ?? 0})
          </button>
          <button
            onClick={() => setTab("pasados")}
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
              tab === "pasados" ? "border-neon-cyan text-neon-cyan" : "border-transparent text-muted hover:text-muted-light"
            }`}
          >
            🏆 Pasados ({tickets?.pasados.length ?? 0})
          </button>
        </div>

        {isLoading ? (
          <Spinner label="Cargando boletos..." />
        ) : tab === "vigentes" ? (
          tickets?.vigentes.length ? (
            <div className="space-y-3">
              {tickets.vigentes.map((t) => <TicketCard key={t.id} ticket={t} />)}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No tienes boletos vigentes</p>
          )
        ) : (
          tickets?.pasados.length ? (
            <div className="space-y-3">
              {tickets.pasados.map((t) => <TicketCard key={t.id} ticket={t} />)}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No tienes boletos pasados todavía</p>
          )
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verificar typecheck + build**

```bash
pnpm --filter @myloto/web typecheck 2>&1 | tail -3
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -5
```
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/me/TicketCard.tsx apps/web/src/app/mis-boletos/page.tsx
git commit -m "feat(web): página /mis-boletos con pestañas Vigentes/Pasados + TicketCard"
```

---

## Task 8: Frontend — integrar auth en wizard + navbar

**Files:**
- Modify: `apps/web/src/components/wizard/BuyWizard.tsx`
- Modify: `apps/web/src/components/ui/Navbar.tsx`
- Modify: `apps/web/src/lib/hooks.ts` (añadir useAuth)

- [ ] **Step 1: Añadir hook useAuth en hooks.ts**

En `apps/web/src/lib/hooks.ts`, añadir imports:

```ts
import { connectWallet, signMessage } from "./wallet";
import { getNonce, verifySignature } from "./api";
import { useQueryClient } from "@tanstack/react-query";
```

Y al final del archivo, añadir:

```ts
export function useAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const address = await connectWallet();
      const { nonce, message } = await getNonce(address);
      const signature = await signMessage(address, message);
      await verifySignature(address, message, signature);
      return address;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session"] });
    },
  });
}
```

- [ ] **Step 2: Añadir paso 0 "Conecta tu wallet" en BuyWizard**

En `apps/web/src/components/wizard/BuyWizard.tsx`, añadir imports:

```tsx
import { useSession, useAuth } from "@/lib/hooks";
import { hasWallet } from "@/lib/wallet";
```

Cambiar `type Step` para incluir "wallet":

```tsx
type Step = "wallet" | "seleccion" | "descuento" | "pago" | "confirmacion";
```

Dentro del componente, después de los hooks existentes, añadir:

```tsx
  const { data: sessionAddress } = useSession();
  const auth = useAuth();

  // Si hay sesión, saltar directamente a selección
  useEffect(() => {
    if (sessionAddress && step === "wallet") {
      setStep("seleccion");
    }
  }, [sessionAddress, step]);
```

Y cambiar el estado inicial del step: `const [step, setStep] = useState<Step>(sessionAddress ? "seleccion" : "wallet");` — pero como sessionAddress carga async, mejor mantener `"wallet"` como inicial y dejar que el useEffect avance.

Añadir la pantalla de wallet antes del paso selección, dentro del JSX del modal (después de la barra de progreso, antes del paso selección):

```tsx
        {/* Paso 0: Conectar wallet */}
        {step === "wallet" && (
          <div className="space-y-4 text-center py-4">
            <p className="text-4xl">🔗</p>
            <p className="text-neon-cyan font-bold text-lg">Conecta tu wallet</p>
            <p className="text-muted-light text-sm">
              Para comprar un boleto necesitas iniciar sesión con tu wallet Bitcoin.
              Firmarás un mensaje criptográfico (sin gas, sin transacción).
            </p>
            {auth.isError && (
              <p className="text-neon-red text-sm">
                {auth.error instanceof Error ? auth.error.message : "Error al conectar wallet"}
              </p>
            )}
            {auth.isPending ? (
              <p className="text-neon-purple text-sm animate-pulse">Conectando... revisa tu wallet</p>
            ) : (
              <Button variant="primary" onClick={() => auth.mutate()} disabled={!hasWallet()}>
                {hasWallet() ? "🔗 Conectar wallet" : "⚠️ Instala UniSat/Xverse"}
              </Button>
            )}
          </div>
        )}
```

Actualizar la barra de progreso para reflejar que wallet es el paso 0 (no cuenta como paso visible, o ajustar el array). La forma más simple: cambiar el array de pasos en la barra de progreso a `["wallet", "seleccion", "descuento", "pago", "confirmacion"]` para que tenga 5 segmentos.

- [ ] **Step 3: Modificar Navbar para mostrar wallet + link + salir**

En `apps/web/src/components/ui/Navbar.tsx`, reemplazar el componente completo:

```tsx
"use client";

import Link from "next/link";
import { useSession } from "@/lib/hooks";
import { logout } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/resultados", label: "Resultados" },
  { href: "/mis-boletos", label: "Mis Boletos" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const { data: address } = useSession();
  const qc = useQueryClient();

  const handleLogout = async () => {
    await logout();
    qc.invalidateQueries({ queryKey: ["session"] });
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-neon-pink/25 bg-background/80 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-extrabold text-white flex items-center gap-2">
          <span className="text-2xl drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">🎱</span>
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">MYLoto</span>
        </Link>
        <div className="flex gap-4 text-sm font-semibold items-center">
          {links.map((l) => (
            <Link key={l.href} href={l.href}
              className="text-muted-light hover:text-neon-pink hover:drop-shadow-[0_0_6px_rgba(236,72,153,0.8)] transition-all"
            >
              {l.label}
            </Link>
          ))}
          {address && (
            <>
              <span className="text-neon-green text-xs font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button onClick={handleLogout} className="text-muted hover:text-neon-red text-xs">
                Salir
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Verificar typecheck + build**

```bash
pnpm --filter @myloto/web typecheck 2>&1 | tail -3
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -5
```
Expected: limpio.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hooks.ts apps/web/src/components/wizard/BuyWizard.tsx apps/web/src/components/ui/Navbar.tsx
git commit -m "feat(web): auth integrado en wizard (paso 0 wallet) + navbar con sesión"
```

---

## Task 9: Verificación final local

**Files:** (sin cambios)

- [ ] **Step 1: Typecheck completo workspace**

```bash
cd /Users/osmanmarin/Desktop/MYLoto && pnpm -r typecheck 2>&1 | tail -10
```
Expected: limpio.

- [ ] **Step 2: Tests completos backend**

```bash
pnpm --filter @myloto/backend test -- --run 2>&1 | tail -8
```
Expected: todos pasan.

- [ ] **Step 3: Tests web**

```bash
pnpm --filter @myloto/web test -- --run 2>&1 | tail -6
```
Expected: pasan.

- [ ] **Step 4: Build web**

```bash
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -8
```
Expected: exitoso, página /mis-boletos compilada.

- [ ] **Step 5: Commit si ajustes**

```bash
git add -A && git commit -m "chore: ajustes finales tras verificación wallet login" || echo "nada que commitear"
```

---

## Task 10: Deploy — migración DB + build + variables .env + verificar

**Files:** (sin cambios locales; deploy en nodo-desktop)

- [ ] **Step 1: Merge a main + push**

```bash
cd /Users/osmanmarin/Desktop/MYLoto
git checkout main
git merge feat/wallet-login --no-ff -m "merge: wallet login BIP-322 + panel de usuario"
git push origin main
```

- [ ] **Step 2: Deploy en nodo-desktop — pull + rebuild + migración**

```bash
sshpass -p 'Nodo123' ssh -o ConnectTimeout=15 -o PreferredAuthentications=password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1 nodo@100.90.169.23 'bash -s' <<'REMOTE'
cd ~/MYLotto
git pull origin main
pnpm install --frozen-lockfile
pnpm -r build
# Añadir JWT_SECRET al .env si no existe
grep -q "JWT_SECRET" .env || echo -e "\n# --- Auth ---\nJWT_SECRET=$(openssl rand -hex 32)\nJWT_EXPIRES_IN=604800" >> .env
echo "JWT_SECRET en .env:"; grep JWT_SECRET .env | head -c 20
# Aplicar migración de DB
pnpm --filter @myloto/db drizzle:migrate
# Restart backend
echo "Nodo123" | sudo -S systemctl restart myloto-backend
sleep 3
systemctl is-active myloto-backend
REMOTE
```

- [ ] **Step 3: Deploy web**

```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'bash -s' <<'REMOTE'
cd ~/MYLotto
rm -rf apps/web/.next
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build
echo "Nodo123" | sudo -S systemctl restart myloto-web
sleep 3
systemctl is-active myloto-web
REMOTE
```

- [ ] **Step 4: Verificación de endpoints de auth**

```bash
# /auth/me sin sesión → 401
curl -sS -o /dev/null -w "auth/me sin sesión: HTTP %{http_code}\n" https://api-lotto.moonyetis.com/auth/me
# /tickets sin sesión → 401
curl -sS -X POST -o /dev/null -w "tickets sin sesión: HTTP %{http_code}\n" https://api-lotto.moonyetis.com/tickets
# /me/tickets sin sesión → 401
curl -sS -o /dev/null -w "me/tickets sin sesión: HTTP %{http_code}\n" https://api-lotto.moonyetis.com/me/tickets
# Home sigue pública
curl -sS -o /dev/null -w "Home: HTTP %{http_code}\n" https://lotto.moonyetis.com/
curl -sS -o /dev/null -w "Mis boletos: HTTP %{http_code}\n" https://lotto.moonyetis.com/mis-boletos
```
Expected: auth/me 401, tickets 401, me/tickets 401, Home 200, Mis boletos 200.

- [ ] **Step 5: Confirmar servicios activos**

```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'systemctl is-active myloto-backend myloto-web myloto-tunnel myloto-schedule myloto-lifecycle myloto-payment myloto-draw myloto-scrutiny'
```
Expected: `active` en los 8.
