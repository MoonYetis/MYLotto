# Diseño: Derivación HD + Generación de QR (Ciclo 2)

**Fecha:** 2026-06-19
**Ciclo:** 2 de 8
**Proyecto:** MYLoto — dApp de Lotería Powerball sobre Fractal Bitcoin
**Estado:** Aprobado por el usuario (pendiente de revisión final del documento)
**Depende de:** Ciclo 1 (`@myloto/config`, `@myloto/types`) — completado.

---

## 1. Contexto y Alcance

MYLoto usa una **pasarela de pago híbrida** (CONTEXTO MAESTRO §3): cada boleto recibe una dirección única de depósito en Fractal Bitcoin, derivada matemáticamente desde una clave pública maestra (XPUB) mediante BIP32. El servidor nunca almacena llaves privadas (Seguridad Fría). El frontend muestra la dirección y un código QR en formato BIP21.

### Objetivos de este ciclo

- Implementar `packages/crypto` con derivación HD BIP86 → direcciones **Taproot P2TR** (`bc1p...`).
- Validación exhaustiva del XPUB al instanciar (fail-fast).
- Generación de URIs BIP21 (`bitcoin:addr?amount=X`).
- Renderizado de códigos QR como strings SVG (librería `uqr` + SVG propio).
- Tests con **vectores oficiales BIP86** para garantizar interoperabilidad con wallets estándar.

### No incluye este ciclo (explícito)

- Persistencia de `payment_address` en la tabla `tickets` (Ciclo 4 — motor de pagos).
- Endpoint HTTP `/tickets/:id/payment-address` (Ciclo 4).
- Cron de verificación de depósitos con `getreceivedbyaddress` (Ciclo 4).
- Cálculo del monto según Hold-to-Earn (Ciclo 3 BRC-20 + Ciclo 4).
- Frontend (Ciclo 8).

---

## 2. Stack y Decisiones Consolidadas

| Decisión | Elección | Justificación |
|---|---|---|
| Tipo de dirección | **Taproot P2TR** (bech32m, `bc1p...`) | Estándar moderno, privacidad y fees óptimos, soporte en Fractal |
| Ruta de derivación | **BIP86**: `m/86'/0'/0'/0/ticketId` | Estándar de la industria para Taproot, interoperable |
| Red | **Mainnet** (`xpub` → `bc1p`) | El nodo reportó `chain=main` en Ciclo 1 |
| Validación XPUB | **Exhaustiva** (8 checks) | Estamos manejando dinero, defensa en profundidad |
| ticketId | **BIGSERIAL como índice** no-endurecido | Sin colisiones, DB es fuente de verdad |
| Límite de índice | `[1, 2^31-1]` | Rango no-endurecido BIP32 |
| Formato QR | **BIP21** `bitcoin:addr?amount=X` | Estándar universal de wallets |
| Render QR | **SVG string** | Escalable, sin canvas, óptimo móvil |
| Lib QR | **uqr + SVG propio** | Mínima dependencia, control total |
| Amount | **FB decimal normalizado** | El llamador pasa el monto, crypto solo formatea |
| Tests | **Vectores BIP86 oficiales + XPUB real** | Interoperabilidad garantizada |
| Arquitectura | **Clase `HdWallet` + funciones puras QR/BIP21** | Match con Ciclo 1, separación estado/puro |

### Librerías criptográficas (suite noble, ya elegida en Ciclo 1)

- `@scure/bip32` — derivación HD (BIP32) y `HDKey.fromExtendedKey()`.
- `@scure/base` — codificación bech32m (BIP350) y base58check.
- `@noble/curves` — secp256k1 para el Taproot tweak (X-only pubkey).
- `@noble/hashes` — hashes si se requieren.
- `uqr` — generación de matriz QR.
- `@myloto/config` — logger.

---

## 3. Estructura del Paquete

