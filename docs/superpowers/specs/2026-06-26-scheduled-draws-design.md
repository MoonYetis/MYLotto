# Especificación: Sorteos Programados (3/semana, días fijos)

**Fecha:** 2026-06-26
**Proyecto:** MYLoto (lotería Powerball sobre Fractal Bitcoin)
**Scope:** Automatizar la creación de sorteos según un calendario semanal fijo (Lun/Jue/Sáb 20:00 Colombia) con cierre continuo, y mostrar cuenta regresiva en la home.

## 1. Contexto y problema

Actualmente los sorteos se crean **manualmente** vía `POST /admin/sorteos`. El sistema tiene workers implementados (lifecycle, payment, draw, scrutiny) que gestionan el ciclo `ABIERTO → CERRADO → CALCULADO → FINALIZADO`, pero:
- No hay automatización de creación de sorteos
- Los workers **no están corriendo en producción** (no hay servicios systemd para ellos)

Esto significa que hoy la lotería no opera de forma autónoma.

## 2. Decisiones de diseño (aprobadas en brainstorming)

| Aspecto | Decisión |
|---------|----------|
| Frecuencia | 3 sorteos/semana |
| Días | Lunes (ISO 1), Jueves (ISO 4), Sábado (ISO 6) |
| Hora | 20:00 hora Colombia (America/Bogota, UTC-5, sin DST) |
| Duración | Continua — siempre hay un sorteo ABIERTO |
| Patrón | Sáb 20:00 → Lun 20:00 → Jue 20:00 → Sáb 20:00 → ... |

**Patrón continuo:** Cuando cierra un sorteo a las 20:00, el siguiente abre inmediatamente. La gente puede comprar durante 2-3 días hasta el próximo cierre. Siempre hay exactamente un sorteo ABIERTO.

## 3. Arquitectura

### Nuevo worker: `schedule-worker.ts`

Sigue el patrón exacto de los workers existentes (`lifecycle-verifier.ts`):
- Función `runRound(deps)` exportada para tests
- Función `runLoop(deps, intervalMs)` con shutdown graceful (SIGTERM/SIGINT)
- Función `main()` que arranca si es el entrypoint (`isMain`)
- Función `buildScheduleDeps(deps)` que cablea dependencias reales

**Lógica de `runRound`:**
1. Verifica si ya existe un sorteo ABIERTO (`getActiveSorteo`)
2. Si existe → no hace nada (retorna `{ checked: 0, created: 0 }`)
3. Si NO existe → calcula el próximo día/hora de sorteo, estima el bloque de cierre, crea el sorteo
4. Retorna `{ checked: 1, created: 1 }`

**Manejo de concurrencia:** El `uniqueIndex` en `sorteos.bloque_cierre` previene duplicados. Si dos rondas intentan crear el mismo sorteo (ej. reinicio), la segunda falla con error de constraint y se loguea como "no fatal".

### Lógica de calendario: `schedule.ts`

**`getNextDrawTime(now: Date, days: number[], hour: number, timezone: string): Date`**

Dado el momento actual, devuelve el próximo Lun/Jue/Sáb 20:00 Colombia. Reglas:
- De los días `[1,4,6]`, encontrar el próximo a las 20:00
- Si hoy es uno de esos días y aún no son las 20:00 → hoy 20:00
- Si ya pasó la hora de hoy → el siguiente día hábil
- Iterar día por día hasta encontrar el próximo (máximo 7 iteraciones)

**Cálculo con timezone:** Usar `Intl.DateTimeFormat` con `timeZone: "America/Bogota"` para obtener componentes de fecha en hora Colombia sin librerías externas (Node 22 soporta `Temporal` parcialmente pero `Intl` es estable).

**`estimateBlockAtTime(targetTime: Date, currentHeight: number, currentTipTime: Date): number`**

Estima la altura de bloque para un momento futuro. Fórmula:
```
blocksUntilTarget = ceil((targetTime - currentTipTime) / BLOCK_TIME_MS)
return currentHeight + blocksUntilTarget
```
Donde `BLOCK_TIME_MS = 600_000` (10 min, promedio Fractal).

No es exacto (la dificultad puede variar), pero el `lifecycle-worker` cierra por **bloque real alcanzado**, así que una pequeña variación de minutos es aceptable.

### Configuración: `env.ts`

Añadir a `envSchema`:
```ts
// --- Scheduler de sorteos (calendario semanal) ---
SCHEDULE_DAYS: z.string().default("1,4,6"),        // ISO: 1=Lun, 4=Jue, 6=Sáb
SCHEDULE_HOUR: z.coerce.number().int().min(0).max(23).default(20),
SCHEDULE_TIMEZONE: z.string().default("America/Bogota"),
SCHEDULE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
BLOCK_TIME_MS: z.coerce.number().int().positive().default(600000),  // 10 min Fractal
```

