# Diseño: Frontend Next.js — App de Jugador + Admin (Ciclo 8)

**Fecha:** 2026-06-22
**Ciclo:** 8 de 8 (final)
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)
**Depende de:** Ciclo 1-7 (backend API REST completo).

---

## 1. Contexto y Alcance

Tras 7 ciclos, el backend de MYLoto está completo: API REST con endpoints de tickets, sorteos, ganadores, jackpot, y admin; más 4 workers que gestionan el ciclo de vida del sorteo automáticamente. El Ciclo 8 construye el **frontend** — la interfaz web que usa el jugador para comprar boletos y consultar resultados, y el operador para gestionar sorteos.

### Objetivos de este ciclo

- Crear `apps/web` (Next.js App Router + React + TypeScript + Tailwind).
- Implementar el **dashboard** del jugador (jackpot, sorteo activo, mis tickets).
- Implementar el **wizard de compra** (4 pasos: selección → descuento → QR → confirmación).
- Implementar la página de **resultados** (combinación ganadora, ganadores, sello verificable).
- Implementar el **panel admin** (crear sorteo, pagar ganadores).
- Conectar el frontend al backend via API REST con react-query.

### No incluye este ciclo (explícito)

- **Auth/sistema de cuentas** — sin login. "Mis tickets" muestra tickets recientes sin filtrar por usuario. El sistema de cuentas es un ciclo futuro post-MVP.
- **Wallet browser integrada** — el pago es via QR + wallet externa (Sparrow, UniSat). No se integra una wallet en el browser.
- **WebSocket/tiempo real** — el frontend usa polling (react-query `refetchInterval`) para detectar cambios de estado. WebSocket es optimización futura.
- **i18n** — solo español por ahora.
- **Tests E2E (Playwright)** — YAGNI. Tests de componentes + API testeada son suficientes para el MVP.
- **Demo E2E con backend real** — pendiente IBD (~1-2 días más).

---

## 2. Decisiones Consolidadas

| Decisión | Elección | Justificación |
|---|---|---|
| Alcance | App completa: jugador + admin | Cubre todo el flujo del usuario final + operador |
| Layout | Híbrido: dashboard + wizard modal + admin separado | Dashboard como home, wizard enfoca la compra, admin aislado |
| Pago | QR + wallet externa (Sparrow, UniSat) | Simple, seguro (llaves privadas nunca en el browser) |
| Estilo visual | Cripto dark (oscuro + neón dorado/rojo) | dApp moderna; dorado = jackpot impactante; audiencia cripto-native |
| Stack | Next.js App Router + React + TypeScript + Tailwind | SSR/SSG, routing, Tailwind acelera el estilo dark |
| Estructura | Feature-based (carpetas por feature + ui/ primitivos) | Convención moderna, crece bien, fácil de localizar |
| Fetching | @tanstack/react-query | Cache, polling automático, revalidación. Estándar de facto |
| "Mis tickets" | Sin auth: muestra tickets recientes | Sin sistema de cuentas todavía; ciclo futuro |

### Rutas

| Ruta | Descripción |
|---|---|
| `/` | Dashboard (jackpot, sorteo activo, mis tickets) |
| `/resultados` | Sorteos finalizados + ganadores |
| `/admin` | Panel del operador (crear sorteo, pagar ganadores) |

El **wizard de compra** es un modal a pantalla completa sobre el dashboard, no una ruta.

---

## 3. Estructura

```
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout (fuente, tema dark, QueryClientProvider)
│   │   ├── page.tsx                 # Dashboard (home del jugador)
│   │   ├── resultados/page.tsx      # Resultados de sorteos
│   │   └── admin/page.tsx           # Panel admin
│   ├── components/
│   │   ├── dashboard/               # JackpotCard, TicketsList, SorteoActivoCard, ComprarButton
│   │   ├── wizard/                  # BuyWizard, NumberGrid, PowerballGrid, DescuentoStep, QrStep, ConfirmStep
│   │   ├── resultados/              # CombinacionGanadora, GanadoresList, VerificableBadge, SorteosHistorico
│   │   ├── admin/                   # CrearSorteoForm, GanadoresAdmin, PagarButton
│   │   └── ui/                      # Button, Card, Badge, Modal, Spinner, NumberBall
│   ├── lib/
│   │   ├── api.ts                   # Cliente fetch tipado al backend
│   │   ├── hooks.ts                 # Hooks react-query (useJackpot, useSorteoActivo, etc.)
│   │   └── constants.ts             # Colores, rangos (BALOTAS_MAX=69, POWERBALL_MAX=26)
│   └── styles/
│       └── globals.css              # Tailwind + tema cripto dark
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── tsconfig.json
```

