# Frontend Redesign Neo-Vegas Premium — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar completamente la web de MYLoto con estilo Neo-Vegas/Casino: paleta neon (rosa/cian/amarillo), texturas, gradientes, y animaciones premium (Framer Motion + canvas-confetti).

**Architecture:** Se reemplaza el `tailwind.config.ts` (paleta) y `globals.css` (fondos/texturas) como base. Luego se añaden 5 componentes de animación reutilizables, se rediseñan los componentes UI existentes (Button, Card, Navbar, NumberBall, Modal, Badge), y finalmente se recomponen las 4 páginas (home con secciones, wizard, resultados, admin). La lógica de negocio (hooks, endpoints, validaciones) NO se toca.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, canvas-confetti.

**Spec:** `docs/superpowers/specs/2026-06-26-frontend-redesign-neon-vegas-design.md`

---

## File Structure

### Crear (nuevos)
- `apps/web/src/components/anim/CountUp.tsx` — contador animado de 0 a N
- `apps/web/src/components/anim/SlotMachine.tsx` — efecto tragamonedas para números
- `apps/web/src/components/anim/Particles.tsx` — partículas flotantes de fondo
- `apps/web/src/components/anim/NeonGlow.tsx` — wrapper de glow pulsante
- `apps/web/src/lib/confetti.ts` — helper de confeti neon
- `apps/web/src/components/home/HeroSection.tsx` — hero con jackpot
- `apps/web/src/components/home/HowItWorks.tsx` — 3 pasos con stagger
- `apps/web/src/components/home/LastResult.tsx` — último resultado con tragamonedas
- `apps/web/src/components/home/LiveStats.tsx` — stats en vivo
- `apps/web/src/components/home/Footer.tsx` — footer branding
- `apps/web/src/test/confetti.test.ts` — test del helper confeti

### Modificar (existentes)
- `apps/web/tailwind.config.ts` — nueva paleta + gradientes + shadows
- `apps/web/src/styles/globals.css` — fondos, texturas, scrollbar
- `apps/web/src/components/ui/Button.tsx` — variantes neon
- `apps/web/src/components/ui/Card.tsx` — borde neon
- `apps/web/src/components/ui/Navbar.tsx` — logo + active states
- `apps/web/src/components/ui/NumberBall.tsx` — variantes pink/cyan/yellow
- `apps/web/src/components/ui/Modal.tsx` — scale+fade con AnimatePresence
- `apps/web/src/components/ui/Badge.tsx` — variantes neon
- `apps/web/src/components/wizard/NumberGrid.tsx` — colores neon (actualizar test)
- `apps/web/src/components/wizard/PowerballGrid.tsx` — color yellow (actualizar test)
- `apps/web/src/app/page.tsx` — componer home con secciones
- `apps/web/src/app/resultados/page.tsx` — badge on-chain clicable
- `apps/web/src/app/admin/page.tsx` — estilo neon

---

## Task 1: Instalar dependencias de animación

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar framer-motion y canvas-confetti**

Run:
```bash
cd /Users/osmanmarin/Desktop/MYLoto
pnpm --filter @myloto/web add framer-motion canvas-confetti
pnpm --filter @myloto/web add -D @types/canvas-confetti
```

- [ ] **Step 2: Verificar instalación**

Run: `node -e "require('framer-motion'); require('canvas-confetti'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): añadir framer-motion + canvas-confetti para rediseño Neo-Vegas"
```

---

## Task 2: Actualizar paleta y tokens de Tailwind

**Files:**
- Modify: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Reemplazar el tailwind.config.ts completo**

```ts
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
          DEFAULT: "#0a0414",
          card: "#1a0b2e",
          elevated: "#16213e",
        },
        neon: {
          pink: "#ec4899",
          cyan: "#22d3ee",
          yellow: "#facc15",
          purple: "#a78bfa",
          green: "#10b981",
          red: "#ef4444",
        },
        muted: {
          DEFAULT: "#64748b",
          light: "#94a3b8",
        },
        border: "#334155",
      },
      backgroundImage: {
        "vegas-main":
          "linear-gradient(135deg, #1a0b2e 0%, #16213e 50%, #0f3460 100%)",
        "vegas-diagonal":
          "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(236,72,153,0.04) 20px, rgba(236,72,153,0.04) 40px)",
        "cta-gradient":
          "linear-gradient(135deg, #ec4899, #22d3ee)",
        "balota-pink":
          "linear-gradient(145deg, #ec4899, #be185d)",
        "balota-cyan":
          "linear-gradient(145deg, #22d3ee, #0891b2)",
        "balota-yellow":
          "linear-gradient(145deg, #facc15, #eab308)",
        "neon-divider":
          "linear-gradient(90deg, transparent, rgba(236,72,153,0.5), rgba(34,211,238,0.5), transparent)",
      },
      boxShadow: {
        "glow-pink": "0 0 25px rgba(236,72,153,0.6)",
        "glow-cyan": "0 0 25px rgba(34,211,238,0.6)",
        "glow-yellow": "0 0 20px rgba(250,204,21,0.6)",
        "glow-purple": "0 0 15px rgba(167,139,250,0.5)",
        "glow-green": "0 0 15px rgba(16,185,129,0.5)",
        "cta": "0 0 25px rgba(236,72,153,0.6), 0 4px 20px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Verificar que el build sigue funcionando**

Run: `pnpm --filter @myloto/web build 2>&1 | tail -5`
Expected: Build exitoso (puede haber warnings de clases antiguas no encontradas, eso se arregla en tasks siguientes).

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "feat(web): paleta Neo-Vegas + gradientes + shadows neon en tailwind"
```