`SCHEDULE_DAYS` es string (separado por comas) para flexibilidad — el operador puede cambiar los días sin recompilar.

## 4. Archivos a crear/modificar

### Crear
- `apps/backend/src/services/schedule.ts` — `getNextDrawTime`, `estimateBlockAtTime`
- `apps/backend/src/workers/schedule-worker.ts` — worker que crea sorteos automáticamente
- `apps/backend/src/test/schedule.test.ts` — tests del cálculo de calendario (TDD)
- `apps/web/src/lib/hooks.ts` — hook `useCountdown(blockCierre)` que estima tiempo restante

### Modificar
- `packages/config/src/env.ts` — añadir 5 variables de scheduler
- `apps/web/src/components/home/HeroSection.tsx` — mostrar cuenta regresiva al próximo sorteo
- `apps/web/src/lib/api.ts` — el endpoint `/sorteos/abierto` ya existe; opcionalmente añadir `bloqueActual` al response de `/health` para el cálculo

### NO tocar
- `lifecycle-verifier.ts`, `draw-verifier.ts`, `scrutiny-verifier.ts`, `payment-verifier.ts` — siguen funcionando igual
- `routes/sorteos.ts`, `routes/tickets.ts` — sin cambios
- Schema de DB — sin migraciones necesarias (reutiliza `sorteos` existente)

## 5. Cuenta regresiva en la home

La home actualmente muestra "⏱ Bloque 1,889,013" que no es intuitivo. Cambia a cuenta regresiva.

**Hook `useCountdown`:**
- Recibe `bloqueCierre` del sorteo activo
- Consulta `bloqueActual` periódicamente (vía `/health` que ya devuelve `node.blocks`)
- Calcula `bloquesRestantes = bloqueCierre - bloqueActual`
- Convierte a tiempo: `bloquesRestantes * BLOCK_TIME_MS`
- Formatea: "2d 4h 30m" o "4h 30m" o "30m" según corresponda
- Se actualiza cada 60s (no cada segundo — no es una cuenta regresiva nerviosa)

**Display en HeroSection:**
- Reemplaza `⏱ Bloque {sorteo.bloqueCierre}` con `⏱ Cierra en {countdown}`
- Si no hay sorteo activo: "Próximo sorteo: [día] 20:00" (usa `getNextDrawTime` replicado en frontend)

## 6. Despliegue: workers como servicios systemd

**Hallazgo:** Los workers existen pero NO corren en producción. Hay que crear servicios systemd para:

| Servicio | Worker | Función |
|----------|--------|---------|
| `myloto-schedule` | schedule-worker | Crea sorteos automáticamente |
| `myloto-lifecycle` | lifecycle-worker | Cierra sorteos vencidos |
| `myloto-payment` | payment-worker | Verifica pagos pendientes |
| `myloto-draw` | draw-worker | Calcula combinación ganadora |
| `myloto-scrutiny` | scrutiny-worker | Escruta ganadores |

Todos siguen el patrón del `myloto-backend.service` existente (User=nodo, WorkingDirectory, ExecStart con node, Restart=on-failure). Se habilitan con `systemctl enable` para arranque automático.

**Orden de arranque sugerido:** schedule → lifecycle → payment → draw → scrutiny (cada `After=` el anterior).

## 7. Consideraciones técnicas

- **Sin cron externo:** El scheduler es un worker Node con `setInterval`, no depende de `cron` del SO. Más portable y monitoreable.
- **Idempotencia:** Si el scheduler crea un sorteo y luego se reinicia, no crea duplicados (verifica `getActiveSorteo` primero + constraint unique).
- **Recovery:** Si el servidor estuvo caído varias horas y se perdió un horario, el scheduler crea el sorteo para el PRÓXIMO horario (no retroactivo).
- **Timezone:** `America/Bogota` no tiene DST, así que no hay saltos de horario.
- **Bloque estimado vs real:** El `bloqueCierre` es una estimación. El lifecycle-worker cierra cuando se ALCANZA ese bloque, así que si la red va más lenta, el sorteo cierra un poco después de las 20:00 (aceptable).

## 8. Criterios de aceptación

1. El scheduler crea un sorteo automáticamente cuando no hay ninguno ABIERTO y se alcanza un horario Lun/Jue/Sáb 20:00 Colombia.
2. Los tests de `getNextDrawTime` cubren: día hábil antes de la hora, día hábil después de la hora, día no hábil, wrap de semana (sábado → lunes).
3. Los 5 workers corren como servicios systemd y sobreviven reinicios.
4. La home muestra cuenta regresiva ("Cierra en 2d 4h 30m") en vez de número de bloque.
5. Si no hay sorteo activo, la home muestra el próximo horario programado.
6. El sistema es idempotente: reinicios no crean sorteos duplicados.
