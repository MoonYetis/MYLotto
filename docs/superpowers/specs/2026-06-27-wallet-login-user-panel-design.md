# Especificación: Wallet Login + Panel de Usuario

**Fecha:** 2026-06-27
**Proyecto:** MYLoto (lotería Powerball sobre Fractal Bitcoin)
**Scope:** Sistema de autenticación con wallet Bitcoin (BIP-322) + página "Mis Boletos" donde el usuario ve sus tickets vigentes/pasados y si ganó.

## 1. Contexto y problema

Actualmente los tickets no están vinculados a la wallet del comprador. La `paymentAddress` es una dirección HD derivada de la XPUB del operador (donde el usuario paga), no la wallet del comprador. No existe auth ni tabla users.

Para que un usuario vea "sus" boletos, necesitamos:
1. Que el usuario conecte su wallet antes de comprar (BIP-322 login)
2. Guardar la `walletAddress` del comprador en cada ticket
3. Una página protegida que muestre los tickets de esa wallet

## 2. Decisiones de diseño (aprobadas en brainstorming)

| Aspecto | Decisión |
|---------|----------|
| Vinculación ticket↔wallet | Wallet al comprar (se guarda walletAddress del comprador en el ticket) |
| Auth técnica | BIP-322 Sign-In with Bitcoin (mensaje firmado, verificado con `bip322-js`) |
| Cuándo pedir login | Al comprar, solo si no hay sesión activa |
| Layout panel | Pestañas Vigentes / Pasados |

## 3. Flujo de autenticación BIP-322

```
1. Usuario hace clic en "Comprar boleto" sin sesión
2. Frontend detecta "no hay sesión" → muestra paso "Conecta tu wallet"
3. Usuario conecta wallet (UniSat/Xverse) → obtiene walletAddress
4. Frontend: POST /auth/nonce { address } → backend genera nonce, devuelve { nonce, message }
5. Frontend pide a la wallet firmar: "Inicia sesión en MYLoto. Nonce: {nonce}"
6. Wallet firma (BIP-322) → devuelve signature
7. Frontend: POST /auth/verify { address, message, signature }
8. Backend verifica firma BIP-322 con bip322-js
   ✓ Válida → emite JWT (cookie httpOnly), responde { ok: true, address }
   ✗ Inválida → 401
9. Usuario queda logueado → continúa al wizard de compra
```

**JWT:** Token firmado con `JWT_SECRET` (env var). Contiene `{ address, exp }`. Duración: 7 días. Cookie httpOnly + Secure + SameSite=Lax.

## 4. Cambios en la base de datos

### Tabla nueva: `wallet_sessions`
```sql
wallet_sessions:
  id          bigserial PK
  address     text NOT NULL
  nonce       text NOT NULL
  creadoEn    timestamp NOT NULL DEFAULT now()
  -- Índice en (address) para lookup
```
Los nonces se borran al verificar (un solo uso) y expiran a los 5 min.