```
packages/crypto/
├── src/
│   ├── hd-wallet.ts        # Clase HdWallet: valida XPUB + deriveAddress(ticketId)
│   ├── bip21.ts            # buildBip21Uri(address, amount) — función pura
│   ├── qr-svg.ts           # renderQrSvg(content, opts?) — función pura
│   ├── errors.ts           # jerarquía CryptoError
│   └── index.ts            # exports públicos + generateTicketPayment()
├── test/
│   ├── unit/
│   │   ├── hd-wallet.test.ts     # vectores BIP86 oficiales (índices 0/1/2)
│   │   ├── bip21.test.ts
│   │   ├── qr-svg.test.ts
│   │   └── errors.test.ts
│   └── integration/
│       └── xpub.test.ts          # tests contra XPUB real (RUN_INTEGRATION=1)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── vitest.integration.config.ts
```

### Principios

- **`hd-wallet.ts`** — una sola responsabilidad: derivar direcciones Taproot desde XPUB BIP86.
- **`bip21.ts`** y **`qr-svg.ts`** — funciones puras sin estado, deterministas, testables sin instanciar.
- **`errors.ts`** — jerarquía para que el backend atrape con un solo `instanceof CryptoError`.
- **Sin dependencia** de `@myloto/db` ni `@myloto/rpc-client`. El paquete crypto es independiente.

---

## 4. `HdWallet` — Derivación BIP86

### 4.1 API

```typescript
export interface HdWalletOptions {
  /** XPUB en mainnet (empieza con "xpub"). Nivel m/86'/0'/0'. */
  xpub: string;
  /** Logger inyectable para tests. Default: createLogger("info", "crypto"). */
  logger?: Logger;
}

export interface DerivedAddress {
  /** "bc1p..." — Taproot P2TR, bech32m, 62 chars. */
  address: string;
  /** Ruta completa para auditoría/logs: "m/86'/0'/0'/0/<ticketId>". */
  path: string;
  /** Echo del ticketId de entrada. */
  index: number;
}

export class HdWallet {
  constructor(opts: HdWalletOptions);
  deriveAddress(ticketId: number): DerivedAddress;
}
```

### 4.2 Validación exhaustiva del XPUB (constructor, fail-fast)

1. **Tipo**: debe ser `string`. Si no → `InvalidXpubError`.
2. **Prefijo**: debe empezar con `xpub` (mainnet). Si no → `WrongNetworkXpubError`.
3. **Checksum base58check**: decode con `@scure/base`. Si falla → `InvalidXpubChecksumError`.
4. **Longitud decodificada**: 78 bytes (formato XPUB serializado BIP32). Si no → `MalformedXpubError`.
5. **Versión**: primeros 4 bytes decodificados deben ser `0x0488B21E` (`xpub`). Si no → `WrongXpubVersionError`.
6. **Profundidad**: byte offset 4 (depth). Para BIP86 nivel `m/86'/0'/0'`, depth debe ser **3**. Si no → `WrongBip86DepthError`.
7. **Clave pública**: bytes 45–78 (33 bytes compressed). `@scure/bip32` valida al hacer `HDKey.fromExtendedKey()` que es un punto secp256k1 válido.
8. **Parseo**: `HDKey.fromExtendedKey(xpub)` debe devolver un nodo no-null con `publicKey` de 33 bytes.

Si todo pasa, el HDNode se guarda en `private root`. El logger registra `"XPUB validado, profundidad=3"` sin exponer la clave.

### 4.3 `deriveAddress(ticketId)` — algoritmo

1. **Validar ticketId**: entero, `1 <= ticketId <= 2^31 - 1` (2.147.483.647). Si no → `InvalidTicketIdError`.
2. **Derivar dos niveles no-endurecidos**:
   ```typescript
   const changeChild = this.root.deriveChild(0);            // m/86'/0'/0'/0
   const ticketChild = changeChild.deriveChild(ticketId);   // m/86'/0'/0'/0/ticketId
   ```
3. **Extraer clave pública compressed** (33 bytes): `ticketChild.publicKey`.
4. **Taproot tweak (BIP341, key-path only, sin scripts)**:
   - Convertir compressed pubkey → coordenada X de 32 bytes + parity.
   - `tweakedKey = taprootTweak(pubkeyBytes, scriptPath=[])` — aplica el tweak de la curva.
   - Resultado: **X-only tweaked pubkey** (32 bytes), que es lo que se codifica en la dirección.