### Principios

- **App Router** — cada ruta es una carpeta en `app/` con `page.tsx`. Next.js maneja SSR/SSG automáticamente.
- **Feature folders** — cada feature (dashboard, wizard, resultados, admin) tiene sus componentes en `components/<feature>/`.
- **`ui/` primitivos** — componentes base reutilizables (Button, Card, Badge, NumberBall) que no pertenecen a ninguna feature.
- **`lib/`** — lógica sin UI: cliente API, hooks, constantes.

---

## 4. Tema Visual Cripto Dark

### Paleta (`tailwind.config.ts`)

```typescript
colors: {
  background: {
    DEFAULT: "#0f0f1e",   // fondo principal
    card: "#1e293b",      // tarjetas
  },
  gold: {
    DEFAULT: "#f59e0b",   // balotas, jackpot
    glow: "rgba(245,158,11,0.4)",
  },
  red: {
    DEFAULT: "#ef4444",   // powerball
    glow: "rgba(239,68,68,0.4)",
  },
  green: "#10b981",        // éxito, ACTIVO
  muted: {
    DEFAULT: "#64748b",
    light: "#94a3b8",
  },
  border: "#334155",
}
```

### Elementos clave

- **Balotas**: círculos dorados (`bg-gold text-background font-bold rounded-full`), 36px en desktop.
- **Powerball**: círculo rojo (`bg-red text-white`), mismo tamaño.
- **Jackpot**: texto dorado grande (`text-gold text-4xl font-bold`), con glow sutil.
- **Estados**: Badge verde (ACTIVO), gris (PENDIENTE), azul (FINALIZADO), dorado (ABIERTO).
- **Glow effect**: `box-shadow: 0 0 12px var(--glow)` en números ganadores y jackpot.

---

## 5. Capa de Datos

### 5.1 `lib/api.ts` — Cliente fetch tipado

```typescript
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

export interface SorteoActivo {
  id: number;
  bloqueCierre: number;
  estado: string;
  creadoEn: string;
}

export interface TicketResponse {
  id: number;
  sorteoId: number;
  status: "PENDIENTE" | "ACTIVO";
  expectedAmount: number;
  hasDiscount: boolean;
  paymentAddress: string;
  bip21Uri: string;
  qrSvg: string;
}

export interface JackpotResponse { saldo: number; }

export interface GanadorResponse {
  id: number;
  ticketId: number;
  tier: number;
  monto: string;
  pagado: boolean;
}

export interface SorteoCompleto {
  id: number;
  bloqueCierre: number;
  estado: string;
  combinacionGanadora: { balotas: number[]; powerball: number } | null;
  bloquesSemilla: { n1: string; n2: string; n3: string } | null;
  creadoEn: string;
  cerradoEn: string | null;
  calculadoEn: string | null;
}

export interface TicketInput {
  n1: number; n2: number; n3: number; n4: number; n5: number;
  powerball: number;
  brc20Address?: string;
}

// Endpoints
export async function getSorteoActivo(): Promise<SorteoActivo | null>;
export async function getJackpot(): Promise<JackpotResponse>;
export async function createTicket(input: TicketInput): Promise<TicketResponse>;
export async function getTicket(id: number): Promise<TicketResponse | null>;
export async function getSorteo(id: number): Promise<SorteoCompleto | null>;
export async function getGanadores(sorteoId: number): Promise<GanadorResponse[]>;
export async function createSorteo(): Promise<SorteoActivo>;
export async function markGanadorPagado(id: number): Promise<void>;
```

### 5.2 `lib/hooks.ts` — Hooks react-query

```typescript
// Dashboard: refetch cada 30s
export function useJackpot(): UseQueryResult<JackpotResponse>;
export function useSorteoActivo(): UseQueryResult<SorteoActivo | null>;

// Wizard: crear + polling de estado
export function useCreateTicket(): UseMutationResult<TicketResponse, Error, TicketInput>;
export function useTicketStatus(id: number | null): UseQueryResult<TicketResponse | null>;
//   refetch cada 5s cuando status=PENDIENTE; se detiene cuando ACTIVO
//   Implementación: refetchInterval: (query) => query.state.data?.status === "PENDIENTE" ? 5000 : false

// Resultados
export function useSorteo(id: number): UseQueryResult<SorteoCompleto | null>;
export function useGanadores(sorteoId: number): UseQueryResult<GanadorResponse[]>;

// Admin
export function useCreateSorteo(): UseMutationResult<SorteoActivo>;
export function usePagarGanador(): UseMutationResult<void, Error, number>;
```

