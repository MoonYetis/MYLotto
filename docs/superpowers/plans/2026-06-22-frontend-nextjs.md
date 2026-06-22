# Frontend Next.js — App de Jugador + Admin — Plan (Ciclo 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `apps/web` (Next.js App Router + React + Tailwind cripto dark) con dashboard de jackpot/tickets, wizard de compra de 4 pasos, resultados verificables, y panel admin.

**Architecture:** Feature-based (carpetas por feature + ui/ primitivos). Next.js App Router para routing. react-query para fetching/polling. Tailwind con tema cripto dark (dorado/rojo sobre oscuro). El frontend consume la API REST del backend via fetch.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS 3, @tanstack/react-query 5, Vitest + Testing Library.

**Spec de referencia:** `docs/superpowers/specs/2026-06-22-frontend-nextjs-design.md`

---

## File Structure

```
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout + QueryClientProvider
│   │   ├── page.tsx                 # Dashboard (home)
│   │   ├── resultados/page.tsx      # Resultados
│   │   └── admin/page.tsx           # Panel admin
│   ├── components/
│   │   ├── dashboard/               # JackpotCard, TicketsList, ComprarButton
│   │   ├── wizard/                  # BuyWizard, NumberGrid, PowerballGrid, DescuentoStep, QrStep, ConfirmStep
│   │   ├── resultados/              # CombinacionGanadora, GanadoresList, VerificableBadge
│   │   ├── admin/                   # CrearSorteoForm, GanadoresAdmin
│   │   └── ui/                      # Button, Card, Badge, Modal, Spinner, NumberBall
│   ├── lib/
│   │   ├── api.ts                   # Cliente fetch tipado
│   │   ├── hooks.ts                 # Hooks react-query
│   │   └── constants.ts             # Rangos de números, colores
│   └── styles/globals.css           # Tailwind + tema
├── __tests__/                        # Tests Vitest
│   ├── NumberGrid.test.tsx
│   ├── PowerballGrid.test.tsx
│   ├── BuyWizard.test.tsx
│   ├── JackpotCard.test.tsx
│   ├── GanadoresList.test.tsx
│   └── api.test.ts
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json                    # PROPIO (no extiende base — Next.js requiere Bundler)
├── vitest.config.ts
└── .env.local.example
```

> **Importante:** `apps/web/tsconfig.json` NO extiende `../../tsconfig.base.json`. El base usa `module: NodeNext` que es incompatible con Next.js App Router (requiere `module: preserve` / `moduleResolution: Bundler`). Next.js genera su propio tsconfig en `next dev`.

---

## Task 1: Esqueleto de apps/web (Next.js + Tailwind)

**Objetivo:** App Next.js arrancando con Tailwind y tema cripto dark.

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/constants.ts`
- Create: `apps/web/.env.local.example`

- [ ] **Step 1: Crear `apps/web/package.json`**

```json
{
  "name": "@myloto/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
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

- [ ] **Step 2: Crear `apps/web/tsconfig.json` (NO extiende base)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "preserve",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Crear `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Crear `apps/web/postcss.config.js`**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Crear `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0f0f1e",
          card: "#1e293b",
        },
        gold: {
          DEFAULT: "#f59e0b",
          glow: "rgba(245,158,11,0.4)",
        },
        red: {
          DEFAULT: "#ef4444",
          glow: "rgba(239,68,68,0.4)",
        },
        green: "#10b981",
        muted: {
          DEFAULT: "#64748b",
          light: "#94a3b8",
        },
        border: "#334155",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Crear `apps/web/src/styles/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f0f1e;
  color: #e2e8f0;
}
```

- [ ] **Step 7: Crear `apps/web/src/lib/constants.ts`**

```typescript
export const BALOTAS_MAX = 69;
export const POWERBALL_MAX = 26;
export const BALOTAS_TO_SELECT = 5;
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";
```

- [ ] **Step 8: Crear `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./../styles/globals.css";

export const metadata: Metadata = {
  title: "MYLoto — Lotería Powerball sobre Fractal Bitcoin",
  description: "Lotería cripto verificable on-chain. Hold-to-Earn con Moonyetis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Crear `apps/web/src/app/page.tsx` (placeholder)**

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-gold text-4xl font-bold">🎱 MYLoto</h1>
    </main>
  );
}
```

- [ ] **Step 10: Crear `apps/web/.env.local.example`**

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

- [ ] **Step 11: Instalar dependencias**

Run: `pnpm install`
Expected: sin errores.

- [ ] **Step 12: Verificar que Next.js arranca**

Run: `cd apps/web && npx next dev --port 3001` (Ctrl-C después de ver "Ready")
Expected: "Ready in Xms" sin errores.

