# Especificación: Rediseño Frontend MYLoto — Estilo Neo-Vegas Premium

**Fecha:** 2026-06-26
**Proyecto:** MYLoto (lotería Powerball sobre Fractal Bitcoin)
**Scope:** Rediseño visual completo de la web (`apps/web`) a estilo Neo-Vegas/Casino con animaciones premium.

## 1. Contexto y decisiones

La web actual (`lotto.moonyetis.com`) es funcional pero visualmente plana: tema oscuro básico (`#0f0f1e`), paleta gold/rojo/verde simple, sin animaciones, sin texturas. Para una lotería cripto esto transmite poca emoción y confianza.

### Decisiones de diseño (aprobadas en brainstorming)
| Aspecto | Decisión |
|---------|----------|
| Dirección visual | **Neo-Vegas / Casino** — neones vibrantes (rosa `#ec4899`, cian `#22d3ee`, amarillo `#facc15`), texturas diagonales, glow effects |
| Nivel de ambición | **Premium con animaciones** — confeti, contador animado, máquina tragamonedas, partículas, transiciones |
| Layout home | **Hero + scroll con secciones** (jackpot protagonista arriba + secciones al bajar) |
| Branding | **MYLoto** + 🎱 (sin cambios) |
| Stack animación | **Framer Motion** (transiciones, micro-interacciones, tragamonedas) + **canvas-confetti** (confeti al ganar) |

## 2. Paleta y tokens de diseño

### Colores (reemplazan el `tailwind.config.ts` actual)
```ts
colors: {
  background: {
    DEFAULT: "#0a0414",      // negro púrpura profundo (más rico que #0f0f1e)
    card: "#1a0b2e",         // card oscura con tinte púrpura
    elevated: "#16213e",     // superficie elevada
  },
  neon: {
    pink: "#ec4899",         // primario - balotas impares, CTA, acentos
    cyan: "#22d3ee",         // secundario - balotas pares, info, links
    yellow: "#facc15",       // powerball, jackpot, destacados
    purple: "#a78bfa",       // secciones, detalles
    green: "#10b981",        // éxito, verificación, pagado
    red: "#ef4444",          // error (mantener)
  },
}
```

### Gradientes signature
- **Fondo principal:** `linear-gradient(135deg, #1a0b2e 0%, #16213e 50%, #0f3460 100%)`
- **Botón CTA:** `linear-gradient(135deg, #ec4899, #22d3ee)` con glow `box-shadow: 0 0 25px rgba(236,72,153,0.6)`
- **Balota pink:** `linear-gradient(145deg, #ec4899, #be185d)` + border `#f9a8d4`
- **Balota cyan:** `linear-gradient(145deg, #22d3ee, #0891b2)` + border `#67e8f9`
- **Powerball:** `linear-gradient(145deg, #facc15, #eab308)` (redonda, no cuadrada) + border `#fde047`
- **Divisor neon:** `linear-gradient(90deg, transparent, rgba(236,72,153,0.5), rgba(34,211,238,0.5), transparent)`

### Texturas
- **Patrón diagonal de fondo:** `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(236,72,153,0.04) 20px, rgba(236,72,153,0.04) 40px)`
- **Glow radial detrás del jackpot:** `radial-gradient(ellipse, rgba(236,72,153,0.25) 0%, transparent 70%)`

### Tipografía
- **Display/jackpot:** Georgia, serif (peso 900, letter-spacing 1px) — da sensación de casino premium
- **UI general:** system-ui, sans-serif (peso 600-800)
- **Hashes/direcciones:** monospace (`'Courier New', monospace`)

## 3. Dependencias a añadir

```bash
pnpm --filter @myloto/web add framer-motion canvas-confetti
pnpm --filter @myloto/web add -D @types/canvas-confetti
```
- `framer-motion` (~35KB): animaciones declarativas (modal, transiciones, tragamonedas, stagger)
- `canvas-confetti` (~6KB): confeti al activar ticket / ganar

## 4. Componentes nuevos y modificados

### 4.1 Componentes de animación (nuevos)
| Componente | Función |
|------------|---------|
| `components/anim/CountUp.tsx` | Contador animado de 0 a N (jackpot, stats). Usa Framer Motion `useMotionValue` + `animate`. |
| `components/anim/SlotMachine.tsx` | Efecto máquina tragamonedas: números rotando rápidamente que se detienen uno a uno. Para mostrar combinación ganadora. |
| `components/anim/Particles.tsx` | Partículas flotantes de fondo (puntos neon con posiciones aleatorias, animación flotante suave). Lightweight: 8-12 partículas CSS-positioned. |
| `components/anim/NeonGlow.tsx` | Wrapper que aplica glow pulsante a hijos (botones, badges). |
| `lib/confetti.ts` | Helper que dispara confeti con colores neon (rosa/cian/amarillo) en un punto o full-screen. |