### Columna nueva en `tickets`
```sql
tickets:
  + walletAddress  text  -- wallet del comprador (NULLABLE: tickets viejos no la tienen)
  -- Índice en (walletAddress, sorteoId) para el query del panel
```
Nullable por retrocompatibilidad: los tickets existentes (sorteos #1-4) no tienen wallet porque se compraron anónimamente.

## 5. Dependencias nuevas

```bash
# Backend
pnpm --filter @myloto/backend add bip322-js jsonwebtoken
pnpm --filter @myloto/backend add -D @types/jsonwebtoken

# Web — no se añade nada: usamos window.unisat / window.bitcoin nativos de las extensiones
```

- `bip322-js` — verifica firmas BIP-322 (la librería correcta; `@scure/bip322` no existe)
- `jsonwebtoken` — firma/verifica JWT

## 6. Endpoints del backend

### Auth (nuevos en `routes/auth.ts`)
| Endpoint | Body | Respuesta |
|----------|------|-----------|
| `POST /auth/nonce` | `{ address }` | `{ nonce, message }` — guarda nonce en `wallet_sessions` |
| `POST /auth/verify` | `{ address, message, signature }` | Verifica BIP-322, emite JWT cookie → `{ ok: true, address }` o 401 |
| `POST /auth/logout` | (cookie) | Limpia cookie → `{ ok: true }` |
| `GET /auth/me` | (cookie) | `{ address }` si sesión válida, 401 si no |

### Panel (nuevo en `routes/me.ts`)
| Endpoint | Función |
|----------|---------|
| `GET /me/tickets` | Requiere sesión. Devuelve `{ vigentes: [...], pasados: [...] }` de la wallet. Cada ticket: id, sorteoId, combinación, status, sorteoEstado, y para pasados: ganó (bool), tier, monto |

### Modificación `POST /tickets` (compra)
- Ahora requiere sesión (cookie JWT). Sin sesión → 401.
- Lee `walletAddress` del JWT y la guarda en el ticket.

### Middleware `requireAuth`
Función helper que extrae el JWT de la cookie, lo verifica, devuelve la `address`. Usado por `/me/tickets` y `POST /tickets`. Lanza 401 si no hay cookie o es inválida.

## 7. Frontend

### `lib/wallet.ts` — conector de wallet
- `connectWallet()` → detecta `window.unisat` o `window.bitcoin`, pide permiso, devuelve address
- `signMessage(address, message)` → pide a la wallet firmar, devuelve signature
- Si no hay extensión → lanza error "Instala UniSat o Xverse"

### Hooks (`lib/hooks.ts`)
- `useWallet()` → estado de la wallet conectada (address, isConnecting)
- `useAuth()` → combina connect + nonce + sign + verify → sesión
- `useSession()` → `GET /auth/me` al cargar (¿hay sesión activa?)

### Página `/mis-boletos` (nueva)
- Protegida: si no hay sesión → redirige a home con prompt de login
- Pestañas **Vigentes** (tickets del sorteo ABIERTO) / **Pasados** (finalizados)
- Cada boleto: nº sorteo, combinación (NumberBall neon), estado (ACTIVO/PENDIENTE)
- Pasados: GANÓ (con tier+monto) / NO GANÓ + combinación ganadora del sorteo

### Wizard modificado (`BuyWizard.tsx`)
- Paso 0 nuevo: si `useSession()` es null → pantalla "Conecta tu wallet" con botón
- Si hay sesión → flujo normal
- La cookie JWT viaja automáticamente al backend en `POST /tickets`

### Navbar modificado
- Con sesión: wallet abreviada (`bc1q...x4z`) + link "🎫 Mis Boletos" + "Salir"
- Sin sesión: sin cambios (home pública)

## 8. Archivos a crear/modificar

### Crear (backend)
- `apps/backend/src/services/auth.ts` — generateNonce, verifyBip322, signJwt, verifyJwt, requireAuth
- `apps/backend/src/routes/auth.ts` — POST /auth/nonce, /verify, /logout, GET /auth/me
- `apps/backend/src/routes/me.ts` — GET /me/tickets
- `apps/backend/src/test/auth.test.ts` — tests de verificación BIP-322 y JWT (TDD)
- `packages/db/src/schema.ts` — tabla `wallet_sessions` + columna `walletAddress` en tickets
- Drizzle migration para los cambios de schema

### Crear (frontend)
- `apps/web/src/lib/wallet.ts` — conector de wallet
- `apps/web/src/app/mis-boletos/page.tsx` — página del panel
- `apps/web/src/components/me/TicketCard.tsx` — tarjeta de boleto en el panel
- `apps/web/src/components/me/WalletConnect.tsx` — botón/pantalla de conectar wallet

### Modificar
- `packages/config/src/env.ts` — añadir `JWT_SECRET` (required, fail-fast)
- `apps/backend/src/server.ts` — registrar rutas auth + me, registrar plugin de cookies (`@fastify/cookie`)
- `apps/backend/src/routes/tickets.ts` — require auth + guardar walletAddress
- `apps/backend/src/services/tickets.ts` — `createTicket` acepta walletAddress
- `apps/web/src/lib/hooks.ts` — useWallet, useAuth, useSession
- `apps/web/src/lib/api.ts` — funciones authApi + getMyTickets
- `apps/web/src/components/wizard/BuyWizard.tsx` — paso 0 conectar wallet
- `apps/web/src/components/ui/Navbar.tsx` — wallet + link panel + salir
- `apps/web/src/components/dashboard/ComprarButton.tsx` — verificar sesión antes de abrir wizard

## 9. Seguridad

- `JWT_SECRET` obligatorio en `.env` (fail-fast si falta, igual que XPUB)
- Cookie httpOnly (anti-XSS) + Secure (solo HTTPS en prod) + SameSite=Lax
- Nonce de un solo uso (se borra al verificar) + expira 5 min
- `walletAddress` se lee del JWT, nunca del body del request (anti-falsificación)
- Rate limiting en `/auth/nonce` y `/auth/verify` (anti-spam, con `@fastify/rate-limit`)

## 10. Consideraciones

- **Retrocompatibilidad:** tickets viejos sin `walletAddress` no aparecen en ningún panel (fueron anónimos). Es correcto y esperado.
- **Wallet providers:** `window.unisat` (UniSat) y `window.bitcoin` (Xverse/OYL). Detección automática. Si no hay ninguno → mensaje claro.
- **BIP-322 vs legacy:** `bip322-js` verifica BIP-322 (Taproot/P2TR). Para wallets que solo soportan legacy message signing, se documenta pero no se soporta en v1 (YAGNI).
- **Sin registro de email:** la "cuenta" es la wallet. Sin emails, sin passwords, sin KYC.

## 11. Criterios de aceptación

1. Un usuario puede conectar su wallet (UniSat/Xverse) y firmar un mensaje BIP-322 para iniciar sesión.
2. La sesión persiste vía cookie httpOnly (7 días).
3. Al comprar un boleto, la `walletAddress` del comprador se guarda en el ticket.
4. `GET /me/tickets` devuelve los tickets de la wallet, separados en vigentes/pasados.
5. Los boletos pasados muestran si el usuario ganó (tier + monto) o no.
6. La página `/mis-boletos` es inaccesible sin sesión (redirige a home).
7. El wizard muestra "Conecta tu wallet" si no hay sesión antes de dejar comprar.
8. Tests de verificación BIP-322 y JWT pasan.