5. **Codificar bech32m (BIP350)**:
   ```typescript
   const address = encodeBech32m({
     hrp: "bc",                  // mainnet
     witver: 0x00,               // Taproot usa witver 0
     witness: tweakedKeyXOnly,   // 32 bytes
   });
   ```
6. **Devolver** `{ address, path: "m/86'/0'/0'/0/" + ticketId, index: ticketId }`.

### 4.4 Determinismo

La misma combinación XPUB + ticketId produce **siempre** la misma dirección. No hay aleatoriedad. Esto es crítico para que el cron de pagos (Ciclo 4) pueda regenerar la dirección y comprobar `getreceivedbyaddress` de forma consistente.

---

## 5. BIP21 + QR (funciones puras)

### 5.1 `buildBip21Uri(address, amount)`

```typescript
export function buildBip21Uri(address: string, amountMb: number): string;
```

**Validaciones:**
- `address`: parse con `@scure/base` bech32m, HRP `bc`, witver 0, witness 32 bytes. Si inválida → `MalformedAddressError`.
- `amountMb`: `Number.isFinite(amount) && amount > 0`. Sino → `InvalidAmountError`.

**Formateo del monto** (sin notación científica, sin trailing zeros):
- `0.001` → `"0.001"`
- `0.00100000` → `"0.001"` (zeros removidos)
- `1.0` → `"1"`
- `0.12345678` → `"0.12345678"` (8 decimales máximo, BTC/FB)

Implementación: `amount.toFixed(8).replace(/\.?0+$/, "")`.

**Output**: `` `bitcoin:${address}?amount=${formatted}` ``

**Ejemplo completo:**
```
Input:  ("bc1p...", 0.001)
Output: "bitcoin:bc1p...?amount=0.001"
```

### 5.2 `renderQrSvg(content, opts?)`

```typescript
export interface QrSvgOptions {
  /** Tamaño en píxeles del SVG. Default: 256. */
  size?: number;
  /** Color de los módulos oscuros. Default: "#000000". */
  darkColor?: string;
  /** Color de fondo. Default: "#ffffff". */
  lightColor?: string;
  /** Margen (quiet zone) en módulos. Default: 4 (especificación QR). */
  margin?: number;
}

export function renderQrSvg(content: string, opts?: QrSvgOptions): string;
```

**Algoritmo:**

1. **Validar input**: `content.length > 0` → `EmptyContentError`. Si excede 2953 bytes (capacidad máxima de QR v40 nivel L para datos alfanuméricos) → `ContentTooLongError`. En la práctica un BIP21 URI de boleto son ~75 chars, así que este límite nunca se alcanza, pero la validación protege contra usos futuros.
2. **Generar matriz con `uqr`**:
   ```typescript
   import { encode } from "uqr";
   const { data, size } = encode(content, { ecl: "medium" });
   // data: Uint8Array de size*size booleanos (1 = módulo oscuro)
   ```
3. **Construir SVG con paths optimizados** (no un `<rect>` por módulo):
   - `moduleSize = opts.size / (size + 2 * margin)`.
   - Recorrer filas; para cada run de módulos oscuros contiguos, emitir un comando `M x y h w v h h -w z` en un `<path>`.
   - Optimización reduce el tamaño del SVG ~60% vs un `<rect>` por módulo.
4. **Output**: SVG string completo con `viewBox`, `width`, `height`, fondo claro, y paths oscuros.

**Ejemplo (simplificado):**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" shape-rendering="crispEdges">
  <rect width="256" height="256" fill="#ffffff"/>
  <path fill="#000000" d="M0,0h8v8h-8zM16,0h8v8h-8z..."/>
</svg>
```

### 5.3 Función de conveniencia

```typescript
export function generateTicketPayment(opts: {
  wallet: HdWallet;
  ticketId: number;
  amountMb: number;
  qrOptions?: QrSvgOptions;
}): {
  address: string;
  bip21Uri: string;
  qrSvg: string;
  path: string;
};
```

Orquesta los 3 pasos (`deriveAddress` → `buildBip21Uri` → `renderQrSvg`) en una llamada para el consumidor final (Ciclo 4).

---

## 6. Errores Tipados

```typescript
// packages/crypto/src/errors.ts

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