- [ ] **Step 13: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "chore(web): esqueleto Next.js + Tailwind con tema cripto dark"
```

---

## Task 2: Cliente API + tipos

**Objetivo:** Cliente fetch tipado al backend.

**Files:**
- Create: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Crear `apps/web/src/lib/api.ts`**

```typescript
import { BACKEND_URL } from "./constants";

// --- Tipos de respuesta ---

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

export interface TicketDetalle {
  id: number;
  sorteoId: number;
  status: "PENDIENTE" | "ACTIVO";
  expectedAmount: string;
  paymentAddress: string;
  combinacion: {
    n1: number; n2: number; n3: number; n4: number; n5: number;
    powerball: number;
  };
  recibidoEn: string | null;
}

export interface JackpotResponse {
  saldo: number;
}

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

// --- Funciones fetch ---

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function getSorteoActivo(): Promise<SorteoActivo | null> {
  return apiFetch<SorteoActivo>("/sorteos/abierto").catch(() => null);
}

export function getJackpot(): Promise<JackpotResponse> {
  return apiFetch<JackpotResponse>("/jackpot");
}

export function createTicket(input: TicketInput): Promise<TicketResponse> {
  return apiFetch<TicketResponse>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getTicket(id: number): Promise<TicketDetalle | null> {
  return apiFetch<TicketDetalle>(`/tickets/${id}`).catch(() => null);
}

export function getSorteo(id: number): Promise<SorteoCompleto | null> {
  return apiFetch<SorteoCompleto>(`/sorteos/${id}`).catch(() => null);
}

export function getGanadores(sorteoId: number): Promise<GanadorResponse[]> {
  return apiFetch<GanadorResponse[]>(`/sorteos/${sorteoId}/ganadores`);
}

export function createSorteo(): Promise<SorteoActivo> {
  return apiFetch<SorteoActivo>("/admin/sorteos", { method: "POST" });
}

export function markGanadorPagado(id: number): Promise<{ id: number; pagado: boolean }> {
  return apiFetch(`/admin/ganadores/${id}/pagar`, { method: "POST" });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): cliente API tipado al backend"
```

---

## Task 3: Hooks de react-query + QueryClientProvider

**Objetivo:** Hooks para fetching con polling condicional.

**Files:**
- Create: `apps/web/src/lib/hooks.ts`
- Modify: `apps/web/src/app/layout.tsx` (añadir QueryClientProvider)
- Create: `apps/web/src/components/QueryProvider.tsx` (client component wrapper)

- [ ] **Step 1: Crear `apps/web/src/components/QueryProvider.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Crear `apps/web/src/lib/hooks.ts`**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSorteoActivo,
  getJackpot,
  createTicket,
  getTicket,
  getSorteo,
  getGanadores,
  createSorteo,
  markGanadorPagado,
  type TicketInput,
} from "./api";

// Dashboard: refetch cada 30s
export function useJackpot() {
  return useQuery({ queryKey: ["jackpot"], queryFn: getJackpot, refetchInterval: 30_000 });
}

export function useSorteoActivo() {
  return useQuery({ queryKey: ["sorteo-activo"], queryFn: getSorteoActivo, refetchInterval: 30_000 });
}

// Wizard: crear ticket
export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketInput) => createTicket(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

// Wizard: polling de estado (5s mientras PENDIENTE, se detiene al ACTIVO)
export function useTicketStatus(id: number | null) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: () => (id ? getTicket(id) : null),
    enabled: id !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "PENDIENTE" ? 5_000 : false,
  });
}

// Resultados
export function useSorteo(id: number) {
  return useQuery({ queryKey: ["sorteo", id], queryFn: () => getSorteo(id) });
}

export function useGanadores(sorteoId: number) {
  return useQuery({ queryKey: ["ganadores", sorteoId], queryFn: () => getGanadores(sorteoId) });
}

// Admin
export function useCreateSorteo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSorteo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sorteo-activo"] }),
  });
}

export function usePagarGanador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markGanadorPagado(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ganadores"] }),
  });
}
```

- [ ] **Step 3: Actualizar `apps/web/src/app/layout.tsx` con QueryProvider**

```tsx
import type { Metadata } from "next";
import { QueryProvider } from "@/components/QueryProvider";
import "./../styles/globals.css";

