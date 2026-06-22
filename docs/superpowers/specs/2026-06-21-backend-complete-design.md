# Diseño: Backend Completo — Gestión de Sorteos y Orquestación (Ciclo 7)

**Fecha:** 2026-06-21
**Ciclo:** 7 de 8
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)
**Depende de:** Ciclo 1-6 (todos).

---

## 1. Contexto y Alcance

Tras 6 ciclos, el backend tiene: endpoints `/health` y `/tickets`, 3 workers (pagos, draw, escrutinio), y todo el dominio en `packages/*`. Lo que falta para el "backend completo" es la capa de gestión y orquestación que cierra el ciclo de vida del sorteo end-to-end:

- **Gestión de sorteos:** crear, listar, consultar estado y resultados.
- **Cierre automático por bloque:** transición ABIERTO→CERRADO cuando la altura actual ≥ bloque_cierre.
- **Endpoints de resultados:** ganadores, combinación ganadora, jackpot actual.
- **Orquestación:** arrancar los 4 workers en un solo proceso.
- **Pago manual:** marcar premios como pagados tras pago FB manual del operador.

### Objetivos de este ciclo

- Implementar `routes/sorteos.ts` (CRUD + resultados) y extender `services/sorteos.ts`.
- Implementar `workers/lifecycle-verifier.ts` (4º worker: ABIERTO→CERRADO).
- Implementar `orchestrator.ts` (arranque unificado de los 4 workers).
- Wire-up del servidor (registrar `/sorteos` y `/jackpot`).
- Refactor: extraer `buildWorkerDeps(deps)` en cada worker para reutilizar wiring.

### No incluye este ciclo (explícito)

- **Pago FB automático a ganadores** — requiere manejo de llaves privadas/PSBT. El operador paga desde Sparrow y marca `pagado=true` via endpoint admin.
- **Auth/middleware** — los endpoints `/admin/*` no tienen auth. El backend corre en localhost o detrás de proxy con auth externa. El Ciclo 8 (frontend) añadirá auth real.
- **Frontend** — Ciclo 8.
- **Demo E2E con nodo real** — pendiente IBD (~2-3 días más).

---

## 2. Decisiones Consolidadas

| Decisión | Elección | Justificación |
|---|---|---|
| Alcance | Backend completo sin pago FB automático | El pago toca seguridad operacional (llaves privadas); pago manual por ahora |
| Cierre por bloque | Worker periódico (`lifecycle-verifier`) | Mismo patrón que los otros 3 workers; reintenta automáticamente |
| Creación de sorteos | POST /admin/sorteos sin auth | Pragma: auth real en Ciclo 8. El backend corre en localhost/proxy |
| Duración del sorteo | `DURACION_SORTEO_BLOQUES` configurable, default 144 | Flexible; Fractal mina cada ~30s-2min, así 144 = 1-3 días |
| Orquestación | Proceso único con 4 workers en paralelo | Simple de operar, shutdown unificado, MYLoto no necesita escalado horizontal |
| Endpoints de resultados | Completos: /sorteos/:id, /ganadores, /jackpot, /abierto | Cobertura completa para el frontend del Ciclo 8 |
| Arquitectura | Routes + services + orchestrator en backend | Sigue el patrón routes→services→db; sin paquetes nuevos (YAGNI) |

### Flujo de vida completo del sorteo

```
POST /admin/sorteos (crea ABIERTO)
  → worker:lifecycle cierra (ABIERTO→CERRADO) cuando altura >= bloque_cierre
  → worker:draw calcula (CERRADO→CALCULADO) cuando bloque_cierre+3 existe
  → worker:scrutiny escruta (CALCULADO→FINALIZADO) clasificando tickets
  → operador paga FB manualmente + POST /admin/ganadores/:id/pagar
```

Los 4 workers corren en paralelo dentro del orquestador. Cada uno opera sobre su estado sin depender del orden de ejecución.

---

## 3. Estructura

```
apps/backend/src/
├── routes/
│   ├── sorteos.ts                # NUEVO: CRUD + resultados + admin
│   ├── (health.ts, tickets.ts existen)
├── services/
│   ├── sorteos.ts                # EXTENDIDO: createSorteo, getSorteoById, getSorteoAbierto, getGanadores, cerrarVencidos, markPagado
│   ├── (premios.ts, pricing.ts, tickets.ts existen)
├── workers/
│   ├── lifecycle-verifier.ts     # NUEVO: ABIERTO→CERRADO
│   ├── (payment-verifier.ts, draw-verifier.ts, scrutiny-verifier.ts existen — refactor buildWorkerDeps)
└── orchestrator.ts               # NUEVO: arranca los 4 workers
```