// --- Errores de XPUB ---
export class InvalidXpubError extends CryptoError {}
export class WrongNetworkXpubError extends CryptoError {}       // "tpub" en vez de "xpub"
export class InvalidXpubChecksumError extends CryptoError {}    // base58check mal
export class MalformedXpubError extends CryptoError {}          // longitud != 78 bytes
export class WrongXpubVersionError extends CryptoError {}       // versión != 0x0488B21E
export class WrongBip86DepthError extends CryptoError {}        // depth != 3

// --- Errores de ticketId ---
export class InvalidTicketIdError extends CryptoError {}        // < 1 o > 2^31-1

// --- Errores de BIP21 ---
export class MalformedAddressError extends CryptoError {}        // bech32m inválido
export class InvalidAmountError extends CryptoError {}           // <= 0, NaN, Infinity

// --- Errores de QR ---
export class EmptyContentError extends CryptoError {}
export class ContentTooLongError extends CryptoError {}
```

Todas heredan de `CryptoError` → el backend hace un único `instanceof CryptoError` para atraparlas todas. El XPUB **nunca** se incluye en los mensajes de error (es sensible aunque público).

---

## 7. Tests

### 7.1 Unitarios — `hd-wallet.test.ts` (vectores BIP86 oficiales)

Usa los **vectores del BIP86** (https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki#test-vectors):

- XPUB de test (público): `xpub6BgBgspe...` (nivel `m/86'/0'/0'`).
- Índice 0 → `bc1p5cyxnuxmeUuv9fbyfNiT76TxWuXxv8un7...`
- Índice 1 → `bc1p4qhjn9z...`
- Índice 2 → `bc1p...`

Tests:
- `deriveAddress(0)`, `deriveAddress(1)`, `deriveAddress(2)` producen direcciones exactas del BIP86.
- **Determinismo**: dos llamadas al mismo índice → misma dirección.
- **Validación XPUB**: malformado, checkout, versión, depth, prefijo → error tipado correcto.
- **ticketId out of range**: `deriveAddress(0)` → `InvalidTicketIdError`; `deriveAddress(2^31)` → `InvalidTicketIdError`.

### 7.2 Unitarios — `bip21.test.ts` y `qr-svg.test.ts`

BIP21:
- `buildBip21Uri("bc1p...", 0.001)` → `"bitcoin:bc1p...?amount=0.001"`.
- Formateo: `1.0` → `"1"`, `0.00100000` → `"0.001"`, `0.12345678` → `"0.12345678"`.
- Errores: amount=0 → `InvalidAmountError`; addr inválida → `MalformedAddressError`.

QR:
- `renderQrSvg("test")` → string con `<svg`, `viewBox`, al menos un `<path>` o `<rect>`.
- `renderQrSvg("")` → `EmptyContentError`.
- `renderQrSvg("x".repeat(3000))` → `ContentTooLongError`.
- Customización: `size`, `darkColor`, `lightColor`, `margin` se respetan.

### 7.3 Integración — `xpub.test.ts` (tu XPUB real, `RUN_INTEGRATION=1`)

1. Carga `XPUB_BIP86` desde `.env`.
2. Instancia `HdWallet({ xpub })`.
3. XPUB pasa validación exhaustiva.
4. `deriveAddress(1)` y `deriveAddress(2)` → `bc1p...` de 62 chars sin excepción.
5. **Determinismo**: dos llamadas a `deriveAddress(1)` → misma dirección.
6. BIP21 + QR generados y válidos.

---

## 8. Integración con `@myloto/config`

### 8.1 Variable de entorno nueva

Añadir al schema Zod del Ciclo 1 (`packages/config/src/env.ts`):

```typescript
XPUB_BIP86: z.string().min(1).refine(s => s.startsWith("xpub"), {
  message: "XPUB_BIP86 debe empezar con 'xpub' (mainnet BIP86)",
}),
```

### 8.2 `.env.example`

```bash
# --- XPUB BIP86 (para derivar direcciones de boletos, nivel m/86'/0'/0') ---
XPUB_BIP86=xpub6BgBgspe...
```