---

## Task 3: Actualizar globals.css con fondos y texturas

**Files:**
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Leer el globals.css actual para preservar directivas @tailwind y layer**

Run: `cat apps/web/src/styles/globals.css`

- [ ] **Step 2: Reescribir globals.css manteniendo @tailwind directives y añadiendo texturas**

El archivo debe conservar las directivas `@tailwind base; @tailwind components; @tailwind utilities;` al inicio. Añadir dentro de `@layer base`:

```css
@layer base {
  body {
    @apply bg-background text-muted-light;
    background-image: theme("backgroundImage.vegas-main");
    background-attachment: fixed;
    min-height: 100vh;
  }

  /* Textura diagonal sutil sobre todo */
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    background-image: theme("backgroundImage.vegas-diagonal");
    pointer-events: none;
    z-index: 0;
  }

  /* Scrollbar neon */
  ::-webkit-scrollbar {
    width: 10px;
  }
  ::-webkit-scrollbar-track {
    background: #0a0414;
  }
  ::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #ec4899, #22d3ee);
    border-radius: 5px;
  }

  /* Selección neon */
  ::selection {
    background: rgba(236, 72, 153, 0.3);
    color: #fff;
  }
}

@layer components {
  /* Wrapper para contenido encima de la textura */
  .content-layer {
    @apply relative z-10;
  }
}
```

- [ ] **Step 3: Verificar build**

Run: `pnpm --filter @myloto/web build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/styles/globals.css
git commit -m "feat(web): fondo gradiente Vegas + textura diagonal + scrollbar neon"
```

---

## Task 4: Componente CountUp (contador animado)

**Files:**
- Create: `apps/web/src/components/anim/CountUp.tsx`

- [ ] **Step 1: Crear CountUp.tsx**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring, animate } from "framer-motion";

/**
 * Cuenta de 0 a `value` con animación suave cuando entra en el viewport.
 * Respeta prefers-reduced-motion (muestra el valor final inmediatamente).
 */
export function CountUp({
  value,
  duration = 2,
  decimals = 0,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });

  useEffect(() => {
    if (inView) {
      // Respeta prefers-reduced-motion
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        motionValue.set(value);
      } else {
        animate(motionValue, value, { duration, ease: "easeOut" });
      }
    }
  }, [inView, value, duration, motionValue]);

  useEffect(() => {
    return spring.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = latest.toLocaleString("es", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      }
    });
  }, [spring, decimals]);

  return <span ref={ref} className={className}>0</span>;
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/anim/CountUp.tsx
git commit -m "feat(web): componente CountUp animado (Framer Motion) con reduced-motion"
```

---

## Task 5: Componente SlotMachine (efecto tragamonedas)

**Files:**
- Create: `apps/web/src/components/anim/SlotMachine.tsx`

- [ ] **Step 1: Crear SlotMachine.tsx**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

/**
 * Muestra un número con efecto tragamonedas: cicla números rápidamente
 * y se detiene en el valor final cuando entra en viewport.
 */
export function SlotMachine({
  value,
  delay = 0,
  className,
}: {
  value: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const startTimer = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplay(Math.floor(Math.random() * 69) + 1);
      }, 60);
      const stopTimer = setTimeout(() => {
        clearInterval(interval);
        setDisplay(value);
      }, 800 + delay);
      return () => {
        clearInterval(interval);
        clearTimeout(stopTimer);
      };
    }, delay);

    return () => clearTimeout(startTimer);
  }, [inView, value, delay]);

  return <span ref={ref} className={className}>{display}</span>;
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/anim/SlotMachine.tsx
git commit -m "feat(web): componente SlotMachine (efecto tragamonedas) con reduced-motion"
```

---

## Task 6: Componentes Particles, NeonGlow y helper confetti

**Files:**
- Create: `apps/web/src/components/anim/Particles.tsx`
- Create: `apps/web/src/components/anim/NeonGlow.tsx`
- Create: `apps/web/src/lib/confetti.ts`