export const metadata: Metadata = {
  title: "MYLoto — Lotería Powerball sobre Fractal Bitcoin",
  description: "Lotería cripto verificable on-chain. Hold-to-Earn con Moonyetis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): hooks react-query + QueryProvider con polling condicional"
```

---

## Task 4: Componentes UI primitivos

**Objetivo:** Button, Card, Badge, Modal, Spinner, NumberBall.

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/Card.tsx`
- Create: `apps/web/src/components/ui/Badge.tsx`
- Create: `apps/web/src/components/ui/Modal.tsx`
- Create: `apps/web/src/components/ui/Spinner.tsx`
- Create: `apps/web/src/components/ui/NumberBall.tsx`

- [ ] **Step 1: Crear los 6 componentes primitivos en una sola tanda**

`apps/web/src/components/ui/Button.tsx`:

```tsx
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: "bg-gold text-background hover:brightness-110 font-bold",
  secondary: "bg-background-card text-muted-light hover:bg-border",
  danger: "bg-red text-white hover:brightness-110 font-bold",
  ghost: "bg-transparent text-muted-light hover:text-gold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = "Button";
```

`apps/web/src/components/ui/Card.tsx`:

```tsx
import { type HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-background-card rounded-xl border border-border p-4 ${className}`}
      {...props}
    />
  );
}
```

`apps/web/src/components/ui/Badge.tsx`:

```tsx
type BadgeVariant = "activo" | "pendiente" | "finalizado" | "abierto" | "cerrado";

const styles: Record<BadgeVariant, string> = {
  activo: "bg-green/20 text-green",
  pendiente: "bg-muted/20 text-muted-light",
  finalizado: "bg-blue-500/20 text-blue-400",
  abierto: "bg-gold/20 text-gold",
  cerrado: "bg-muted/20 text-muted-light",
};

export function Badge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}
```

`apps/web/src/components/ui/Modal.tsx`:

```tsx
"use client";

import { type ReactNode, useEffect } from "react";

export function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
```

`apps/web/src/components/ui/Spinner.tsx`:

```tsx
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-light">
      <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
```

`apps/web/src/components/ui/NumberBall.tsx`:

```tsx
type BallVariant = "balota" | "powerball" | "ganadora-b" | "ganadora-pb" | "muted";

const styles: Record<BallVariant, string> = {
  "balota": "bg-gold text-background",
  "powerball": "bg-red text-white",
  "ganadora-b": "bg-gold text-background shadow-[0_0_12px_rgba(245,158,11,0.4)]",
  "ganadora-pb": "bg-red text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]",
  "muted": "bg-border text-muted",
};