### 8.3 Uso en backend (Ciclo 4, documentado aquí para contexto)

```typescript
const wallet = new HdWallet({ xpub: env.XPUB_BIP86 });
const { address, bip21Uri, qrSvg } = generateTicketPayment({
  wallet, ticketId: 1, amountMb: 0.001,
});
```

---

## 9. Entregables Verificables

| # | Entregable | Cómo se verifica |
|---|---|---|
| 1 | `pnpm install` sin errores | OK |
| 2 | `pnpm --filter @myloto/crypto typecheck` | Exit 0 |
| 3 | `pnpm --filter @myloto/crypto test` (vectores BIP86) | Índices 0/1/2 producen direcciones exactas |
| 4 | `RUN_INTEGRATION=1 pnpm --filter @myloto/crypto test:integration` | Tu XPUB real deriva `bc1p...` válidas |
| 5 | `pnpm -r test` (todos los paquetes) | Todo verde |
| 6 | `pnpm -r typecheck` (todos los paquetes) | Todo verde |
| 7 | Demo E2E: script que derive la dirección #1 de tu XPUB y genere el SVG del QR | Output visible (dirección + SVG string) |

---

## 10. Decisiones de Diseño Clave (resumen)

1. **Clase `HdWallet` separada de funciones QR** — el XPUB se valida una sola vez al arranque; las funciones de QR/BIP21 son puras y testables independientemente.
2. **BIP86 en vez de la ruta literal `m/0/ticketId` del spec** — el spec se actualizó tras analizar que Taproot requiere BIP86 para interoperabilidad; la intención original (recibir pagos en índices secuenciales) se preserva con `m/86'/0'/0'/0/ticketId`.
3. **Validación exhaustiva del XPUB** — 8 checks incluyendo depth=3 (BIP86), defensa en profundidad para manejo de dinero.
4. **`ticketId BIGSERIAL como índice`** — sin colisiones, DB es fuente de verdad, rango validado `[1, 2^31-1]`.
5. **Taproot tweak manual** — conversión de pubkey compressed → X-only tweaked, el punto donde más implementaciones fallan; los vectores BIP86 lo verifican.
6. **SVG con paths optimizados** (no rects) — reduce el tamaño del SVG ~60%, importante para móvil.
7. **Función de conveniencia `generateTicketPayment`** — orquesta los 3 pasos para el consumidor final.
8. **XPUB nunca en logs ni errores** — aunque sea público, mejor no filtrarlo.
9. **Vectores BIP86 oficiales** — garantía de interoperabilidad con cualquier wallet estándar.

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Taproot tweak implementado mal → dirección incorrecta | Media | Crítico (fondos perdidos) | Vectores BIP86 oficiales verifican exactitud |
| XPUB de profundidad equivocada (no nivel 3) | Media | Alto (derivación incorrecta) | Validación `WrongBip86DepthError` |
| `ticketId` excede `2^31-1` (muy improbable) | Baja | Medio | `InvalidTicketIdError` con rango explícito |
| `uqr` cambia API entre versiones | Baja | Bajo | Pin de versión + test del contrato |
| SVG demasiado grande para móviles lentos | Baja | Bajo | Paths optimizados, size default razonable |

---

## 12. Próximos Ciclos (Roadmap actualizado)

1. ✅ **Ciclo 1:** Fundación + Cliente RPC — **completado**
2. 🔄 **Ciclo 2:** `packages/crypto` — derivación HD + QR (este spec)
3. **Ciclo 3:** `packages/brc20` — cliente UniSat para validación de balance `Moonyetis`.
4. **Ciclo 4:** Motor de pagos híbrido — cron de verificación vía `getreceivedbyaddress`, estado `ACTIVO`, integración DB.
5. **Ciclo 5:** `packages/randomness` — motor on-chain Fisher-Yates, listener de bloques.
6. **Ciclo 6:** Escrutinio y reparto de premios.
7. **Ciclo 7:** Backend completo — endpoints de negocio, orquestación.
8. **Ciclo 8:** Frontend Next.js — UI de selección, pago + QR, animación de sorteo.