**Modifica:**
- `packages/config/src/env.ts` — `DURACION_SORTEO_BLOQUES` + `LIFECYCLE_CHECK_INTERVAL_MS`.
- `apps/backend/src/server.ts` — registrar `/sorteos` y `/jackpot`.
- `apps/backend/package.json` — scripts `worker:lifecycle` + `workers`.
- `apps/backend/src/workers/*.ts` — extraer `buildWorkerDeps(deps)` en cada uno.
- `.env.example`.

### Principios

- **Routes** — HTTP fino con Zod, llaman a services. Como `tickets.ts`.
- **Services** — composición DB (Drizzle). Como `tickets.ts`, `sorteos.ts` (existente).
- **Workers** — mismo patrón: `runRound` exportada, `runLoop`, `main()` con guard `import.meta.url`.
- **Orchestrator** — wiring puro, sin lógica de negocio.

---

## 4. Endpoints HTTP

### 4.1 `POST /admin/sorteos` — Crear sorteo

```
Request:  (sin body; bloque_cierre se calcula automáticamente)
Éxito:    201 { id, bloqueCierre, estado: "ABIERTO", creadoEn }
Flujo:    1. height = rpc.getBlockCount()
          2. bloqueCierre = height + env.DURACION_SORTEO_BLOQUES
          3. createSorteo(db, bloqueCierre) → estado ABIERTO
Errores:  500 — RPC o DB fallaron
```

### 4.2 `GET /sorteos/abierto` — Sorteo activo

```
Éxito:    200 { id, bloqueCierre, estado: "ABIERTO", creadoEn }
Errores:  404 — no hay sorteo ABIERTO
```

### 4.3 `GET /sorteos/:id` — Estado del sorteo

```
Éxito:    200 { id, bloqueCierre, estado, combinacionGanadora?, bloquesSemilla?, creadoEn, cerradoEn?, calculadoEn? }
Errores:  404 — no existe
```

### 4.4 `GET /sorteos/:id/ganadores` — Ganadores del sorteo

```
Éxito:    200 [{ ticketId, tier, monto, pagado }, ...]
          (vacío [] si el sorteo no está FINALIZADO o no hay ganadores)
```

### 4.5 `GET /jackpot` — Saldo acumulado

```
Éxito:    200 { saldo: number }
```

### 4.6 `POST /admin/ganadores/:id/pagar` — Marcar premio pagado

```
Request:  (sin body)
Éxito:    200 { id, pagado: true }
Flujo:    UPDATE ganadores SET pagado=true WHERE id=:id
Errores:  404 — ganador no existe
```

---

## 5. Services

### 5.1 `services/sorteos.ts` (extendido)

Añade a las funciones existentes (`getActiveSorteo`, etc.):

```typescript
/** Crea un nuevo sorteo con estado ABIERTO. */
export async function createSorteo(db: Database, bloqueCierre: number): Promise<Sorteo>;

/** Devuelve un sorteo por id completo. */
export async function getSorteoById(db: Database, id: number): Promise<Sorteo | null>;

/** Devuelve el sorteo ABIERTO único, o null. */
export async function getSorteoAbierto(db: Database): Promise<Sorteo | null>;

/** Devuelve los ganadores de un sorteo (JOIN ganadores + tickets). */
export async function getGanadores(db: Database, sorteoId: number): Promise<GanadorConTicket[]>;

/** Cierra sorteos ABIERTO cuyo bloque_cierre <= currentHeight. Devuelve cuántos cerró. */
export async function cerrarVencidos(db: Database, currentHeight: number): Promise<number>;

/** Marca un ganador como pagado. */
export async function markPagado(db: Database, ganadorId: number): Promise<boolean>;
```

> `getActiveSorteo` (Ciclo 4) y `getSorteoAbierto` son funcionalmente idénticos. El plan consolidará: `getSorteoAbierto` reemplaza a `getActiveSorteo`, y `tickets.ts` actualiza su import.

### 5.2 `getJackpotBalance` — reutilizado de `services/premios.ts`

El endpoint `GET /jackpot` llama a `getJackpotBalance(deps.db.db)` que ya existe (Ciclo 6).

---

## 6. Worker `lifecycle-verifier.ts`