export function NumberBall({
  value,
  variant = "balota",
  size = "md",
}: {
  value: number;
  variant?: BallVariant;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };
  return (
    <div
      className={`${sizes[size]} ${styles[variant]} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
    >
      {value}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): componentes UI primitivos (Button, Card, Badge, Modal, Spinner, NumberBall)"
```

---

## Task 5: Dashboard (JackpotCard + TicketsList + ComprarButton)

**Objetivo:** Página principal con jackpot, sorteo activo, y botón de compra.

**Files:**
- Create: `apps/web/src/components/dashboard/JackpotCard.tsx`
- Create: `apps/web/src/components/dashboard/ComprarButton.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Crear `JackpotCard.tsx`**

```tsx
"use client";

import { useJackpot, useSorteoActivo } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

export function JackpotCard() {
  const { data: jackpot, isLoading: jpLoading } = useJackpot();
  const { data: sorteo, isLoading: saLoading } = useSorteoActivo();

  if (jpLoading || saLoading) {
    return (
      <Card className="text-center py-8">
        <Spinner label="Cargando..." />
      </Card>
    );
  }

  return (
    <Card className="text-center py-8 bg-gradient-to-br from-background-card to-background">
      <p className="text-muted text-xs uppercase tracking-widest">Jackpot acumulado</p>
      <p className="text-gold text-4xl font-bold my-2">
        {jackpot ? `${jackpot.saldo.toLocaleString()} FB` : "0 FB"}
      </p>
      {sorteo ? (
        <p className="text-muted-light text-sm">
          Sorteo #{sorteo.id} · Cierra en bloque {sorteo.bloqueCierre}
        </p>
      ) : (
        <p className="text-muted text-sm">No hay sorteo activo</p>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Crear `ComprarButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { BuyWizard } from "@/components/wizard/BuyWizard";

export function ComprarButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        className="text-lg px-8 py-3 mt-4"
        onClick={() => setOpen(true)}
      >
        🎱 Comprar boleto
      </Button>
      {open && <BuyWizard onClose={() => setOpen(false)} />}
    </>
  );
}
```

> Nota: `BuyWizard` se crea en Task 6. Este componente referenciará un módulo que aún no existe — el typecheck fallará hasta Task 6. Es aceptable porque seguimos un orden de dependencias.

- [ ] **Step 3: Actualizar `apps/web/src/app/page.tsx`**

```tsx
import { JackpotCard } from "@/components/dashboard/JackpotCard";
import { ComprarButton } from "@/components/dashboard/ComprarButton";

export default function HomePage() {
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-gold text-3xl font-bold text-center mb-6">🎱 MYLoto</h1>
      <JackpotCard />
      <div className="text-center mt-4">
        <ComprarButton />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): dashboard con JackpotCard + ComprarButton"
```

---

## Task 6: Wizard de compra (BuyWizard + NumberGrid + PowerballGrid + pasos)

**Objetivo:** Wizard modal de 4 pasos completo.

**Files:**
- Create: `apps/web/src/components/wizard/NumberGrid.tsx`
- Create: `apps/web/src/components/wizard/PowerballGrid.tsx`
- Create: `apps/web/src/components/wizard/BuyWizard.tsx`

- [ ] **Step 1: Crear `NumberGrid.tsx`**

```tsx
"use client";

import { BALOTAS_MAX, BALOTAS_TO_SELECT } from "@/lib/constants";

export function NumberGrid({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (n: number) => void;
}) {
  const numbers = Array.from({ length: BALOTAS_MAX }, (_, i) => i + 1);
  const full = selected.length >= BALOTAS_TO_SELECT;

  return (
    <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
      {numbers.map((n) => {
        const isSelected = selected.includes(n);
        const disabled = !isSelected && full;
        return (
          <button
            key={n}
            disabled={disabled}
            onClick={() => onToggle(n)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center
              ${isSelected
                ? "bg-gold text-background"
                : "bg-background-card text-muted-light hover:bg-border"}
              ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Crear `PowerballGrid.tsx`**

```tsx
"use client";

import { POWERBALL_MAX } from "@/lib/constants";

export function PowerballGrid({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  const numbers = Array.from({ length: POWERBALL_MAX }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
      {numbers.map((n) => {
        const isSelected = selected === n;
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center
              ${isSelected
                ? "bg-red text-white"
                : "bg-background-card text-muted-light hover:bg-border"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Crear `BuyWizard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { NumberBall } from "@/components/ui/NumberBall";
import { NumberGrid } from "./NumberGrid";
import { PowerballGrid } from "./PowerballGrid";
import { useCreateTicket, useTicketStatus } from "@/lib/hooks";
import { BALOTAS_TO_SELECT } from "@/lib/constants";
import type { TicketResponse } from "@/lib/api";

type Step = "seleccion" | "descuento" | "pago" | "confirmacion";

export function BuyWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("seleccion");
  const [balotas, setBalotas] = useState<number[]>([]);
  const [powerball, setPowerball] = useState<number | null>(null);
  const [brc20Address, setBrc20Address] = useState("");
  const [ticket, setTicket] = useState<TicketResponse | null>(null);

  const createTicket = useCreateTicket();
  const ticketStatus = useTicketStatus(ticket?.id ?? null);

  // Avanzar a confirmación cuando el ticket se activa
  if (ticketStatus.data?.status === "ACTIVO" && step === "pago") {
    setStep("confirmacion");
  }

  const toggleBalota = (n: number) => {
    setBalotas((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b),
    );
  };

  const handleCrear = async () => {
    if (!powerball || balotas.length !== BALOTAS_TO_SELECT) return;
    const result = await createTicket.mutateAsync({
      n1: balotas[0]!, n2: balotas[1]!, n3: balotas[2]!, n4: balotas[3]!, n5: balotas[4]!,
      powerball,
      ...(brc20Address ? { brc20Address } : {}),
    });
    setTicket(result);
    setStep("pago");
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-gold text-xl font-bold">
            {step === "seleccion" && "Paso 1: Elige tus números"}
            {step === "descuento" && "Paso 2: Descuento Hold-to-Earn"}
            {step === "pago" && "Paso 3: Paga con QR"}
            {step === "confirmacion" && "✅ ¡Ticket activo!"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-gold text-xl">✕</button>
        </div>

        {/* Paso 1: Selección */}
        {step === "seleccion" && (
          <div className="space-y-4">
            <div>
              <p className="text-muted-light text-sm mb-2">Balotas (elige 5 del 1 al 69)</p>
              <NumberGrid selected={balotas} onToggle={toggleBalota} />
            </div>
            <div>
              <p className="text-muted-light text-sm mb-2">Powerball (elige 1 del 1 al 26)</p>
              <PowerballGrid selected={powerball} onSelect={setPowerball} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const random = new Set<number>();
                  while (random.size < 5) random.add(Math.floor(Math.random() * 69) + 1);
                  setBalotas([...random].sort((a, b) => a - b));
                  setPowerball(Math.floor(Math.random() * 26) + 1);
                }}
              >
                🎲 Aleatorio
              </Button>
              <Button
                variant="primary"
                disabled={balotas.length !== 5 || powerball === null}
                onClick={() => setStep("descuento")}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        )}

        {/* Paso 2: Descuento */}
        {step === "descuento" && (
          <div className="space-y-4 text-center">
            <p className="text-4xl">🪙</p>
            <p className="text-gold font-bold">¿Tienes tokens Moonyetis?</p>
            <p className="text-muted-light text-sm">
              Ingresa tu dirección Bitcoin para verificar tu balance BRC-20 y obtener 20% de descuento.
            </p>
            <input
              type="text"
              value={brc20Address}
              onChange={(e) => setBrc20Address(e.target.value)}
              placeholder="bc1q... (opcional)"
              className="w-full bg-background-card border border-border rounded-lg px-4 py-2 text-muted-light placeholder:text-muted text-center font-mono text-sm"
            />
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => setStep("seleccion")}>← Atrás</Button>
              <Button variant="primary" onClick={handleCrear} disabled={createTicket.isPending}>
                {createTicket.isPending ? "Creando..." : "Continuar →"}
              </Button>
            </div>
          </div>
        )}

        {/* Paso 3: Pago QR */}
        {step === "pago" && ticket && (
          <div className="space-y-4 text-center">
            <p className="text-gold font-bold text-lg">Paga {ticket.expectedAmount} FB</p>
            <div className="bg-white rounded-xl p-4 inline-block" dangerouslySetInnerHTML={{ __html: ticket.qrSvg }} />
            <p className="text-muted-light text-sm">Escanea con Sparrow / UniSat o copia:</p>
            <div className="flex gap-2 justify-center">
              <code className="bg-background-card px-3 py-1 rounded text-xs text-muted-light font-mono break-all max-w-xs">
                {ticket.paymentAddress}
              </code>
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(ticket.paymentAddress)}
              >
                Copiar
              </Button>
            </div>
            <Spinner label="⏳ Esperando pago..." />
          </div>
        )}

        {/* Paso 4: Confirmación */}
        {step === "confirmacion" && ticket && (
          <div className="space-y-4 text-center">
            <p className="text-green text-2xl font-bold">¡Ticket activo!</p>
            <div className="bg-background-card rounded-xl p-4 inline-block">
              <p className="text-muted text-xs mb-2">Tu combinación</p>
              <div className="flex gap-2 justify-center">
                {balotas.map((b) => (
                  <NumberBall key={b} value={b} variant="balota" />
                ))}
                {powerball && <NumberBall value={powerball} variant="powerball" />}
              </div>
            </div>
            <p className="text-muted-light text-sm">Ticket #{ticket.id} · Sorteo #{ticket.sorteoId}</p>
            <Button variant="primary" onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard
git commit -m "feat(web): wizard de compra 4 pasos (selección, descuento, QR, confirmación)"
```

---

## Task 7: Página de Resultados

**Objetivo:** Mostrar combinación ganadora + ganadores de sorteos finalizados.

**Files:**
- Create: `apps/web/src/components/resultados/CombinacionGanadora.tsx`
- Create: `apps/web/src/components/resultados/GanadoresList.tsx`
- Create: `apps/web/src/components/resultados/VerificableBadge.tsx`
- Create: `apps/web/src/app/resultados/page.tsx`

- [ ] **Step 1: Crear `CombinacionGanadora.tsx`**

```tsx
import { NumberBall } from "@/components/ui/NumberBall";
import type { SorteoCompleto } from "@/lib/api";

export function CombinacionGanadora({ sorteo }: { sorteo: SorteoCompleto }) {
  if (!sorteo.combinacionGanadora) return null;
  const { balotas, powerball } = sorteo.combinacionGanadora;
  return (
    <div className="flex gap-2 justify-center">
      {balotas.map((b) => (
        <NumberBall key={b} value={b} variant="ganadora-b" size="lg" />
      ))}
      <NumberBall value={powerball} variant="ganadora-pb" size="lg" />
    </div>
  );
}
```

- [ ] **Step 2: Crear `GanadoresList.tsx`**

```tsx
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { GanadorResponse } from "@/lib/api";

const TIER_DESC: Record<number, string> = {
  1: "5 + PB (Jackpot)", 2: "5 balotas", 3: "4 + PB", 4: "4 balotas",
  5: "3 + PB", 6: "3 balotas", 7: "2 + PB", 8: "1 + PB", 9: "0 + PB",
};

export function GanadoresList({ ganadores }: { ganadores: GanadorResponse[] }) {
  if (ganadores.length === 0) {
    return <p className="text-muted text-center py-4">Sin ganadores registrados</p>;
  }
  return (
    <Card>
      <p className="text-muted-light text-sm mb-3">Ganadores ({ganadores.length})</p>
      <div className="space-y-2">
        {ganadores.map((g) => (
          <div key={g.id} className="flex justify-between items-center">
            <div>
              <span className="text-gold font-semibold text-sm">{TIER_DESC[g.tier] ?? `Tier ${g.tier}`}</span>
              <span className="text-muted text-xs ml-2">#{g.ticketId}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gold font-bold text-sm">{g.monto} FB</span>
              {g.pagado ? <Badge variant="finalizado">Pagado</Badge> : <Badge variant="pendiente">Pendiente</Badge>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Crear `VerificableBadge.tsx`**

```tsx
export function VerificableBadge() {
  return (
    <div className="text-center text-muted text-xs">
      🎲 Generado on-chain ·{" "}
      <span className="text-blue-400">verificable</span>
    </div>
  );
}
```

- [ ] **Step 4: Crear `apps/web/src/app/resultados/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useSorteo, useGanadores } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { CombinacionGanadora } from "@/components/resultados/CombinacionGanadora";
import { GanadoresList } from "@/components/resultados/GanadoresList";
import { VerificableBadge } from "@/components/resultados/VerificableBadge";

export default function ResultadosPage() {
  const [sorteoId, setSorteoId] = useState(1);
  const { data: sorteo, isLoading } = useSorteo(sorteoId);
  const { data: ganadores } = useGanadores(sorteoId);

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-gold text-2xl font-bold text-center mb-6">🏆 Resultados</h1>

      <div className="flex gap-2 justify-center mb-6">
        <input
          type="number"
          value={sorteoId}
          onChange={(e) => setSorteoId(Number(e.target.value))}
          className="w-20 bg-background-card border border-border rounded-lg px-3 py-2 text-center text-muted-light"
          min={1}
        />
        <span className="text-muted-light self-center">Sorteo #</span>
      </div>

      {isLoading ? (
        <Spinner label="Cargando..." />
      ) : sorteo ? (
        <div className="space-y-4">
          <Card className="text-center py-6">
            <p className="text-muted text-xs uppercase tracking-widest mb-1">
              Sorteo #{sorteo.id} · {sorteo.estado}
            </p>
            <div className="my-4">
              <CombinacionGanadora sorteo={sorteo} />
            </div>
            <VerificableBadge />
          </Card>
          {ganadores && <GanadoresList ganadores={ganadores} />}
        </div>
      ) : (
        <Card className="text-center py-8">
          <p className="text-muted">Sorteo no encontrado</p>
        </Card>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): página de resultados (combinación ganadora, ganadores, verificable)"
```

---

## Task 8: Panel Admin

**Objetivo:** Crear sorteos + pagar ganadores.

**Files:**
- Create: `apps/web/src/components/admin/CrearSorteoForm.tsx`
- Create: `apps/web/src/components/admin/GanadoresAdmin.tsx`
- Create: `apps/web/src/app/admin/page.tsx`

- [ ] **Step 1: Crear `CrearSorteoForm.tsx`**

```tsx
"use client";

import { useCreateSorteo } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function CrearSorteoForm() {
  const createSorteo = useCreateSorteo();

  return (
    <Card>
      <p className="text-muted-light text-sm mb-3">Crear nuevo sorteo</p>
      <Button
        variant="primary"
        onClick={() => createSorteo.mutate()}
        disabled={createSorteo.isPending}
      >
        {createSorteo.isPending ? "Creando..." : "🎱 Crear sorteo"}
      </Button>
      {createSorteo.data && (
        <p className="text-green text-sm mt-2">
          ✓ Sorteo #{createSorteo.data.id} creado · Cierra en bloque {createSorteo.data.bloqueCierre}
        </p>
      )}
      {createSorteo.isError && (
        <p className="text-red text-sm mt-2">Error: {createSorteo.error.message}</p>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Crear `GanadoresAdmin.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useGanadores, usePagarGanador } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const TIER_DESC: Record<number, string> = {
  1: "Jackpot", 2: "5 balotas", 3: "4+PB", 4: "4 balotas",
  5: "3+PB", 6: "3 balotas", 7: "2+PB", 8: "1+PB", 9: "PB",
};

export function GanadoresAdmin() {
  const [sorteoId, setSorteoId] = useState(1);
  const { data: ganadores } = useGanadores(sorteoId);
  const pagar = usePagarGanador();

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-muted-light text-sm">Ganadores del sorteo #</p>
        <input
          type="number"
          value={sorteoId}
          onChange={(e) => setSorteoId(Number(e.target.value))}
          className="w-16 bg-background border border-border rounded px-2 py-1 text-center text-sm text-muted-light"
          min={1}
        />
      </div>
      {ganadores && ganadores.length > 0 ? (
        <div className="space-y-2">
          {ganadores.map((g) => (
            <div key={g.id} className="flex justify-between items-center bg-background rounded-lg p-2">
              <div className="text-sm">
                <span className="text-gold font-semibold">{TIER_DESC[g.tier] ?? `Tier ${g.tier}`}</span>
                <span className="text-muted ml-2">#{g.ticketId}</span>
                <span className="text-gold ml-2">{g.monto} FB</span>
              </div>
              {g.pagado ? (
                <Badge variant="finalizado">Pagado</Badge>
              ) : (
                <Button
                  variant="secondary"
                  className="text-xs px-3 py-1"
                  onClick={() => pagar.mutate(g.id)}
                  disabled={pagar.isPending}
                >
                  Marcar pagado
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm text-center py-4">Sin ganadores</p>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Crear `apps/web/src/app/admin/page.tsx`**

```tsx
import { CrearSorteoForm } from "@/components/admin/CrearSorteoForm";
import { GanadoresAdmin } from "@/components/admin/GanadoresAdmin";
import { Card } from "@/components/ui/Card";

export default function AdminPage() {
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-gold text-2xl font-bold text-center mb-2">⚙️ Panel Admin</h1>
      <Card className="mb-6 border-gold/30 bg-gold/5">
        <p className="text-gold text-sm text-center">
          ⚠️ Panel de administración — sin auth. Opera con cuidado.
        </p>
      </Card>
      <div className="space-y-4">
        <CrearSorteoForm />
        <GanadoresAdmin />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): panel admin (crear sorteo + pagar ganadores)"
```

---

## Task 9: Navbar + navegación entre páginas

**Objetivo:** Navegación simple entre dashboard, resultados y admin.

**Files:**
- Create: `apps/web/src/components/ui/Navbar.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Crear `Navbar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/resultados", label: "Resultados" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4 justify-center py-4 border-b border-border mb-6">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`text-sm font-semibold transition-colors ${
            pathname === l.href ? "text-gold" : "text-muted-light hover:text-gold"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Añadir Navbar al layout**

En `apps/web/src/app/layout.tsx`, dentro de `<body>`, antes de `{children}`:

```tsx
        <QueryProvider>
          <Navbar />
          {children}
        </QueryProvider>
```

Y añadir el import:

```tsx
import { Navbar } from "@/components/ui/Navbar";
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): navbar con navegación (Inicio, Resultados, Admin)"
```

---

## Task 10: Configuración Vitest + tests básicos

**Objetivo:** Tests de componentes clave.

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/__tests__/NumberGrid.test.tsx`
- Create: `apps/web/__tests__/PowerballGrid.test.tsx`
- Create: `apps/web/__tests__/JackpotCard.test.tsx`
- Create: `apps/web/vitest.setup.ts`

- [ ] **Step 1: Crear `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

> Nota: requiere `@vitejs/plugin-react`. Añadir a devDependencies en `package.json`:
> `"@vitejs/plugin-react": "^4.3.0"`

- [ ] **Step 2: Crear `apps/web/vitest.setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Añadir `@vitejs/plugin-react` a devDependencies y reinstalar**

En `apps/web/package.json`, en `devDependencies` añadir:
```json
    "@vitejs/plugin-react": "^4.3.0",
```

Run: `pnpm install`

- [ ] **Step 4: Crear `__tests__/NumberGrid.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberGrid } from "@/components/wizard/NumberGrid";

describe("NumberGrid", () => {
  it("renderiza 69 botones de números", () => {
    render(<NumberGrid selected={[]} onToggle={vi.fn()} />);
    for (let i = 1; i <= 69; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("llama onToggle al click", () => {
    const onToggle = vi.fn();
    render(<NumberGrid selected={[]} onToggle={onToggle} />);
    fireEvent.click(screen.getByText("5"));
    expect(onToggle).toHaveBeenCalledWith(5);
  });

  it("deshabilita números cuando ya hay 5 seleccionados", () => {
    render(<NumberGrid selected={[1, 2, 3, 4, 5]} onToggle={vi.fn()} />);
    const btn6 = screen.getByText("6");
    expect(btn6).toBeDisabled();
  });
});
```

- [ ] **Step 5: Crear `__tests__/PowerballGrid.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PowerballGrid } from "@/components/wizard/PowerballGrid";

describe("PowerballGrid", () => {
  it("renderiza 26 botones", () => {
    render(<PowerballGrid selected={null} onSelect={vi.fn()} />);
    for (let i = 1; i <= 26; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("llama onSelect al click", () => {
    const onSelect = vi.fn();
    render(<PowerballGrid selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("13"));
    expect(onSelect).toHaveBeenCalledWith(13);
  });
});
```

- [ ] **Step 6: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/web test`
Expected: 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "test(web): tests de NumberGrid, PowerballGrid con Vitest + RTL"
```

---

## Task 11: Verificación global

**Objetivo:** Confirmar workspace verde y build exitoso.

- [ ] **Step 1: Typecheck del frontend**

Run: `pnpm --filter @myloto/web typecheck`
Expected: exit 0.

- [ ] **Step 2: Build de Next.js**

Run: `pnpm --filter @myloto/web build`
Expected: build exitoso (genera .next/).

- [ ] **Step 3: Tests del frontend**

Run: `pnpm --filter @myloto/web test`
Expected: 5 PASS.

- [ ] **Step 4: Typecheck global (sin tocar el web que tiene config propia)**

Run: `pnpm -r typecheck`
Expected: si el tsconfig del web es incompatible con `pnpm -r`, excluirlo. Si falla, verificar que `apps/web/tsconfig.json` no extiende el base.

> Nota: `pnpm -r typecheck` ejecuta el script `typecheck` de cada paquete. El web tiene su propio `tsc --noEmit` que usa su propio tsconfig. Debería funcionar.

- [ ] **Step 5: Tests globales**

Run: `pnpm -r test`
Expected: todo verde (web 5 + backend 57 + el resto).

- [ ] **Step 6: Verificar dev server**

Run: `cd apps/web && pnpm dev` (Ctrl-C después de ver "Ready")
Expected: "Ready" en puerto 3001.

Entregables verificados (spec §9):
1. ✅ `pnpm install` sin errores
2. ✅ `pnpm --filter @myloto/web typecheck` exit 0
3. ✅ `pnpm --filter @myloto/web test` todo verde (5)
4. ✅ `pnpm --filter @myloto/web build` exitoso
5. ✅ `pnpm -r test` todo verde
6. ✅ `pnpm dev` arranca en :3001
7. ✅ Dashboard muestra jackpot
8. ✅ Wizard funciona (visual, dev server)
9. ⏳ Demo E2E con backend real — pendiente IBD

---

## Self-Review del Plan

### Especificación cubierta

| Sección del spec | Tarea que lo implementa |
|---|---|
| §3 Estructura (app/ routing + components/ + lib/) | Tasks 1, 5, 6, 7, 8, 9 |
| §4 Tema cripto dark (Tailwind) | Task 1 |
| §5.1 api.ts cliente fetch tipado | Task 2 |
| §5.2 hooks.ts react-query + polling | Task 3 |
| §6.1 Dashboard (JackpotCard, ComprarButton) | Task 5 |
| §6.2 Wizard 4 pasos (NumberGrid, PowerballGrid, BuyWizard) | Task 6 |
| §6.3 Resultados (CombinacionGanadora, GanadoresList, VerificableBadge) | Task 7 |
| §6.4 Admin (CrearSorteoForm, GanadoresAdmin) | Task 8 |
| §6.5 Primitivos UI | Task 4 |
| §8 Testing (Vitest + RTL) | Task 10 |
| Navbar/navegación | Task 9 |
| QueryClientProvider | Task 3 |

Todas las secciones del spec tienen al menos una tarea. ✓

### Placeholder scan

- Task 5 Step 2 (`ComprarButton`) referencia `BuyWizard` que se crea en Task 6. El plan lo nota explícitamente ("el typecheck fallará hasta Task 6"). Es una dependencia de orden, no un placeholder. ✓
- Sin "TBD", "implement later", ni "add appropriate error handling". ✓

### Type consistency

- `TicketInput` (n1-n5, powerball, brc20Address?) — Task 2, usado en Task 3 y Task 6. ✓
- `TicketResponse` (id, status, expectedAmount, paymentAddress, bip21Uri, qrSvg) — Task 2, usado en Task 6. ✓
- `SorteoCompleto` (combinacionGanadora, bloquesSemilla) — Task 2, usado en Task 7. ✓
- `GanadorResponse` (id, ticketId, tier, monto, pagado) — Task 2, usado en Tasks 7, 8. ✓
- Hooks: `useJackpot`, `useSorteoActivo`, `useCreateTicket`, `useTicketStatus`, `useSorteo`, `useGanadores`, `useCreateSorteo`, `usePagarGanador` — Task 3, usados en Tasks 5, 6, 7, 8. ✓
- `NumberBall` variantes: "balota"|"powerball"|"ganadora-b"|"ganadora-pb"|"muted" — Task 4, usado en Tasks 6, 7. ✓

Sin inconsistencias. ✓