### 4.2 Componentes UI rediseñados
| Componente | Cambios |
|------------|---------|
| `ui/Button.tsx` | Nuevas variantes: `primary` (gradiente pink→cyan + glow), `secondary` (borde neon), `ghost`. Animación tap/hover con Framer Motion. |
| `ui/Card.tsx` | Borde sutil neon, fondo `background-card` con tinte púrpura, optional glow. |
| `ui/Navbar.tsx` | Logo 🎱 MYLoto con glow + links con active state neon. Fija al hacer scroll. |
| `ui/NumberBall.tsx` | Variantes `balota-pink`, `balota-cyan`, `powerball`, `ganadora-*` con gradientes y glow. Animación spring al seleccionar. |
| `ui/Modal.tsx` | Entra con scale+fade (Framer Motion `AnimatePresence`), fondo con blur (`backdrop-filter`). |
| `ui/Badge.tsx` | Variantes neon: `finalizado` (verde), `pendiente` (amarillo), `abierto` (cyan). |

### 4.3 Página Home (`app/page.tsx`) — Hero + scroll
Reescrita como composición de secciones:
- `components/home/HeroSection.tsx` — jackpot con CountUp, info sorteo, CTA, trust badges, partículas de fondo.
- `components/home/HowItWorks.tsx` — 3 tarjetas (Elige → Paga → Gana) con stagger animation.
- `components/home/LastResult.tsx` — combinación ganadora anterior con SlotMachine + badge verificar on-chain.
- `components/home/LiveStats.tsx` — stats del sorteo actual (boletos, tiempo, premio) con CountUp.
- `components/home/Footer.tsx` — branding + disclaimer.

### 4.4 Wizard (`components/wizard/BuyWizard.tsx`)
- Mantiene los 4 pasos (selección, descuento, pago, confirmación) — **misma lógica y hooks**.
- Añade barra de progreso de 4 segmentos.
- `AnimatePresence` para transición slide entre pasos.
- Números rebotan (spring) al seleccionar.
- **Confeti en paso 4** cuando el ticket pasa a ACTIVO.
- QR con pulso suave mientras espera pago.

### 4.5 Página Resultados (`app/resultados/page.tsx`)
- Selector de sorteo estilo dropdown neon.
- Combinación con `SlotMachine`.
- **Badge "Verificar on-chain" clicable** → muestra/expande bloques semilla (arregla issue M8 de auditoría: el badge era decorativo, ahora es funcional).
- Lista de ganadores con montos formateados (`formatMonto` ya existe).

### 4.6 Página Admin (`app/admin/page.tsx`)
- Card "Crear sorteo" neon con feedback.
- Gestión de ganadores: montos formateados, botón "Marcar pagado" solo bloquea su fila (M7 ya arreglado en código, mantener).

## 5. Archivos de configuración

### `tailwind.config.ts` — actualizar
- Reemplazar paleta de colores con los tokens Neo-Vegas de la sección 2.
- Añadir `backgroundImage` con los gradientes signature.
- Añadir `boxShadow` con los glows neon.

### `styles/globals.css` — actualizar
- Fondo base: gradiente principal + textura diagonal (vía `body::before` fixed).
- Scrollbar custom neon (webkit).
- Selección de texto neon.

## 6. Lo que NO cambia (fuera de scope)
- **Backend:** cero cambios. Todos los endpoints, CORS y lógica se mantienen.
- **Lógica de negocio del wizard:** los 4 pasos, hooks (`useCreateTicket`, `useTicketStatus`, etc.) y validaciones se conservan.
- **Packages internos** (`crypto`, `db`, etc.): intactos.
- **Tests existentes** (`NumberGrid`, `PowerballGrid`): deben seguir pasando. Si un selector de clase cambia, se actualiza el test.

## 7. Consideraciones técnicas
- **Performance:** las animaciones deben respetar `prefers-reduced-motion` (usuarios que la desactivan ven la versión estática). Framer Motion lo soporta nativamente.
- **SSR:** los componentes que usan `window` (confeti, partículas) deben ser `"use client"` y guardar checks de `typeof window`.
- **Mobile:** el grid de números (9 columnas) debe colapsar a scroll horizontal o grid responsive en pantallas pequeñas. Los gradientes y glows funcionan en mobile.
- **Bundle size:** +~41KB (framer-motion + canvas-confetti). Aceptable para una app con esta ambición visual.

## 8. Criterios de aceptación
1. La home muestra el hero con jackpot animado (CountUp) + 3 secciones al hacer scroll.
2. El wizard mantiene sus 4 pasos funcionales y añade barra de progreso + confeti en el paso final.
3. Resultados muestra la combinación con efecto tragamonedas y badge "verificar on-chain" clicable.
4. Todas las animaciones respetan `prefers-reduced-motion`.
5. Los tests existentes siguen pasando.
6. El build de producción pasa sin errores.
7. Deploy en `lotto.moonyetis.com` y verificación visual en navegador real.