```typescript
export interface LifecycleWorkerDeps {
  getBlockCount: () => Promise<number>;
  cerrarVencidos: (currentHeight: number) => Promise<number>;
  logger: Logger;
}

export async function runRound(deps: LifecycleWorkerDeps): Promise<{ checked: number; closed: number }> {
  const height = await deps.getBlockCount();
  const closed = await deps.cerrarVencidos(height);
  if (closed > 0) {
    deps.logger.info("sorteos cerrados", { count: closed });
  }
  return { checked: closed, closed };
}
```

- `runLoop` con shutdown graceful, mismo patrón.
- `main()` con guard `import.meta.url`.
- Script npm: `worker:lifecycle`.
- Var de config: `LIFECYCLE_CHECK_INTERVAL_MS` (default 60000).

---

## 7. Orquestador (`orchestrator.ts`)

### 7.1 Refactor: `buildWorkerDeps(deps)` en cada worker

Cada worker actual (`payment-verifier`, `draw-verifier`, `scrutiny-verifier`) construye sus `WorkerDeps` dentro de `main()`. Extraemos esa construcción a una función exportada:

```typescript
// En cada worker (ejemplo payment-verifier.ts):
export function buildWorkerDeps(deps: AppDeps): WorkerDeps {
  return {
    getPendingTickets: () => getPendingTickets(deps.db.db),
    markActive: (id) => markActive(deps.db.db, id),
    getReceived: (addr, minconf) => {
      const rpc = deps.env.FRACTAL_RPC_WALLET === "" ? deps.rpc : /* wallet transport */;
      return rpc.getReceivedByAddress(addr, minconf);
    },
    logger: deps.logger,
    minconf: deps.env.PAYMENT_MIN_CONFIRMATIONS,
  };
}
```

El `main()` de cada worker queda:
```typescript
async function main(): Promise<void> {
  const deps = buildDeps();
  runLoop(buildWorkerDeps(deps), deps.env.PAYMENT_CHECK_INTERVAL_MS);
}
```

### 7.2 `orchestrator.ts`

```typescript
async function main(): Promise<void> {
  const deps = buildDeps();

  const lifecycleDeps = buildLifecycleDeps(deps);
  const paymentDeps = buildWorkerDeps(deps); // payment
  const drawDeps = buildDrawDeps(deps);
  const scrutinyDeps = buildScrutinyDeps(deps);

  lifecycleLoop(lifecycleDeps, deps.env.LIFECYCLE_CHECK_INTERVAL_MS);
  paymentLoop(paymentDeps, deps.env.PAYMENT_CHECK_INTERVAL_MS);
  drawLoop(drawDeps, deps.env.DRAW_CHECK_INTERVAL_MS);
  scrutinyLoop(scrutinyDeps, deps.env.SCRUTINY_CHECK_INTERVAL_MS);

  deps.logger.info("orchestrator arrancado: 4 workers en paralelo");
}
```

- Script npm: `pnpm workers` → `tsx src/orchestrator.ts`.
- Shutdown: cada `runLoop` registra su propio SIGTERM/SIGINT handler que pone `stopping=true`. Como comparten `process`, la señal llega a todos. Cada worker hace `process.exit(0)` en su siguiente tick cuando detecta `stopping`.

---

## 8. Configuración

### Variables de entorno nuevas

```typescript
// --- Gestión de sorteos (Ciclo 7) ---
DURACION_SORTEO_BLOQUES: z.coerce.number().int().positive().default(144),
LIFECYCLE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
```

### `.env.example`

```bash
# --- Gestión de sorteos (Ciclo 7) ---
DURACION_SORTEO_BLOQUES=144
LIFECYCLE_CHECK_INTERVAL_MS=60000
```

---

## 9. Tests

### 9.1 Backend (con stubs)

**`services-sorteos.test.ts`** (~6 tests nuevos):
- `createSorteo` inserta con estado ABIERTO y bloqueCierre correcto.
- `getSorteoById` devuelve la fila o null.
- `getSorteoAbierto` devuelve el único ABIERTO o null.
- `getGanadores` devuelve lista (JOIN ganadores+tickets).
- `cerrarVencidos` cierra sorteos con bloque_cierre <= altura, devuelve count.
- `markPagado` actualiza pagado=true.

**`routes-sorteos.test.ts`** (~7 tests):
- POST /admin/sorteos → 201 con bloqueCierre = altura+DURACION.
- GET /sorteos/abierto → 200 o 404.
- GET /sorteos/:id → 200 o 404.
- GET /sorteos/:id/ganadores → 200 con lista.
- GET /jackpot → 200 con saldo.
- POST /admin/ganadores/:id/pagar → 200 o 404.