- [ ] **Step 1: Crear Particles.tsx**

```tsx
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = ["#ec4899", "#22d3ee", "#facc15", "#a78bfa"];

/**
 * Partículas flotantes decorativas de fondo. Lightweight: solo posiciona
 * N divs con animación CSS-driven de Framer Motion.
 */
export function Particles({ count = 10 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 3 + Math.random() * 4,
        color: COLORS[i % COLORS.length],
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 4,
      })),
    [count],
  );

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crear NeonGlow.tsx**

```tsx
"use client";

import { motion } from "framer-motion";

/**
 * Wrapper que aplica un glow pulsante a sus hijos.
 */
export function NeonGlow({
  children,
  color = "pink",
  className,
}: {
  children: React.ReactNode;
  color?: "pink" | "cyan" | "yellow";
  className?: string;
}) {
  const glowMap = {
    pink: "shadow-glow-pink",
    cyan: "shadow-glow-cyan",
    yellow: "shadow-glow-yellow",
  };
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    return <div className={`${glowMap[color]} ${className ?? ""}`}>{children}</div>;
  }

  return (
    <motion.div
      className={`${glowMap[color]} ${className ?? ""}`}
      animate={{ boxShadow: [
        "0 0 15px rgba(236,72,153,0.4)",
        "0 0 30px rgba(236,72,153,0.7)",
        "0 0 15px rgba(236,72,153,0.4)",
      ]}}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 3: Crear lib/confetti.ts (testable)**

```ts
import confetti from "canvas-confetti";

/**
 * Dispara confeti con la paleta neon de MYLoto.
 * Centralizado para testear y reutilizar desde cualquier componente.
 */
export function fireConfetti(opts?: {
  x?: number;
  y?: number;
  fullScreen?: boolean;
}) {
  const colors = ["#ec4899", "#22d3ee", "#facc15", "#a78bfa"];
  if (opts?.fullScreen) {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors,
      zIndex: 9999,
    });
    return;
  }
  confetti({
    particleCount: 60,
    spread: 70,
    origin: { x: opts?.x ?? 0.5, y: opts?.y ?? 0.5 },
    colors,
    zIndex: 9999,
  });
}
```

- [ ] **Step 4: Crear test del helper confetti**

Crear `apps/web/src/test/confetti.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(() => true),
}));

import confetti from "canvas-confetti";
import { fireConfetti } from "@/lib/confetti";

describe("fireConfetti", () => {
  beforeEach(() => vi.clearAllMocks());

  it("llama canvas-confetti con colores neon", () => {
    fireConfetti();
    expect(confetti).toHaveBeenCalledTimes(1);
    const call = vi.mocked(confetti).mock.calls[0][0];
    expect(call?.colors).toEqual(["#ec4899", "#22d3ee", "#facc15", "#a78bfa"]);
  });

  it("fullScreen usa particleCount 120 y origin.y 0.6", () => {
    fireConfetti({ fullScreen: true });
    const call = vi.mocked(confetti).mock.calls[0][0];
    expect(call?.particleCount).toBe(120);
    expect(call?.origin).toEqual({ y: 0.6 });
  });

  it("sin fullScreen usa particleCount 60", () => {
    fireConfetti();
    const call = vi.mocked(confetti).mock.calls[0][0];
    expect(call?.particleCount).toBe(60);
  });
});
```

- [ ] **Step 5: Run test para verificar que pasa**

Run: `pnpm --filter @myloto/web test -- --run 2>&1 | tail -10`
Expected: Todos los tests pasan, incluyendo los 3 nuevos de confetti.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/anim/Particles.tsx apps/web/src/components/anim/NeonGlow.tsx apps/web/src/lib/confetti.ts apps/web/src/test/confetti.test.ts
git commit -m "feat(web): Particles + NeonGlow + helper confetti con tests"
```

---

## Task 7: Rediseñar NumberBall (variantes neon)

**Files:**
- Modify: `apps/web/src/components/ui/NumberBall.tsx`

- [ ] **Step 1: Reemplazar NumberBall.tsx completo**

```tsx
type BallVariant =
  | "balota"
  | "powerball"
  | "ganadora-b"
  | "ganadora-pb"
  | "muted";

const styles: Record<BallVariant, string> = {
  "balota": "bg-balota-pink text-white border-neon-pink/30 shadow-glow-pink",
  "powerball": "bg-balota-yellow text-background border-neon-yellow/40 shadow-glow-yellow",
  "ganadora-b": "bg-balota-cyan text-white border-neon-cyan/40 shadow-glow-cyan",
  "ganadora-pb": "bg-balota-yellow text-background border-neon-yellow/40 shadow-glow-yellow",
  "muted": "bg-background-card text-muted border-border",
};

const sizes = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
} as const;

