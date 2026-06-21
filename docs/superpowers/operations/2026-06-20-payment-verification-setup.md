# Setup del Nodo Fractal para Verificación de Pagos (Ciclo 4)

**Fecha:** 2026-06-20
**Ciclo:** 4
**Estado:** Setup completado; demo E2E pendiente hasta que el nodo termine IBD + rescan.

---

## Contexto

MYLoto verifica pagos de boletos consultando `getreceivedbyaddress` al nodo `fractald`. Cada boleto tiene una dirección Taproot única (derivada de la XPUB del operador). El problema: `getreceivedbyaddress` **solo funciona para direcciones que el nodo conoce** (están en uno de sus wallets).

Este documento describe cómo se configuró el nodo para que reconozca las direcciones de MYLoto, y los pasos para la demo E2E cuando el nodo esté listo.

---

## Por qué un wallet watch-only dedicado

Se probaron tres enfoques contra el nodo real. Los resultados:

| Método | Resultado | Razón |
|---|---|---|
| `importaddress` | ❌ `-4 Only legacy wallets are supported` | El wallet `fractal_main` es tipo **descriptor** |
| `importmulti` | ❌ `-4 Only legacy wallets are supported` | Mismo motivo |
| `importdescriptors` en `fractal_main` | ❌ `Cannot import descriptor without private keys to a wallet with private keys enabled` | `fractal_main` tiene llaves privadas; no permite watch-only |
| **`importdescriptors` en wallet dedicado** | ✅ **Funciona** | Wallet separado, sin llaves privadas, descriptor |

La solución estándar de Bitcoin Core: **crear un segundo wallet dedicado, sin llaves privadas**, donde se importa el descriptor de la XPUB. Este wallet solo observa — no puede gastar.

---

## Setup realizado (ya ejecutado en el nodo)

### 1. Wallet `myloto_watchonly` creado

```
createwallet "myloto_watchonly" true true "" false true false
                 ^               ^    ^     ^      ^    ^    ^
                 nombre          disable blank  passphrase avoid descriptors load_on_startup
                                 private       (sin passphrase)
                                 keys
```

- **`disable_private_keys: true`** → no puede generar ni gastar, solo observar.
- **`blank: true`** → empieza vacío, sin claves iniciales.
- **`descriptors: true`** → wallet moderno (compatible con `importdescriptors`).

### 2. Descriptor de la XPUB importado

```
tr(<XPUB_BIP86>/0/*)
```

- Importado con `importdescriptors`, `range: [0, 10000]` (cubre boletos 0-10000).
- `timestamp: "now"` + `rescan: false` → no busca transacciones históricas (las direcciones son nuevas, sin pagos previos).
- **Resultado:** verificado. `getreceivedbyaddress` reconoció la dirección del ticketId=1 y devolvió `0` (sin error `-4 Address not found`).

### 3. Configuración del backend

Variable `FRACTAL_RPC_WALLET=myloto_watchonly` en `.env`. El worker construye su propio `FractalRpcClient` con `walletName: "myloto_watchonly"`, así que `getreceivedbyaddress` consulta el wallet correcto. El servidor Fastify sigue usando el wallet por defecto (no necesita el watch-only).

---

## Verificación pendiente: demo E2E

El nodo está en proceso de **IBD (Initial Block Download) + rescan interno del wallet**. Mientras escanea, las llamadas RPC al wallet watch-only se bloquean (timeout). Cuando termine la sincronización (estimado: ~2 días), ejecutar:

### Paso 1: Confirmar que el nodo está listo

```bash
# Debe responder instantáneamente (no timeout)
bitcoin-cli -rpcwallet=myloto_watchonly getwalletinfo
# Verificar: scanning: false (o vacío)
```

### Paso 2: Confirmar que hay un sorteo ABIERTO en la DB

```sql
-- Conectarse a postgres (puerto 5433)
psql postgresql://myloto:myloto@localhost:5433/myloto

-- Si no hay sorteo ABIERTO, crear uno:
INSERT INTO sorteos (bloque_cierre, estado)
VALUES (244100, 'ABIERTO');
-- (bloque_cierre = altura actual + margen)
```

### Paso 3: Arrancar el backend

```bash
cd apps/backend
pnpm dev
# (o: pnpm tsx src/server.ts)
```

### Paso 4: Crear un boleto

```bash
curl -X POST http://localhost:3000/tickets \
  -H 'Content-Type: application/json' \
  -d '{"n1":5,"n2":17,"n3":23,"n4":42,"n5":60,"powerball":13}'
```

Respuesta esperada (201):
```json
{
  "id": 1,
  "sorteoId": ...,
  "status": "PENDIENTE",
  "expectedAmount": 100,
  "paymentAddress": "bc1p...",
  "bip21Uri": "bitcoin:bc1p...?amount=100",
  "qrSvg": "<svg ...>"
}
```

Anotar el `paymentAddress` y `expectedAmount`.

### Paso 5: Enviar FB al paymentAddress

Desde una wallet Fractal (Sparrow, UniSat, etc.), enviar `expectedAmount` FB (100) al `paymentAddress`. Esperar al menos 1 confirmación (~30s-2min en Fractal).

### Paso 6: Arrancar el worker

```bash
cd apps/backend
pnpm worker:payments
```

El worker consultará `getreceivedbyaddress` cada 30s (configurable). Cuando detecte el pago, logueará:
```
ticket activado { id: 1, received: 100 }
```

### Paso 7: Verificar el estado del boleto

```bash
curl http://localhost:3000/tickets/1
```

Respuesta esperada:
```json
{
  "id": 1,
  "status": "ACTIVO",
  ...
}
```

`status: "ACTIVO"` confirma que la transición `PENDIENTE → ACTIVO` funcionó end-to-end.

---

## Comandos de utilidad

```bash
# Listar wallets cargados en el nodo
bitcoin-cli listwallets

# Cargar el wallet watch-only (si no está cargado tras reinicio)
bitcoin-cli loadwallet myloto_watchonly

# Estado del rescan
bitcoin-cli -rpcwallet=myloto_watchonly getwalletinfo

# Si el descriptor necesita ampliarse (más de 10000 boletos):
bitcoin-cli -rpcwallet=myloto_watchonly importdescriptors '[{
  "desc": "tr(<XPUB>/0/*)#<checksum>",
  "timestamp": "now",
  "range": [0, 50000],
  "watchonly": true
}]'
```

---

## Notas de seguridad

- La XPUB es **pública por diseño** BIP86. Conocerla permite observar direcciones derivables pero **NO robar fondos** (para eso hace falta la llave privada, que nunca va al `.env` ni al nodo).
- El wallet `myloto_watchonly` no tiene llaves privadas — es imposible gastar desde él.
- Los FB recibidos en las direcciones de MYLoto se gastan con la llave privada del operador (fuera del nodo backend), en una wallet hardware/Sparrow.