**`worker-lifecycle-verifier.test.ts`** (~3 tests):
- `runRound` cierra sorteos vencidos.
- Sin vencidos → `{0, 0}`.
- Error de RPC no mata el round.

**`orchestrator.test.ts`** (~1 test):
- `main()` construye los 4 WorkerDeps sin lanzar (con deps mock).

---

## 10. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `pnpm install` sin errores | OK |
| 2 | `pnpm --filter @myloto/backend typecheck` | Exit 0 |
| 3 | `pnpm --filter @myloto/backend test` | Todos pasan (~17 nuevos) |
| 4 | `pnpm -r test` | Todo verde |
| 5 | `pnpm -r typecheck` | Todo verde |
| 6 | GET /sorteos/abierto devuelve sorteo activo | Test de ruta |
| 7 | POST /admin/sorteos crea sorteo | Test de ruta |
| 8 | Worker lifecycle cierra sorteos | Test de worker |
| 9 | Orquestador arranca 4 workers | `pnpm workers` arranca sin error |
| 10 | Demo E2E | ⏳ Pendiente IBD |

---

## 11. Decisiones de Diseño Clave (resumen)

1. **Sin paquetes nuevos** — el dominio está completo en `packages/*` (config, db, rpc-client, crypto, brc20, payments, randomness, scrutiny, types). El Ciclo 7 es composición pura en el backend.

2. **4 workers en paralelo via orquestador** — cada worker es independiente, opera sobre su estado, sin coordinación explícita. El ciclo de vida fluye naturalmente: lifecycle cierra, draw calcula, scrutiny escruta. Como corren en paralelo, puede haber un delay de un intervalo entre transiciones, lo cual es aceptable.

3. **Refactor `buildWorkerDeps`** — extrae la construcción de WorkerDeps de cada `main()`. Permite reutilizar el wiring tanto en `main()` como en el orquestador. Mejora la testabilidad y reduce duplicación.

4. **POST /admin/sorteos calcula bloque_cierre automáticamente** — el operador no necesita saber la altura actual; el backend la consulta del nodo y suma DURACION_SORTEO_BLOQUES.

5. **Consolidación getActiveSorteo → getSorteoAbierto** — el Ciclo 4 creó `getActiveSorteo` (services/tickets.ts). El Ciclo 7 crea `getSorteoAbierto` (services/sorteos.ts) con la misma lógica. Se consolida: `getSorteoAbierto` reemplaza a `getActiveSorteo`, y `tickets.ts` actualiza su import.

6. **Pago manual sin FB automático** — el operador paga desde Sparrow y marca `pagado=true` via POST /admin/ganadores/:id/pagar. Sencillo, sin tocar llaves privadas en el backend.

7. **Shutdown unificado** — los 4 workers comparten `process` y capturan SIGTERM/SIGINT. Al recibir la señal, todos ponen `stopping=true` y hacen `process.exit(0)` en su siguiente tick.

---

## 12. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| 4 workers en paralelo consumen recursos | Baja | Bajo | Cada worker es liviano (1 query + N RPC calls por ronda). Node maneja fácil |
| Shutdown incompleto (un worker no detecta SIGTERM) | Baja | Bajo | Cada worker tiene su propio handler; timeout implícito del proceso |
| Endpoints /admin sin auth expuestos | Media (solo si backend expuesto públicamente) | Alto | Documentar: backend debe correr en localhost o detrás de proxy con auth. Ciclo 8 añade auth real |
| POST /admin/sorteos crea sorteo duplicado | Baja | Bajo | No hay constraint UNIQUE en bloque_cierre (dos sorteos pueden tener el mismo bloque). Aceptable: el operador controla la creación |
| getBlockCount falla al crear sorteo | Media (IBD) | Medio | El endpoint devuelve 500; el operador reintenta. No pierde datos |

---

## 13. Próximos Ciclos (Roadmap actualizado)

1. ✅ **Ciclo 1:** Fundación + Cliente RPC
2. ✅ **Ciclo 2:** Derivación HD + QR
3. ✅ **Ciclo 3:** `packages/brc20` — cliente UniSat + descuento
4. ✅ **Ciclo 4:** Motor de pagos híbrido + compra de tickets
5. ✅ **Ciclo 5:** Motor de aleatoriedad on-chain
6. ✅ **Ciclo 6:** Escrutinio y reparto de premios
7. 🔄 **Ciclo 7:** Backend completo — gestión de sorteos + orquestación (este spec)
8. **Ciclo 8:** Frontend Next.js — UI de selección, pago + QR, animación de sorteo, auth