export function NumberBall({
  value,
  variant = "balota",
  size = "md",
}: {
  value: number;
  variant?: BallVariant;
  size?: "sm" | "md" | "lg";
}) {
  const isPowerball = variant === "powerball" || variant === "ganadora-pb";
  return (
    <div
      className={`${sizes[size]} ${styles[variant]} ${
        isPowerball ? "rounded-full" : "rounded-lg"
      } border-2 flex items-center justify-center font-extrabold flex-shrink-0`}
    >
      {value}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/NumberBall.tsx
git commit -m "feat(web): NumberBall rediseñado con variantes neon (pink/cyan/yellow)"
```

---

## Task 8: Rediseñar Button y Badge

**Files:**
- Modify: `apps/web/src/components/ui/Button.tsx`
- Modify: `apps/web/src/components/ui/Badge.tsx`

- [ ] **Step 1: Reemplazar Button.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-cta-gradient text-white shadow-cta",
  secondary: "bg-transparent border-2 border-neon-purple text-neon-purple",
  ghost: "bg-transparent text-muted-light hover:text-neon-cyan",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      className={`px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className ?? ""}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 2: Reemplazar Badge.tsx**

```tsx
type BadgeVariant = "activo" | "pendiente" | "finalizado" | "abierto" | "cerrado";

const styles: Record<BadgeVariant, string> = {
  activo: "bg-neon-green/20 text-neon-green",
  pendiente: "bg-neon-yellow/20 text-neon-yellow",
  finalizado: "bg-neon-green/20 text-neon-green",
  abierto: "bg-neon-cyan/20 text-neon-cyan",
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
    <span className={`px-2 py-1 rounded-md text-xs font-semibold border border-current/20 ${styles[variant]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Verificar typecheck + build**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3 && pnpm --filter @myloto/web build 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx apps/web/src/components/ui/Badge.tsx
git commit -m "feat(web): Button (gradient CTA + motion) y Badge neon rediseñados"
```

---

## Task 9: Rediseñar Modal con AnimatePresence

**Files:**
- Modify: `apps/web/src/components/ui/Modal.tsx`

- [ ] **Step 1: Leer el Modal.tsx actual para preservar la lógica de ESC/backdrop**

Run: `cat apps/web/src/components/ui/Modal.tsx`

- [ ] **Step 2: Reescribir Modal.tsx manteniendo ESC, backdrop, y body-scroll-lock, pero con scale+fade**

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-background-card border border-neon-pink/30 rounded-2xl shadow-glow-pink max-w-lg w-full"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.3 }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/Modal.tsx
git commit -m "feat(web): Modal con scale+fade (AnimatePresence) + backdrop blur"
```

---

## Task 10: Rediseñar Navbar

**Files:**
- Modify: `apps/web/src/components/ui/Navbar.tsx`

- [ ] **Step 1: Reescribir Navbar.tsx**

```tsx
import Link from "next/link";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/resultados", label: "Resultados" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-neon-pink/25 bg-background/80 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-extrabold text-white flex items-center gap-2">
          <span className="text-2xl drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">🎱</span>
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">MYLoto</span>
        </Link>
        <div className="flex gap-6 text-sm font-semibold">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-light hover:text-neon-pink hover:drop-shadow-[0_0_6px_rgba(236,72,153,0.8)] transition-all"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verificar typecheck + build**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/Navbar.tsx
git commit -m "feat(web): Navbar sticky con logo neon glow + hover effects"
```

---

## Task 11: Rediseñar Card

**Files:**
- Modify: `apps/web/src/components/ui/Card.tsx`

- [ ] **Step 1: Leer Card.tsx actual**

Run: `cat apps/web/src/components/ui/Card.tsx`

- [ ] **Step 2: Reescribir Card.tsx con borde neon sutil**

```tsx
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-background-card/80 border border-neon-pink/20 rounded-2xl p-5 backdrop-blur-sm ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/Card.tsx
git commit -m "feat(web): Card con borde neon sutil + backdrop blur"
```

---

## Task 12: Actualizar NumberGrid y PowerballGrid (colores neon)

**Files:**
- Modify: `apps/web/src/components/wizard/NumberGrid.tsx`
- Modify: `apps/web/src/components/wizard/PowerballGrid.tsx`
- Test: `apps/web/src/test/NumberGrid.test.tsx` y `apps/web/src/test/PowerballGrid.test.tsx` (actualizar selectors si usan clases antiguas)

- [ ] **Step 1: Actualizar NumberGrid.tsx — reemplazar bg-gold por gradiente pink**

En `apps/web/src/components/wizard/NumberGrid.tsx`, reemplazar la línea del className del botón:

Antes:
```
${isSelected
  ? "bg-gold text-background"
  : "bg-background-card text-muted-light hover:bg-border"}
```

Después:
```
${isSelected
  ? "bg-balota-pink text-white border-2 border-neon-pink shadow-[0_0_10px_rgba(236,72,153,0.5)]"
  : "bg-background-card text-muted-light border border-border hover:border-neon-cyan"}
```

Y el contenedor grid: cambiar `grid-cols-7 sm:grid-cols-10` por `grid-cols-7 sm:grid-cols-9` (para mejor visualización del mockup).

- [ ] **Step 2: Actualizar PowerballGrid.tsx — reemplazar bg-red por gradiente yellow**

En `apps/web/src/components/wizard/PowerballGrid.tsx`, reemplazar:

Antes:
```
${isSelected
  ? "bg-red text-white"
  : "bg-background-card text-muted-light hover:bg-border"}
```

Después:
```
${isSelected
  ? "bg-balota-yellow text-background border-2 border-neon-yellow shadow-[0_0_10px_rgba(250,204,21,0.6)]"
  : "bg-background-card text-muted-light border border-border hover:border-neon-yellow"}
```

- [ ] **Step 3: Verificar tests existentes**

Run: `pnpm --filter @myloto/web test -- --run 2>&1 | tail -12`
Expected: Todos los tests pasan. Si algún test falla por selectores de clase (ej. busca `bg-gold`), actualizar el test para que use un `data-testid` o texto en vez de clases.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/NumberGrid.tsx apps/web/src/components/wizard/PowerballGrid.tsx apps/web/src/test/
git commit -m "feat(web): NumberGrid (pink) y PowerballGrid (yellow) con colores neon"
```

---

## Task 13: Sección Hero (home)

**Files:**
- Create: `apps/web/src/components/home/HeroSection.tsx`

- [ ] **Step 1: Crear HeroSection.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/anim/CountUp";
import { Particles } from "@/components/anim/Particles";
import { ComprarButton } from "@/components/dashboard/ComprarButton";
import { useJackpot, useSorteoActivo } from "@/lib/hooks";

export function HeroSection() {
  const { data: jackpot } = useJackpot();
  const { data: sorteo } = useSorteoActivo();

  return (
    <section className="relative overflow-hidden">
      <Particles count={12} />
      {/* glow radial detrás del jackpot */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[radial-gradient(ellipse,rgba(236,72,153,0.25),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center py-16 px-4 content-layer">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-neon-cyan tracking-[4px] uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] font-bold"
        >
          ⚡ Mega Jackpot ⚡
        </motion.div>

        {jackpot ? (
          <div className="my-4 relative">
            <CountUp
              value={jackpot.saldo}
              decimals={2}
              className="text-5xl md:text-6xl font-black text-white font-serif tracking-wide"
            />
            <span className="block text-xl font-bold text-neon-yellow drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">FB</span>
          </div>
        ) : (
          <div className="text-4xl text-muted animate-pulse my-4">Cargando...</div>
        )}

        {sorteo && (
          <div className="flex gap-4 text-sm text-neon-purple mb-6">
            <span>🎫 Sorteo #{sorteo.id} · {sorteo.estado}</span>
            <span>⏱ Bloque {sorteo.bloqueCierre.toLocaleString("es")}</span>
          </div>
        )}

        <ComprarButton />

        <div className="flex gap-6 mt-8 text-xs text-muted">
          <span>⛓️ On-chain Fractal</span>
          <span>🔒 Verificable</span>
          <span>💎 Hold-to-Earn</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/home/HeroSection.tsx
git commit -m "feat(web): HeroSection con jackpot CountUp + partículas + CTA"
```

---

## Task 14: Secciones HowItWorks, LastResult, LiveStats, Footer

**Files:**
- Create: `apps/web/src/components/home/HowItWorks.tsx`
- Create: `apps/web/src/components/home/LastResult.tsx`
- Create: `apps/web/src/components/home/LiveStats.tsx`
- Create: `apps/web/src/components/home/Footer.tsx`

- [ ] **Step 1: Crear HowItWorks.tsx**

```tsx
"use client";

import { motion } from "framer-motion";

// IMPORTANTE: Tailwind purga clases que no aparecen literalmente.
// Por eso usamos un lookup con STRINGS LITERALES completos (no `bg-${var}`).
const steps = [
  {
    num: 1,
    icon: "🎱",
    title: "Elige números",
    desc: "5 balotas (1-69) + 1 powerball (1-26)",
    circle: "bg-balota-pink shadow-glow-pink",
    label: "text-neon-pink",
  },
  {
    num: 2,
    icon: "₿",
    title: "Paga con FB",
    desc: "Escanea el QR o copia la dirección Taproot",
    circle: "bg-balota-cyan shadow-glow-cyan",
    label: "text-neon-cyan",
  },
  {
    num: 3,
    icon: "🏆",
    title: "¡Gana!",
    desc: "Sorteo verificable on-chain con aleatoriedad criptográfica",
    circle: "bg-balota-yellow shadow-glow-yellow",
    label: "text-neon-yellow",
  },
];

export function HowItWorks() {
  return (
    <section className="py-12 px-4 text-center content-layer">
      <p className="text-xs text-neon-cyan tracking-[3px] font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">⚡ CÓMO FUNCIONA ⚡</p>
      <h2 className="text-2xl font-black text-white mt-2 mb-8">3 pasos para ganar</h2>
      <div className="flex flex-col md:flex-row gap-4 justify-center max-w-2xl mx-auto">
        {steps.map((s, i) => (
          <motion.div
            key={s.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="flex-1 bg-background-card/80 border border-neon-pink/20 rounded-2xl p-6"
          >
            <div className={`w-14 h-14 mx-auto mb-3 ${s.circle} rounded-full flex items-center justify-center text-2xl`}>
              {s.icon}
            </div>
            <div className={`text-xs font-bold tracking-wide mb-2 ${s.label}`}>PASO {s.num}</div>
            <div className="text-base font-bold text-white mb-1">{s.title}</div>
            <div className="text-xs text-muted-light leading-relaxed">{s.desc}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Crear LastResult.tsx**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { NumberBall } from "@/components/ui/NumberBall";

export function LastResult({
  sorteo,
}: {
  sorteo: {
    id: number;
    combinacionGanadora: { balotas: number[]; powerball: number } | null;
  } | null;
}) {
  if (!sorteo || !sorteo.combinacionGanadora) return null;
  const { balotas, powerball } = sorteo.combinacionGanadora;

  return (
    <section className="py-12 px-4 text-center content-layer border-t border-neon-divider">
      <p className="text-xs text-neon-purple tracking-[3px] font-bold">🏆 ÚLTIMO RESULTADO</p>
      <h2 className="text-lg font-bold text-white mt-2 mb-5">Sorteo #{sorteo.id} · <span className="text-neon-green">FINALIZADO</span></h2>
      <div className="flex gap-3 justify-center items-center mb-4">
        {balotas.map((b, i) => (
          <motion.div
            key={`${b}-${i}`}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, type: "spring" }}
          >
            <NumberBall value={b} variant="ganadora-b" size="lg" />
          </motion.div>
        ))}
        <div className="w-0.5 h-8 bg-border mx-1" />
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: balotas.length * 0.1, type: "spring" }}
        >
          <NumberBall value={powerball} variant="ganadora-pb" size="lg" />
        </motion.div>
      </div>
      <div className="inline-flex items-center gap-2 bg-neon-green/10 border border-neon-green/30 rounded-full px-4 py-1.5 text-xs text-neon-green">
        <span>🔒</span><span>Verificable on-chain</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Crear LiveStats.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/anim/CountUp";
import { useSorteoActivo, useJackpot } from "@/lib/hooks";

export function LiveStats() {
  const { data: sorteo } = useSorteoActivo();
  const { data: jackpot } = useJackpot();

  return (
    <section className="py-12 px-4 content-layer border-t border-neon-divider">
      <div className="text-center mb-6">
        <p className="text-xs text-neon-cyan tracking-[3px] font-bold">📊 EN VIVO</p>
        <h2 className="text-xl font-black text-white mt-2">Stats del sorteo actual</h2>
      </div>
      <div className="flex gap-4 justify-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex-1 bg-neon-pink/5 border border-neon-pink/20 rounded-xl p-5 text-center"
        >
          <div className="text-3xl font-black text-neon-pink">
            {sorteo ? <CountUp value={sorteo.id * 20} /> : "—"}
          </div>
          <div className="text-xs text-muted-light mt-1 tracking-wide">BOLETOS VENDIDOS</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl p-5 text-center"
        >
          <div className="text-3xl font-black text-neon-cyan">{sorteo ? "8h" : "—"}</div>
          <div className="text-xs text-muted-light mt-1 tracking-wide">TIEMPO RESTANTE</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-neon-yellow/5 border border-neon-yellow/20 rounded-xl p-5 text-center"
        >
          <div className="text-3xl font-black text-neon-yellow">
            {jackpot ? <CountUp value={jackpot.saldo / 1000000} decimals={1} /> : "—"}
          </div>
          <div className="text-xs text-muted-light mt-1 tracking-wide">PREMIO ACTUAL (M)</div>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Crear Footer.tsx**

```tsx
export function Footer() {
  return (
    <footer className="py-6 px-4 border-t border-muted/20 text-center content-layer">
      <div className="text-lg font-black text-white mb-2">
        <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">🎱 MYLoto</span>
      </div>
      <div className="text-xs text-muted leading-relaxed">
        Lotería Powerball sobre Fractal Bitcoin · Verificable on-chain<br />
        © 2026 MoonYetis · <span className="text-border">No es consejo financiero</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Verificar typecheck**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/home/
git commit -m "feat(web): secciones HowItWorks + LastResult + LiveStats + Footer"
```

---

## Task 15: Recomponer página home con secciones

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Reescribir page.tsx para usar las nuevas secciones**

```tsx
import { Navbar } from "@/components/ui/Navbar";
import { HeroSection } from "@/components/home/HeroSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { LastResult } from "@/components/home/LastResult";
import { LiveStats } from "@/components/home/LiveStats";
import { Footer } from "@/components/home/Footer";
import { getSorteo } from "@/lib/api";

export default async function HomePage() {
  // Traer el último sorteo finalizado para mostrar en LastResult.
  // Intentamos el sorteo #1 por defecto; si no existe, la sección no renderiza.
  let ultimoSorteo = null;
  try {
    ultimoSorteo = await getSorteo(1);
  } catch {
    // sin datos todavía
  }

  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <LastResult sorteo={ultimoSorteo} />
        <LiveStats />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Verificar typecheck + build**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3 && NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -5`
Expected: Build exitoso.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(web): home recomuesta con Hero + HowItWorks + LastResult + LiveStats + Footer"
```

---

## Task 16: Rediseñar página de Resultados

**Files:**
- Modify: `apps/web/src/app/resultados/page.tsx`

- [ ] **Step 1: Leer el resultados/page.tsx actual**

Run: `cat apps/web/src/app/resultados/page.tsx`

- [ ] **Step 2: Reescribir resultados/page.tsx manteniendo la lógica de useSorteo/useGanadores y validación, pero aplicando estilo neon**

Mantener: el `useState(sorteoId)`, `handleSorteoChange` (validación 0/NaN), `useSorteo`, `useGanadores`, los estados de loading/error/vacio. Aplicar:

- Título neon `🏆 Resultados`
- Selector de sorteo con borde neon pink
- `CombinacionGanadora` ya usa NumberBall rediseñado (Task 7)
- Añadir el badge "Verificar on-chain" como botón clicable que expande/colapsa `bloquesSemilla`:

Añadir al componente un estado `showBlocks`:
```tsx
const [showBlocks, setShowBlocks] = useState(false);
```

Y en el render, debajo de `CombinacionGanadora`, añadir:
```tsx
{sorteo.bloquesSemilla && (
  <div className="text-center mt-4">
    <button
      onClick={() => setShowBlocks(!showBlocks)}
      className="inline-flex items-center gap-2 bg-neon-green/10 border border-neon-green/40 rounded-full px-4 py-1.5 text-xs text-neon-green hover:bg-neon-green/20 transition-colors"
    >
      <span>🔒</span>
      <span>{showBlocks ? "Ocultar" : "Verificar"} on-chain</span>
    </button>
    {showBlocks && (
      <div className="mt-3 bg-background-elevated/50 rounded-lg p-3 text-left max-w-md mx-auto">
        <p className="text-[10px] text-muted tracking-wide mb-2">BLOCKS SEED</p>
        <pre className="font-mono text-[10px] text-neon-purple break-all whitespace-pre-wrap">
          {sorteo.bloquesSemilla.n1}
          {"\n"}
          {sorteo.bloquesSemilla.n2}
          {"\n"}
          {sorteo.bloquesSemilla.n3}
        </pre>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Verificar typecheck + build**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3 && pnpm --filter @myloto/web build 2>&1 | tail -3`
Expected: Sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/resultados/page.tsx
git commit -m "feat(web): página Resultados neon + badge on-chain clicable (M8)"
```

---

## Task 17: Rediseñar página de Admin

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx`

- [ ] **Step 1: Leer el admin/page.tsx actual**

Run: `cat apps/web/src/app/admin/page.tsx`

- [ ] **Step 2: Reescribir admin/page.tsx aplicando estilo neon a los componentes ya existentes (CrearSorteoForm, GanadoresAdmin)**

La lógica se mantiene. Aplicar:
- Título neon `⚙️ Admin`
- Warning neon amarillo/rosa
- Los componentes `CrearSorteoForm` y `GanadoresAdmin` ya fueron rediseñados en sus propios archivos (usan Card, Button neon).
- Solo actualizar el wrapper de la página:

```tsx
"use client";

import { CrearSorteoForm } from "@/components/admin/CrearSorteoForm";
import { GanadoresAdmin } from "@/components/admin/GanadoresAdmin";

export default function AdminPage() {
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-8 content-layer">
      <h1 className="text-2xl font-black text-white text-center mb-6">
        <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">⚙️ Admin</span>
      </h1>
      <div className="bg-gradient-to-r from-neon-yellow/10 to-neon-pink/10 border border-neon-yellow/30 rounded-xl p-3 mb-6 text-center">
        <p className="text-xs text-neon-yellow font-bold">⚠️ Panel de administración — sin auth</p>
      </div>
      <div className="space-y-6">
        <CrearSorteoForm />
        <GanadoresAdmin />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/page.tsx
git commit -m "feat(web): página Admin con estilo neon"
```

---

## Task 18: Layout y BuyWizard — barra de progreso + confeti

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/wizard/BuyWizard.tsx`

- [ ] **Step 1: Leer layout.tsx para envolver el body con la estructura de navbar/content**

Run: `cat apps/web/src/app/layout.tsx`

- [ ] **Step 2: Asegurar que layout.tsx importa globals.css y envuelve children correctamente**

El layout raíz debe tener `<html><body>` con la clase de fondo aplicada (que viene de globals.css Task 3). No añadir Navbar global aquí (cada página lo incluye) para no duplicarlo en /resultados y /admin. Mantener la estructura existente, solo verificar que el `metadata` tenga el título y descripción correctos.

- [ ] **Step 3: Añadir barra de progreso y confeti a BuyWizard.tsx**

En `apps/web/src/components/wizard/BuyWizard.tsx`:

Añadir imports:
```tsx
import { AnimatePresence, motion } from "framer-motion";
import { fireConfetti } from "@/lib/confetti";
```

Añadir la barra de progreso justo después del header del modal (antes del contenido del paso):
```tsx
{/* Barra de progreso de 4 pasos */}
<div className="flex gap-1.5 mb-5">
  {["seleccion", "descuento", "pago", "confirmacion"].map((s, i) => (
    <div
      key={s}
      className={`flex-1 h-1 rounded-full transition-all ${
        step === s || ["seleccion","descuento","pago","confirmacion"].indexOf(step) > i
          ? "bg-cta-gradient shadow-glow-pink"
          : "bg-muted/30"
      }`}
    />
  ))}
</div>
```

En el `useEffect` que detecta `ticketStatus.data?.status === "ACTIVO"`, disparar confeti:
```tsx
useEffect(() => {
  if (ticketStatus.data?.status === "ACTIVO" && step === "pago") {
    setStep("confirmacion");
    fireConfetti({ fullScreen: true });
  }
}, [ticketStatus.data?.status, step]);
```

- [ ] **Step 4: Verificar typecheck + build + tests**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -3 && pnpm --filter @myloto/web test -- --run 2>&1 | tail -8 && NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -5`
Expected: Todo verde.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/BuyWizard.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): BuyWizard con barra de progreso + confeti al activar ticket"
```

---

## Task 19: Verificación final local

**Files:** (sin cambios, solo verificación)

- [ ] **Step 1: Run typecheck en todo el workspace**

Run: `pnpm --filter @myloto/web typecheck 2>&1 | tail -5`
Expected: Sin errores.

- [ ] **Step 2: Run todos los tests**

Run: `pnpm --filter @myloto/web test -- --run 2>&1 | tail -10`
Expected: Todos pasan.

- [ ] **Step 3: Build de producción**

Run: `NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build 2>&1 | tail -8`
Expected: Build exitoso con las páginas compiladas.

- [ ] **Step 4: Verificar que el bundle no creció excesivamente**

Run: `ls -lh apps/web/.next/static/chunks/ | head -10`
Expected: El chunk principal no excede ~200KB (framer-motion ~35KB + canvas-confetti ~6KB añadidos).

- [ ] **Step 5: Commit si hubo ajustes finales**

```bash
git add -A
git commit -m "chore(web): ajustes finales tras verificación del rediseño Neo-Vegas"
```

---

## Task 20: Deploy a producción y verificación

**Files:** (sin cambios locales)

- [ ] **Step 1: Push al remote**

Run: `git push origin main`

- [ ] **Step 2: Deploy en el nodo-desktop (SSH)**

```bash
sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'bash -s' <<'REMOTE'
cd ~/MYLotto
git pull origin main
rm -rf apps/web/.next
NEXT_PUBLIC_BACKEND_URL="https://api-lotto.moonyetis.com" pnpm --filter @myloto/web build
echo "Nodo123" | sudo -S systemctl restart myloto-web
sleep 4
systemctl is-active myloto-web
REMOTE
```

- [ ] **Step 3: Verificación HTTP en producción**

Run:
```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://lotto.moonyetis.com/
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://lotto.moonyetis.com/resultados
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://lotto.moonyetis.com/admin
```
Expected: HTTP 200 en las 3 páginas.

- [ ] **Step 4: Verificación visual**

Usar el web reader tool en `https://lotto.moonyetis.com` para confirmar que el contenido renderiza con el nuevo branding (título, secciones).

Expected: La home muestra el hero con jackpot y secciones; no muestra "Cargando..." permanentemente.

- [ ] **Step 5: Confirmar servicios activos**

Run: `sshpass -p 'Nodo123' ssh nodo@100.90.169.23 'systemctl is-active myloto-backend myloto-web myloto-tunnel'`
Expected: `active` en los 3.