**Polling del ticket:** `useTicketStatus` usa `refetchInterval` condicional — hace refetch cada 5s mientras el ticket está PENDIENTE, y deja de hacer refetch automáticamente cuando pasa a ACTIVO. Esto detecta cuando el worker verificó el pago sin necesidad de WebSocket.

---

## 6. Componentes

### 6.1 Dashboard (`components/dashboard/`)

**`JackpotCard`** — tarjeta hero:
- Saldo del jackpot en dorado grande (`text-gold text-4xl`).
- Info del sorteo activo (número, bloque de cierre).
- Botón "🎱 Comprar boleto" (dorado, grande) que abre el wizard.

**`TicketsList`** — "Mis tickets":
- Lista de tickets recientes (sin filtrar por usuario — sin auth).
- Cada ticket: combinación en círculos (NumberBall) + Badge de estado.
- Click en ticket → detalle (GET /tickets/:id).

**`SorteoActivoCard`** — info compacta del sorteo abierto.

### 6.2 Wizard de compra (`components/wizard/`)

**`BuyWizard`** — modal a pantalla completa con estado de 4 pasos:

```
type WizardStep = "seleccion" | "descuento" | "pago" | "confirmacion";
```

**Paso 1 — Selección (`NumberGrid` + `PowerballGrid`):**
- `NumberGrid`: 69 círculos. Click para seleccionar/deseleccionar. Máximo 5. Los seleccionados se ponen dorados.
- `PowerballGrid`: 26 círculos. Click para seleccionar 1. Se pone rojo.
- Botón "🎲 Aleatorio": llena 5 balotas + 1 powerball al azar (Math.random).
- Validación: 5 balotas + 1 powerball → habilita "Siguiente".

**Paso 2 — Descuento (`DescuentoStep`):**
- Input de dirección Bitcoin (opcional).
- Si se ingresa, se envía como `brc20Address` en el POST /tickets.
- El backend verifica via UniSat (fail-closed: si UniSat falla, precio completo).
- Muestra precio: "100 FB" o "80 FB (20% off Hold-to-Earn)".

**Paso 3 — Pago (`QrStep`):**
- Llama `POST /tickets` con la combinación + brc20Address.
- Recibe `paymentAddress`, `bip21Uri`, `qrSvg`.
- Renderiza el `qrSvg` (ya viene del backend como SVG string).
- Botón "Copiar dirección".
- `useTicketStatus(ticket.id)` con polling cada 5s.
- Cuando `status === "ACTIVO"` → avanza al paso 4 automáticamente.
- Spinner con texto "⏳ Esperando pago...".

**Paso 4 — Confirmación (`ConfirmStep`):**
- "✅ ¡Ticket activo!" verde grande.
- Combinación en círculos dorados/rojo.
- "Ticket #N · Sorteo #M".
- Botón "Cerrar" → cierra el wizard.

### 6.3 Resultados (`components/resultados/`)

**`CombinacionGanadora`** — 6 NumberBalls con glow (box-shadow dorado/rojo).

**`GanadoresList`** — tabla: tier + descripción + monto + estado pago.

**`VerificableBadge`** — sello "🎲 Generado on-chain · verificable" con tooltip explicativo.

**`SorteosHistorico`** — lista de sorteos FINALIZADOS para navegar resultados.

### 6.4 Admin (`components/admin/`)

**`CrearSorteoForm`** — botón "Crear sorteo" → POST /admin/sorteos → muestra bloqueCierre calculado.

**`GanadoresAdmin`** — lista de ganadores con botón "Marcar pagado" (POST /admin/ganadores/:id/pagar).

Banner "⚠️ Panel de administración — sin auth" para diferenciar del área de jugador.

### 6.5 Primitivos UI (`components/ui/`)

- **`Button`** — variantes: primary (dorado), secondary (gris), danger (rojo), ghost (transparente).
- **`Card`** — `bg-background-card rounded-xl p-4 border border-border`.
- **`Badge`** — estados con colores (ACTIVO verde, PENDIENTE gris, etc.).
- **`Modal`** — overlay `bg-black/80` + contenedor centrado `bg-background`.
- **`Spinner`** — animación de carga.
- **`NumberBall`** — círculo reusable para números (props: value, variant: "balota"|"powerball"|"ganadora").

---

## 7. Configuración

### `next.config.ts`

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

### Variables de entorno

```bash
# apps/web/.env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

### `apps/web/package.json`

```json
{
  "name": "@myloto/web",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.50.0"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^25.0.0"
  }
}
```

> El frontend corre en puerto **3001** (el backend usa 3000) para evitar conflictos.

---

## 8. Testing

**Vitest + React Testing Library** para componentes:

- **`NumberGrid.test.tsx`** (3 tests): renderiza 69 círculos, selecciona/deselecciona al click, máximo 5.
- **`PowerballGrid.test.tsx`** (2 tests): renderiza 26 círculos, selecciona solo 1.
- **`BuyWizard.test.tsx`** (3 tests): empieza en paso selección, valida antes de avanzar, flujo completo mockeado.
- **`JackpotCard.test.tsx`** (2 tests): muestra saldo, muestra botón comprar.
- **`GanadoresList.test.tsx`** (2 tests): renderiza lista, muestra tier+monto.
- **`api.test.ts`** (3 tests): getJackpot parsea respuesta, createTicket envía body correcto, getSorteoActivo maneja null.

Total: ~15 tests.

---

## 9. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `pnpm install` sin errores | OK |
| 2 | `pnpm --filter @myloto/web typecheck` | Exit 0 |
| 3 | `pnpm --filter @myloto/web test` | Todos pasan (~15) |
| 4 | `pnpm --filter @myloto/web build` | Build Next.js exitoso |
| 5 | `pnpm -r test` | Todo verde |
| 6 | `pnpm dev` (frontend) arranca | Next.js dev server en :3001 |
| 7 | Dashboard muestra jackpot + sorteo activo | Visual |
| 8 | Wizard de 4 pasos funciona | Visual |
| 9 | Demo E2E con backend real | ⏳ Pendiente IBD |

---

## 10. Decisiones de Diseño Clave (resumen)

1. **Híbrido: dashboard + wizard modal** — el dashboard es el home con el jackpot visible; el wizard enfoca la compra paso a paso sin distracciones.

2. **Cripto dark** — dorado sobre oscuro maximiza el impacto del jackpot. Es el lenguaje visual que la audiencia cripto-native espera y confía.

3. **QR + wallet externa** — el usuario paga desde su wallet (Sparrow, UniSat). Las llaves privadas nunca están en el browser. El frontend hace polling del estado del ticket hasta que el worker lo activa.

4. **react-query con polling condicional** — `useTicketStatus` hace refetch cada 5s mientras PENDIENTE y se detiene al ACTIVO. Detección automática sin WebSocket.

5. **"Mis tickets" sin auth** — MVP sin sistema de cuentas. Los tickets se muestran sin filtrar. Auth/perfiles es ciclo futuro.

6. **Sin tests E2E** — YAGNI. Tests de componentes + API REST ya testeada son suficientes.

7. **`NumberBall` reusable** — un componente para todas las apariciones de números (balotas, powerball, ganadores) con variantes de color.

8. **Puerto 3001** — el frontend no compite con el backend (3000).

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Polling de ticket consume recursos si el usuario abandona | Media | Bajo | react-query cachea y el componente se desmonta al cerrar el wizard |
| Backend no responde (IBD) | Alta ahora | Medio | El frontend muestra estados de loading/error gracefully |
| "Mis tickets" muestra tickets de otros usuarios | Alta (sin auth) | Bajo (MVP) | Documentado; auth es ciclo futuro |
| Next.js 15 / React 19 incompatibilidades | Baja | Medio | Lock versions estables; typecheck protege |
| QR no se renderiza en algún browser | Baja | Medio | El SVG viene pre-generado del backend; solo se inyecta |

---

## 12. Roadmap Final

1. ✅ **Ciclo 1:** Fundación + Cliente RPC
2. ✅ **Ciclo 2:** Derivación HD + QR
3. ✅ **Ciclo 3:** BRC-20 / UniSat
4. ✅ **Ciclo 4:** Motor de pagos + compra de tickets
5. ✅ **Ciclo 5:** Motor de aleatoriedad on-chain
6. ✅ **Ciclo 6:** Escrutinio y reparto de premios
7. ✅ **Ciclo 7:** Backend completo — gestión de sorteos + orquestación
8. 🔄 **Ciclo 8:** Frontend Next.js (este spec)

Tras este ciclo, MYLoto es **funcional end-to-end** (cuando el nodo sincronice). Las demos E2E pendientes (Ciclos 4-7) se ejecutarán cuando el nodo termine IBD.
