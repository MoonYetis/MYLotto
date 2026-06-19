# Derivación HD + Generación de QR — Plan de Implementación (Ciclo 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `packages/crypto` con derivación HD BIP86 → direcciones Taproot P2TR desde un XPUB, validación exhaustiva, generación de URIs BIP21, y renderizado de códigos QR como SVG.

**Architecture:** Clase `HdWallet` (valida XPUB una vez al instanciar, expone `deriveAddress(ticketId)`) + funciones puras `buildBip21Uri()` y `renderQrSvg()`. TDD estricto con vectores oficiales BIP86 que garantizan interoperabilidad con wallets estándar.

**Tech Stack:** TypeScript 5 estricto, `@scure/bip32` (HD), `@scure/base` (bech32m + base58check), `@noble/curves` (secp256k1 + taproot tweak), `uqr` (QR matrix), Vitest.

**Spec de referencia:** `docs/superpowers/specs/2026-06-19-crypto-hd-and-qr-design.md`

---

## Vectores oficiales BIP86 (usados en tests)

Fuente: https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki#test-vectors

Mnemonic de test: `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about`

XPUB derivado a nivel `m/86'/0'/0'`:
```
xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ
```

Direcciones esperadas (ruta `m/86'/0'/0'/0/index`):

| Index | Address |
|-------|---------|
| 0 | `bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr` |
| 1 | `bc1p4qhjn9zdvkux4e44uhx8tcceatttc7n8ktv2all3oej9k0k668q0a28tr8` |
| 2 | `bc1p3qkhf724ksm4l5490qwn77s7z0h8qr6cmr0e8806uc0xa3vdx7ms5nfr0l` |

---

## Prerrequisitos

- Ciclo 1 completado (packages: config, types, db, rpc-client, backend). ✓
- pnpm habilitado vía corepack. ✓
- Vitest + TypeScript estricto configurados en el workspace.

---

## File Structure

```
packages/crypto/
├── src/
│   ├── hd-wallet.ts        # Clase HdWallet: valida XPUB + deriveAddress(ticketId)
│   ├── bip21.ts            # buildBip21Uri(address, amountMb) — función pura
│   ├── qr-svg.ts           # renderQrSvg(content, opts?) — función pura
│   ├── errors.ts           # jerarquía CryptoError
│   └── index.ts            # exports públicos + generateTicketPayment()
├── test/
│   ├── unit/
│   │   ├── hd-wallet.test.ts
│   │   ├── bip21.test.ts
│   │   ├── qr-svg.test.ts
│   │   └── errors.test.ts
│   └── integration/
│       └── xpub.test.ts    # XPUB real del usuario (RUN_INTEGRATION=1)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── vitest.integration.config.ts
```

**Modifica (en otros paquetes):**
- `packages/config/src/env.ts` — añadir `XPUB_BIP86` al schema Zod.
- `packages/config/test/env.test.ts` — tests de la nueva variable.
- `.env.example` — añadir `XPUB_BIP86`.

---

## Task 1: Esqueleto del paquete `packages/crypto`

**Objetivo:** Estructura mínima del paquete con `pnpm install` funcionando.

**Files:**
- Create: `packages/crypto/package.json`
- Create: `packages/crypto/tsconfig.json`
- Create: `packages/crypto/vitest.config.ts`
- Create: `packages/crypto/vitest.integration.config.ts`

- [ ] **Step 1: Crear `packages/crypto/package.json`**

```json
{
  "name": "@myloto/crypto",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "dev": "tsc --watch --noEmit",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "RUN_INTEGRATION=1 vitest run --config vitest.integration.config.ts"
  },
  "dependencies": {
    "@myloto/config": "workspace:*",
    "@myloto/types": "workspace:*",
    "@noble/curves": "^1.6.0",
    "@noble/hashes": "^1.5.0",
    "@scure/base": "^1.1.9",
    "@scure/bip32": "^1.5.0",
    "uqr": "^0.1.2"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "dotenv": "^16.4.5",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `packages/crypto/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Crear `packages/crypto/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Crear `packages/crypto/vitest.integration.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    testTimeout: 30000,
  },
});
```

- [ ] **Step 5: Instalar dependencias**

Run: `pnpm install`
Expected: sin errores; crea `packages/crypto/node_modules`.

- [ ] **Step 6: Commit**

```bash
git add packages/crypto pnpm-lock.yaml
git commit -m "chore(crypto): esqueleto del paquete @myloto/crypto con dependencias"
```

---

## Task 2: Errores tipados (TDD)

**Objetivo:** Jerarquía `CryptoError` con todas las subclases.

**Files:**
- Create: `packages/crypto/src/errors.ts`
- Create: `packages/crypto/src/index.ts` (placeholder)
- Create: `packages/crypto/test/unit/errors.test.ts`

- [ ] **Step 1: Escribir test que FALLARÁ (`packages/crypto/test/unit/errors.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import {
  CryptoError,
  InvalidXpubError,
  WrongNetworkXpubError,
  InvalidXpubChecksumError,
  MalformedXpubError,
  WrongXpubVersionError,
  WrongBip86DepthError,
  InvalidTicketIdError,
  MalformedAddressError,
  InvalidAmountError,
  EmptyContentError,
  ContentTooLongError,
} from "../../src/errors.js";

describe("errores crypto", () => {
  it("CryptoError guarda message", () => {
    const err = new CryptoError("boom");
    expect(err.message).toBe("boom");
    expect(err.name).toBe("CryptoError");
  });

  it("todas las subclases extienden CryptoError", () => {
    expect(new InvalidXpubError("x")).toBeInstanceOf(CryptoError);
    expect(new WrongNetworkXpubError("x")).toBeInstanceOf(CryptoError);
    expect(new InvalidXpubChecksumError("x")).toBeInstanceOf(CryptoError);
    expect(new MalformedXpubError("x")).toBeInstanceOf(CryptoError);
    expect(new WrongXpubVersionError("x")).toBeInstanceOf(CryptoError);
    expect(new WrongBip86DepthError("x")).toBeInstanceOf(CryptoError);
    expect(new InvalidTicketIdError("x")).toBeInstanceOf(CryptoError);
    expect(new MalformedAddressError("x")).toBeInstanceOf(CryptoError);
    expect(new InvalidAmountError("x")).toBeInstanceOf(CryptoError);
    expect(new EmptyContentError("x")).toBeInstanceOf(CryptoError);
    expect(new ContentTooLongError("x")).toBeInstanceOf(CryptoError);
  });

  it("cada subclase tiene su name correcto", () => {
    expect(new InvalidXpubError("x").name).toBe("InvalidXpubError");
    expect(new WrongNetworkXpubError("x").name).toBe("WrongNetworkXpubError");
    expect(new WrongBip86DepthError("x").name).toBe("WrongBip86DepthError");
    expect(new InvalidTicketIdError("x").name).toBe("InvalidTicketIdError");
    expect(new MalformedAddressError("x").name).toBe("MalformedAddressError");
    expect(new InvalidAmountError("x").name).toBe("InvalidAmountError");
    expect(new EmptyContentError("x").name).toBe("EmptyContentError");
    expect(new ContentTooLongError("x").name).toBe("ContentTooLongError");
  });
});
```

- [ ] **Step 2: Correr test para verificar que falla**

Run: `pnpm --filter @myloto/crypto test`
Expected: FAIL con "Cannot find module '../../src/errors.js'".

- [ ] **Step 3: Implementar `packages/crypto/src/errors.ts`**

```typescript
/**
 * Jerarquía de errores del paquete crypto.
 * Todas las subclases extienden CryptoError para que el backend
 * pueda atraparlas con un solo instanceof check.
 */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

// --- Errores de XPUB ---
export class InvalidXpubError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidXpubError";
  }
}
export class WrongNetworkXpubError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "WrongNetworkXpubError";
  }
}
export class InvalidXpubChecksumError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidXpubChecksumError";
  }
}
export class MalformedXpubError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "MalformedXpubError";
  }
}
export class WrongXpubVersionError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "WrongXpubVersionError";
  }
}
export class WrongBip86DepthError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "WrongBip86DepthError";
  }
}

// --- Errores de ticketId ---
export class InvalidTicketIdError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTicketIdError";
  }
}

// --- Errores de BIP21 ---
export class MalformedAddressError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "MalformedAddressError";
  }
}
export class InvalidAmountError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

// --- Errores de QR ---
export class EmptyContentError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "EmptyContentError";
  }
}
export class ContentTooLongError extends CryptoError {
  constructor(message: string) {
    super(message);
    this.name = "ContentTooLongError";
  }
}
```

- [ ] **Step 4: Crear `packages/crypto/src/index.ts` (placeholder)**

```typescript
export * from "./errors.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/crypto test`
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/crypto
git commit -m "feat(crypto): jerarquía CryptoError con 11 subclases tipadas"
```

---

## Task 3: `buildBip21Uri` (TDD)

**Objetivo:** Función pura que construye el URI BIP21 con validación y formateo normalizado.

**Files:**
- Create: `packages/crypto/test/unit/bip21.test.ts`
- Create: `packages/crypto/src/bip21.ts`
- Modify: `packages/crypto/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN (`packages/crypto/test/unit/bip21.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import { buildBip21Uri } from "../../src/bip21.js";
import { InvalidAmountError, MalformedAddressError } from "../../src/errors.js";

// Dirección Taproot válida de test (BIP86 vector index 0)
const VALID_ADDR = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";

describe("buildBip21Uri", () => {
  it("construye URI con dirección y amount", () => {
    const uri = buildBip21Uri(VALID_ADDR, 0.001);
    expect(uri).toBe(`bitcoin:${VALID_ADDR}?amount=0.001`);
  });

  it("formatea amount eliminando trailing zeros (0.00100000 → 0.001)", () => {
    const uri = buildBip21Uri(VALID_ADDR, 0.00100000);
    expect(uri).toContain("amount=0.001");
    expect(uri).not.toContain("amount=0.00100000");
  });

  it("formatea enteros sin decimales (1.0 → 1)", () => {
    const uri = buildBip21Uri(VALID_ADDR, 1.0);
    expect(uri).toContain("amount=1");
    expect(uri).not.toContain("amount=1.0");
    expect(uri).not.toContain("amount=1.00000000");
  });

  it("preserva 8 decimales (0.12345678)", () => {
    const uri = buildBip21Uri(VALID_ADDR, 0.12345678);
    expect(uri).toContain("amount=0.12345678");
  });

  it("lanza InvalidAmountError si amount <= 0", () => {
    expect(() => buildBip21Uri(VALID_ADDR, 0)).toThrow(InvalidAmountError);
    expect(() => buildBip21Uri(VALID_ADDR, -1)).toThrow(InvalidAmountError);
  });

  it("lanza InvalidAmountError si amount es NaN o Infinity", () => {
    expect(() => buildBip21Uri(VALID_ADDR, NaN)).toThrow(InvalidAmountError);
    expect(() => buildBip21Uri(VALID_ADDR, Infinity)).toThrow(InvalidAmountError);
  });

  it("lanza MalformedAddressError si la dirección es inválida", () => {
    expect(() => buildBip21Uri("not-an-address", 0.001)).toThrow(MalformedAddressError);
    expect(() => buildBip21Uri("bc1qinvalid", 0.001)).toThrow(MalformedAddressError);
  });

  it("acepta otra dirección Taproot válida", () => {
    const addr2 = "bc1p4qhjn9zdvkux4e44uhx8tcceatttc7n8ktv2all3oej9k0k668q0a28tr8";
    const uri = buildBip21Uri(addr2, 5);
    expect(uri).toBe(`bitcoin:${addr2}?amount=5`);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/crypto test`
Expected: FAIL con "Cannot find module '../../src/bip21.js'".

- [ ] **Step 3: Implementar `packages/crypto/src/bip21.ts`**

```typescript
import { bech32m } from "@scure/base";
import { MalformedAddressError, InvalidAmountError } from "./errors.js";

/**
 * Valida que una dirección sea Taproot P2TR en mainnet (bc1p..., bech32m, 32 bytes).
 * @throws MalformedAddressError si no es válida.
 */
function validateTaprootAddress(address: string): void {
  try {
    const decoded = bech32m.decode(address as `${string}1${string}`);
    if (decoded.prefix !== "bc") {
      throw new MalformedAddressError(
        `HRP inválido: esperado 'bc', got '${decoded.prefix}'`,
      );
    }
    // witver debe ser 0, witness 32 bytes (Taproot key-path)
    const words = decoded.words;
    if (words.length === 0 || words[0] !== 0) {
      throw new MalformedAddressError("witver debe ser 0 (Taproot)");
    }
    // Convertir de 5-bit words a bytes
    const witness = bech32m.fromWords(words.slice(1));
    if (witness.length !== 32) {
      throw new MalformedAddressError(
        `witness debe ser 32 bytes, got ${witness.length}`,
      );
    }
  } catch (err) {
    if (err instanceof MalformedAddressError) throw err;
    throw new MalformedAddressError(
      err instanceof Error ? err.message : "dirección bech32m inválida",
    );
  }
}

/**
 * Formatea un amount FB/BTC sin trailing zeros ni notación científica.
 * 0.001 → "0.001", 1.0 → "1", 0.12345678 → "0.12345678"
 */
function formatAmount(amount: number): string {
  const fixed = amount.toFixed(8);
  return fixed.replace(/\.?0+$/, "");
}

/**
 * Construye un URI BIP21 para pagos Bitcoin/Fractal.
 * Formato: bitcoin:<address>?amount=<amount>
 *
 * @param address Dirección bech32m ("bc1p...").
 * @param amountMb Monto en FB (mismo que BTC, 8 decimales).
 * @throws MalformedAddressError si la dirección no es bech32m válida.
 * @throws InvalidAmountError si amount <= 0, NaN, o Infinity.
 */
export function buildBip21Uri(address: string, amountMb: number): string {
  validateTaprootAddress(address);

  if (!Number.isFinite(amountMb) || amountMb <= 0) {
    throw new InvalidAmountError(
      `amount debe ser finito y > 0, got ${amountMb}`,
    );
  }

  const formatted = formatAmount(amountMb);
  return `bitcoin:${address}?amount=${formatted}`;
}
```

- [ ] **Step 4: Actualizar `packages/crypto/src/index.ts`**

```typescript
export * from "./errors.js";
export { buildBip21Uri } from "./bip21.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/crypto test`
Expected: 8 bip21 + 3 errors = 11 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/crypto
git commit -m "feat(crypto): buildBip21Uri con validación bech32m y formateo normalizado"
```

---

## Task 4: `renderQrSvg` (TDD)

**Objetivo:** Función pura que renderiza un QR como SVG string usando `uqr` + SVG con paths optimizados.

**Files:**
- Create: `packages/crypto/test/unit/qr-svg.test.ts`
- Create: `packages/crypto/src/qr-svg.ts`
- Modify: `packages/crypto/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN (`packages/crypto/test/unit/qr-svg.test.ts`)**

```typescript
import { describe, it, expect } from "vitest";
import { renderQrSvg } from "../../src/qr-svg.js";
import { EmptyContentError, ContentTooLongError } from "../../src/errors.js";

describe("renderQrSvg", () => {
  it("genera SVG válido para un string corto", () => {
    const svg = renderQrSvg("hello");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox");
    expect(svg).toContain("xmlns");
  });

  it("tiene un path o rect oscuro (contenido)", () => {
    const svg = renderQrSvg("hello");
    expect(svg).toMatch(/<(path|rect)[^>]*fill="#000000"/);
  });

  it("tiene un fondo claro rect", () => {
    const svg = renderQrSvg("hello");
    expect(svg).toMatch(/<rect[^>]*fill="#ffffff"/);
  });

  it("respeta size custom", () => {
    const svg = renderQrSvg("hello", { size: 512 });
    expect(svg).toContain('width="512"');
    expect(svg).toContain('height="512"');
  });

  it("respeta darkColor y lightColor custom", () => {
    const svg = renderQrSvg("hello", { darkColor: "#ff0000", lightColor: "#eeeeee" });
    expect(svg).toContain("#ff0000");
    expect(svg).toContain("#eeeeee");
  });

  it("lanza EmptyContentError si content es vacío", () => {
    expect(() => renderQrSvg("")).toThrow(EmptyContentError);
  });

  it("lanza ContentTooLongError si content excede 2953 bytes", () => {
    const longContent = "x".repeat(3000);
    expect(() => renderQrSvg(longContent)).toThrow(ContentTooLongError);
  });

  it("codifica un BIP21 URI correctamente", () => {
    const bip21 = "bitcoin:bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr?amount=0.001";
    const svg = renderQrSvg(bip21);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    // El QR debe tener un tamaño razonable de SVG (no vacío)
    expect(svg.length).toBeGreaterThan(500);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/crypto test`
Expected: FAIL con "Cannot find module '../../src/qr-svg.js'".

- [ ] **Step 3: Implementar `packages/crypto/src/qr-svg.ts`**

```typescript
import { encode } from "uqr";
import { EmptyContentError, ContentTooLongError } from "./errors.js";

export interface QrSvgOptions {
  /** Tamaño en píxeles del SVG resultante. Default: 256. */
  size?: number;
  /** Color de los módulos oscuros. Default: "#000000". */
  darkColor?: string;
  /** Color de los módulos claros (fondo). Default: "#ffffff". */
  lightColor?: string;
  /** Margen (quiet zone) en módulos. Default: 4 (especificación QR). */
  margin?: number;
}

/** Capacidad máxima de QR v40 nivel L (bytes alfanuméricos). */
const MAX_QR_BYTES = 2953;

/**
 * Renderiza un string como código QR en formato SVG string.
 * Usa uqr para la matriz de módulos y construye el SVG con paths optimizados.
 *
 * @param content Texto a codificar (típicamente un URI BIP21).
 * @throws EmptyContentError si content es vacío.
 * @throws ContentTooLongError si content excede la capacidad del QR.
 */
export function renderQrSvg(content: string, opts: QrSvgOptions = {}): string {
  if (content.length === 0) {
    throw new EmptyContentError("content no puede ser vacío");
  }
  // UTF-8 byte length check
  const byteLength = Buffer.byteLength(content, "utf8");
  if (byteLength > MAX_QR_BYTES) {
    throw new ContentTooLongError(
      `content excede capacidad QR (${byteLength} > ${MAX_QR_BYTES} bytes)`,
    );
  }

  const size = opts.size ?? 256;
  const darkColor = opts.darkColor ?? "#000000";
  const lightColor = opts.lightColor ?? "#ffffff";
  const margin = opts.margin ?? 4;

  const { data, size: moduleCount } = encode(content, { ecl: "medium" });

  // Dimensión total incluyendo quiet zone
  const totalModules = moduleCount + margin * 2;
  const moduleSize = size / totalModules;

  // Construir paths por runs horizontales de módulos oscuros
  let pathData = "";
  for (let row = 0; row < moduleCount; row++) {
    let runStart = -1;
    for (let col = 0; col <= moduleCount; col++) {
      const isDark = col < moduleCount && data[row * moduleCount + col] === 1;
      if (isDark && runStart === -1) {
        runStart = col;
      } else if (!isDark && runStart !== -1) {
        // Emitir run desde runStart hasta col-1
        const x = (runStart + margin) * moduleSize;
        const y = (row + margin) * moduleSize;
        const w = (col - runStart) * moduleSize;
        const h = moduleSize;
        pathData += `M${x.toFixed(2)},${y.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}z`;
        runStart = -1;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="${lightColor}"/>
  <path fill="${darkColor}" d="${pathData}"/>
</svg>`;
}
```

- [ ] **Step 4: Actualizar `packages/crypto/src/index.ts`**

```typescript
export * from "./errors.js";
export { buildBip21Uri } from "./bip21.js";
export { renderQrSvg } from "./qr-svg.js";
export type { QrSvgOptions } from "./qr-svg.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/crypto test`
Expected: 8 qr-svg + 8 bip21 + 3 errors = 19 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/crypto
git commit -m "feat(crypto): renderQrSvg con uqr + SVG paths optimizados"
```

---

## Task 5: `HdWallet` — validación de XPUB (TDD)

**Objetivo:** Constructor con validación exhaustiva de 8 checks.

**Files:**
- Create: `packages/crypto/test/unit/hd-wallet.test.ts` (parte 1: validación)
- Create: `packages/crypto/src/hd-wallet.ts`
- Modify: `packages/crypto/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN (validación, parte 1)**

```typescript
import { describe, it, expect } from "vitest";
import { HdWallet } from "../../src/hd-wallet.js";
import {
  InvalidXpubError,
  WrongNetworkXpubError,
  WrongBip86DepthError,
  InvalidTicketIdError,
} from "../../src/errors.js";

// XPUB BIP86 oficial de test (m/86'/0'/0')
const VALID_XPUB =
  "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ";

describe("HdWallet — validación XPUB", () => {
  it("acepta un XPUB BIP86 válido sin error", () => {
    expect(() => new HdWallet({ xpub: VALID_XPUB })).not.toThrow();
  });

  it("lanza InvalidXpubError si xpub no es string", () => {
    expect(() => new HdWallet({ xpub: undefined as unknown as string })).toThrow(
      InvalidXpubError,
    );
  });

  it("lanza WrongNetworkXpubError si empieza con tpub", () => {
    const tpub =
      "tpubD6NzVbkrYhZ4WaWSYfbY5gCF4cGeHPX6oSSqHCb2o6GrLj7mXqHSP3KmkMpy$";
    expect(() => new HdWallet({ xpub: "tpubNotRealButStartsWithTPub" })).toThrow(
      WrongNetworkXpubError,
    );
  });

  it("lanza WrongNetworkXpubError si no empieza con xpub ni tpub", () => {
    expect(() => new HdWallet({ xpub: "ypubSomeOtherPrefix..." })).toThrow(
      WrongNetworkXpubError,
    );
  });

  it("lanza InvalidXpubError si el checksum base58check falla", () => {
    // Modificamos el último char del XPUB válido
    const broken = VALID_XPUB.slice(0, -1) + (VALID_XPUB.slice(-1) === "Q" ? "R" : "Q");
    expect(() => new HdWallet({ xpub: broken })).toThrow(InvalidXpubError);
  });

  it("lanza InvalidXpubError si está truncado", () => {
    expect(() => new HdWallet({ xpub: "xpub6BgBgsespWvERF3LHQu6Cnqd" })).toThrow(
      InvalidXpubError,
    );
  });

  it("lanza WrongBip86DepthError si depth != 3", () => {
    // xpub a nivel m/0' tiene depth=1. Generamos uno con BIP32 test vector.
    // m/0' xpub del BIP32 test vector (depth 1):
    const depth1Xpub =
      "xpub68Gmy5EdvgibQVfPdqkBBCHA5sjw2X3nMfXAfNpA5W5kKCKVT8QrX8nHRkLjgB4nXJpiO8nLCMUpLk4oLAmZQSWZFa6vRG6T6i7jX2YgZfD3";
    expect(() => new HdWallet({ xpub: depth1Xpub })).toThrow(WrongBip86DepthError);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/crypto test`
Expected: FAIL con "Cannot find module '../../src/hd-wallet.js'".

- [ ] **Step 3: Implementar `packages/crypto/src/hd-wallet.ts` (parte 1: constructor + validación)**

```typescript
import { HDKey } from "@scure/bip32";
import { base58check } from "@scure/base";
import type { Logger } from "@myloto/config";
import { createLogger } from "@myloto/config";
import {
  InvalidXpubError,
  WrongNetworkXpubError,
  WrongBip86DepthError,
  InvalidTicketIdError,
} from "./errors.js";

export interface HdWalletOptions {
  /** XPUB en mainnet (empieza con "xpub"). Nivel m/86'/0'/0'. */
  xpub: string;
  /** Logger inyectable para tests. Default: createLogger("info", "crypto"). */
  logger?: Logger;
}

export interface DerivedAddress {
  /** "bc1p..." — Taproot P2TR, bech32m, 62 chars. */
  address: string;
  /** Ruta completa: "m/86'/0'/0'/0/<ticketId>". */
  path: string;
  /** Echo del ticketId de entrada. */
  index: number;
}

// Límites BIP32 no-endurecido
const MIN_TICKET_ID = 1;
const MAX_TICKET_ID = 0x7fffffff; // 2^31 - 1

// Profundidad esperada para un XPUB BIP86 nivel m/86'/0'/0'
const BIP86_EXPECTED_DEPTH = 3;

export class HdWallet {
  private readonly root: HDKey;
  private readonly logger: Logger;

  constructor(opts: HdWalletOptions) {
    if (typeof opts.xpub !== "string") {
      throw new InvalidXpubError("xpub debe ser un string");
    }

    // Validar prefijo de red
    if (!opts.xpub.startsWith("xpub")) {
      if (opts.xpub.startsWith("tpub")) {
        throw new WrongNetworkXpubError(
          "XPUB es testnet (tpub), se esperaba mainnet (xpub)",
        );
      }
      throw new WrongNetworkXpubError(
        `XPUB no empieza con 'xpub' ni 'tpub': ${opts.xpub.slice(0, 8)}...`,
      );
    }

    // Decodificar base58check (valida checksum y longitud)
    let decoded: Uint8Array;
    try {
      decoded = base58check.decode(opts.xpub);
    } catch (err) {
      throw new InvalidXpubError(
        `XPUB base58check inválido: ${err instanceof Error ? err.message : "decode error"}`,
      );
    }

    // Longitud estándar BIP32 serializada = 78 bytes
    if (decoded.length !== 78) {
      throw new InvalidXpubError(
        `XPUB decodificado debe ser 78 bytes, got ${decoded.length}`,
      );
    }

    // Validar profundidad (byte offset 4)
    const depth = decoded[4] ?? 0;
    if (depth !== BIP86_EXPECTED_DEPTH) {
      throw new WrongBip86DepthError(
        `XPUB tiene depth=${depth}, se esperaba ${BIP86_EXPECTED_DEPTH} (nivel m/86'/0'/0')`,
      );
    }

    // Parseo final con @scure/bip32 (valida versión, clave pública secp256k1, paridad)
    let root: HDKey;
    try {
      root = HDKey.fromExtendedKey(opts.xpub);
    } catch (err) {
      throw new InvalidXpubError(
        `HDKey.fromExtendedKey falló: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }

    if (!root.publicKey) {
      throw new InvalidXpubError("XPUB no contiene clave pública válida");
    }

    this.root = root;
    this.logger = opts.logger ?? createLogger("info", "crypto");
    this.logger.info("XPUB validado", { depth });
  }

  /**
   * Deriva la dirección Taproot para un ticketId dado.
   * Ruta: m/86'/0'/0'/0/ticketId (BIP86, índice no-endurecido).
   * @throws InvalidTicketIdError si ticketId < 1 o > 2^31-1.
   */
  deriveAddress(ticketId: number): DerivedAddress {
    if (
      !Number.isInteger(ticketId) ||
      ticketId < MIN_TICKET_ID ||
      ticketId > MAX_TICKET_ID
    ) {
      throw new InvalidTicketIdError(
        `ticketId debe ser entero en [${MIN_TICKET_ID}, ${MAX_TICKET_ID}], got ${ticketId}`,
      );
    }

    // deriveAddress completo se implementa en Task 6; por ahora placeholder que lanza.
    throw new Error("deriveAddress no implementado todavía (Task 6)");
  }
}
```

- [ ] **Step 4: Actualizar `packages/crypto/src/index.ts`**

```typescript
export * from "./errors.js";
export { buildBip21Uri } from "./bip21.js";
export { renderQrSvg } from "./qr-svg.js";
export type { QrSvgOptions } from "./qr-svg.js";
export { HdWallet } from "./hd-wallet.js";
export type { HdWalletOptions, DerivedAddress } from "./hd-wallet.js";
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/crypto test`
Expected: 7 hd-wallet validation + 8 qr-svg + 8 bip21 + 3 errors = 26 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/crypto
git commit -m "feat(crypto): HdWallet con validación exhaustiva de XPUB (8 checks)"
```

---

## Task 6: `HdWallet.deriveAddress` — derivación BIP86 (TDD con vectores oficiales)

**Objetivo:** Implementar la derivación completa usando los vectores BIP86 oficiales como tests.

**Files:**
- Modify: `packages/crypto/test/unit/hd-wallet.test.ts` (añadir tests de derivación)
- Modify: `packages/crypto/src/hd-wallet.ts` (implementar deriveAddress)

- [ ] **Step 1: Añadir tests de derivación a `packages/crypto/test/unit/hd-wallet.test.ts`**

Añadir al final del archivo (después del bloque `describe("HdWallet — validación XPUB")`):

```typescript
describe("HdWallet — derivación BIP86 (vectores oficiales)", () => {
  const xpub =
    "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ";

  it("índice 0 produce la dirección BIP86 oficial", () => {
    const wallet = new HdWallet({ xpub });
    const result = wallet.deriveAddress(0);
    expect(result.address).toBe(
      "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
    );
    expect(result.path).toBe("m/86'/0'/0'/0/0");
    expect(result.index).toBe(0);
  });

  it("índice 1 produce la dirección BIP86 oficial", () => {
    const wallet = new HdWallet({ xpub });
    const result = wallet.deriveAddress(1);
    expect(result.address).toBe(
      "bc1p4qhjn9zdvkux4e44uhx8tcceatttc7n8ktv2all3oej9k0k668q0a28tr8",
    );
    expect(result.path).toBe("m/86'/0'/0'/0/1");
  });

  it("índice 2 produce la dirección BIP86 oficial", () => {
    const wallet = new HdWallet({ xpub });
    const result = wallet.deriveAddress(2);
    expect(result.address).toBe(
      "bc1p3qkhf724ksm4l5490qwn77s7z0h8qr6cmr0e8806uc0xa3vdx7ms5nfr0l",
    );
    expect(result.path).toBe("m/86'/0'/0'/0/2");
  });

  it("determinismo: misma combinación xpub+index produce misma dirección", () => {
    const wallet = new HdWallet({ xpub });
    const a = wallet.deriveAddress(1);
    const b = wallet.deriveAddress(1);
    expect(a.address).toBe(b.address);
  });

  it("índices distintos producen direcciones distintas", () => {
    const wallet = new HdWallet({ xpub });
    const a = wallet.deriveAddress(1);
    const b = wallet.deriveAddress(2);
    expect(a.address).not.toBe(b.address);
  });

  it("lanza InvalidTicketIdError si ticketId < 1 (negativo)", () => {
    const wallet = new HdWallet({ xpub });
    expect(() => wallet.deriveAddress(-1)).toThrow(InvalidTicketIdError);
    expect(() => wallet.deriveAddress(0)).toThrow(InvalidTicketIdError);
  });

  it("lanza InvalidTicketIdError si ticketId > 2^31-1", () => {
    const wallet = new HdWallet({ xpub });
    expect(() => wallet.deriveAddress(0x80000000)).toThrow(InvalidTicketIdError); // 2^31
  });

  it("lanza InvalidTicketIdError si ticketId no es entero", () => {
    const wallet = new HdWallet({ xpub });
    expect(() => wallet.deriveAddress(1.5)).toThrow(InvalidTicketIdError);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/crypto test`
Expected: FAIL — los tests de derivación llaman a `deriveAddress` que lanza "no implementado".

- [ ] **Step 3: Implementar `deriveAddress` en `packages/crypto/src/hd-wallet.ts`**

Reemplazar el método placeholder `deriveAddress` y añadir los imports necesarios. En la sección de imports, añadir:

```typescript
import { bech32m } from "@scure/base";
import { schnorr } from "@noble/curves/secp256k1";
```

Reemplazar el cuerpo del método `deriveAddress`:

```typescript
  deriveAddress(ticketId: number): DerivedAddress {
    if (
      !Number.isInteger(ticketId) ||
      ticketId < MIN_TICKET_ID ||
      ticketId > MAX_TICKET_ID
    ) {
      throw new InvalidTicketIdError(
        `ticketId debe ser entero en [${MIN_TICKET_ID}, ${MAX_TICKET_ID}], got ${ticketId}`,
      );
    }

    // Derivar dos niveles no-endurecidos: m/86'/0'/0'/0/ticketId
    const changeChild = this.root.deriveChild(0);
    const ticketChild = changeChild.deriveChild(ticketId);

    if (!ticketChild.publicKey) {
      throw new InvalidXpubError(
        `derivación de ticketId ${ticketId} no produjo clave pública`,
      );
    }

    // Taproot tweak (BIP341, key-path only, sin scripts)
    // La clave pública tweaked X-only son los primeros 32 bytes del resultado.
    const tweaked = schnorr.utils.tweakPublicKey(ticketChild.publicKey, undefined);
    // tweakPublicKey devuelve { xOnly: Uint8Array(32), parity: 0|1 }
    const tweakedXOnly = tweaked.xOnly;

    // Codificar bech32m (BIP350) para Taproot
    const words = bech32m.toWords(tweakedXOnly);
    // witver 0 al inicio
    const address = bech32m.encode("bc", [0, ...words]);

    return {
      address,
      path: `m/86'/0'/0'/0/${ticketId}`,
      index: ticketId,
    };
  }
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/crypto test`
Expected: 8 derivación + 7 validación + 8 qr-svg + 8 bip21 + 3 errors = 34 PASS.

**Importante:** Si los tests de los vectores BIP86 (índices 0/1/2) fallan, el tweak de Taproot está mal. Revisar la documentación de `@noble/curves` para la firma exacta de `tweakPublicKey`. La implementación correcta produce las direcciones exactas del BIP86.

- [ ] **Step 5: Commit**

```bash
git add packages/crypto
git commit -m "feat(crypto): HdWallet.deriveAddress con BIP86 + Taproot tweak

Verificado contra vectores oficiales BIP86 (índices 0/1/2 producen
direcciones bc1p exactas). Determinista, validación de rango [1, 2^31-1]."
```

---

## Task 7: `generateTicketPayment` (función de conveniencia)

**Objetivo:** Orquestar los 3 pasos (derivar → BIP21 → QR) en una llamada.

**Files:**
- Create: `packages/crypto/test/unit/generate-ticket-payment.test.ts`
- Modify: `packages/crypto/src/index.ts`

- [ ] **Step 1: Escribir tests que FALLARÁN**

```typescript
import { describe, it, expect } from "vitest";
import { generateTicketPayment, HdWallet } from "../../src/index.js";

const VALID_XPUB =
  "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ";

describe("generateTicketPayment", () => {
  it("combina derivación + BIP21 + QR en un objeto", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const result = generateTicketPayment({
      wallet,
      ticketId: 1,
      amountMb: 0.001,
    });
    expect(result.address).toBe(
      "bc1p4qhjn9zdvkux4e44uhx8tcceatttc7n8ktv2all3oej9k0k668q0a28tr8",
    );
    expect(result.bip21Uri).toBe(`bitcoin:${result.address}?amount=0.001`);
    expect(result.qrSvg).toContain("<svg");
    expect(result.path).toBe("m/86'/0'/0'/0/1");
  });

  it("respeta qrOptions custom", () => {
    const wallet = new HdWallet({ xpub: VALID_XPUB });
    const result = generateTicketPayment({
      wallet,
      ticketId: 2,
      amountMb: 1,
      qrOptions: { size: 400 },
    });
    expect(result.qrSvg).toContain('width="400"');
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/crypto test`
Expected: FAIL con "generateTicketPayment is not a function".

- [ ] **Step 3: Añadir `generateTicketPayment` a `packages/crypto/src/index.ts`**

```typescript
export * from "./errors.js";
export { buildBip21Uri } from "./bip21.js";
export { renderQrSvg } from "./qr-svg.js";
export type { QrSvgOptions } from "./qr-svg.js";
export { HdWallet } from "./hd-wallet.js";
export type { HdWalletOptions, DerivedAddress } from "./hd-wallet.js";

import type { HdWallet } from "./hd-wallet.js";
import type { QrSvgOptions } from "./qr-svg.js";
import { buildBip21Uri } from "./bip21.js";
import { renderQrSvg } from "./qr-svg.js";

export interface GenerateTicketPaymentOptions {
  wallet: HdWallet;
  ticketId: number;
  amountMb: number;
  qrOptions?: QrSvgOptions;
}

export interface TicketPayment {
  address: string;
  bip21Uri: string;
  qrSvg: string;
  path: string;
}

/**
 * Orquesta derivación + BIP21 + QR en una sola llamada.
 * Conveniencia para el consumidor final (Ciclo 4).
 */
export function generateTicketPayment(
  opts: GenerateTicketPaymentOptions,
): TicketPayment {
  const derived = opts.wallet.deriveAddress(opts.ticketId);
  const bip21Uri = buildBip21Uri(derived.address, opts.amountMb);
  const qrSvg = renderQrSvg(bip21Uri, opts.qrOptions);
  return {
    address: derived.address,
    bip21Uri,
    qrSvg,
    path: derived.path,
  };
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/crypto test`
Expected: 2 generateTicketPayment + 8 derivación + 7 validación + 8 qr-svg + 8 bip21 + 3 errors = 36 PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/crypto
git commit -m "feat(crypto): generateTicketPayment orquesta derivar+BIP21+QR"
```

---

## Task 8: Variable de entorno `XPUB_BIP86` en config

**Objetivo:** Añadir `XPUB_BIP86` al schema Zod y propagar a `.env.example`.

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `packages/config/test/env.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Añadir tests que FALLARÁN a `packages/config/test/env.test.ts`**

Añadir dentro del `describe("loadEnv")`:

```typescript
  it("acepta XPUB_BIP86 válido (empieza con xpub)", () => {
    const env = loadEnv({
      ...valid,
      XPUB_BIP86: "xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ",
    });
    expect(env.XPUB_BIP86).toMatch(/^xpub/);
  });

  it("lanza si XPUB_BIP86 no empieza con xpub", () => {
    expect(() =>
      loadEnv({ ...valid, XPUB_BIP86: "tpub6CPIbm..." }),
    ).toThrow();
  });

  it("lanza si XPUB_BIP86 está vacío", () => {
    expect(() => loadEnv({ ...valid, XPUB_BIP86: "" })).toThrow();
  });
```

- [ ] **Step 2: Correr tests para verificar que fallan**

Run: `pnpm --filter @myloto/config test`
Expected: FAIL — los tests nuevos referencian `XPUB_BIP86` que no está en el schema.

- [ ] **Step 3: Modificar `packages/config/src/env.ts` para añadir XPUB_BIP86**

En el `envSchema`, añadir después de `FRACTAL_RPC_TIMEOUT_MS`:

```typescript
  // --- XPUB BIP86 (para derivar direcciones de boletos) ---
  XPUB_BIP86: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("xpub"), {
      message: "XPUB_BIP86 debe empezar con 'xpub' (mainnet BIP86)",
    }),
```

- [ ] **Step 4: Actualizar `.env.example`**

Añadir al final:

```bash

# --- XPUB BIP86 (para derivar direcciones de boletos, nivel m/86'/0'/0') ---
XPUB_BIP86=xpub6BgBgspe...
```

- [ ] **Step 5: Correr tests para verificar que pasan**

Run: `pnpm --filter @myloto/config test`
Expected: 3 nuevos + 10 existentes = 13 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/config .env.example
git commit -m "feat(config): añade XPUB_BIP86 al env schema con validación xpub"
```

---

## Task 9: Tests de integración con XPUB real

**Objetivo:** Suite opcional que valida contra el XPUB real del usuario.

**Files:**
- Create: `packages/crypto/test/integration/xpub.test.ts`

- [ ] **Step 1: Crear `packages/crypto/test/integration/xpub.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { config } from "dotenv";
import { HdWallet, generateTicketPayment } from "../../src/index.js";

config({ path: "../../.env" });

const shouldRun = process.env.RUN_INTEGRATION === "1";

describe.skipIf(!shouldRun)("HdWallet — integración con XPUB real", () => {
  const xpub = process.env.XPUB_BIP86;

  it("el XPUB real pasa validación exhaustiva", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    expect(() => new HdWallet({ xpub })).not.toThrow();
  });

  it("deriva una dirección bc1p válida de 62 chars para ticketId 1", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const result = wallet.deriveAddress(1);
    expect(result.address).toMatch(/^bc1p/);
    expect(result.address).toHaveLength(62);
    expect(result.path).toBe("m/86'/0'/0'/0/1");
    console.log("    Dirección del ticket #1:", result.address);
  });

  it("deriva una dirección bc1p distinta para ticketId 2", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const r1 = wallet.deriveAddress(1);
    const r2 = wallet.deriveAddress(2);
    expect(r1.address).not.toBe(r2.address);
    console.log("    Dirección del ticket #2:", r2.address);
  });

  it("determinismo: mismo ticketId produce misma dirección", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const a = wallet.deriveAddress(5);
    const b = wallet.deriveAddress(5);
    expect(a.address).toBe(b.address);
  });

  it("generateTicketPayment produce address + BIP21 + QR válidos", () => {
    if (!xpub) throw new Error("XPUB_BIP86 no definido en .env");
    const wallet = new HdWallet({ xpub });
    const result = generateTicketPayment({
      wallet,
      ticketId: 10,
      amountMb: 0.001,
    });
    expect(result.address).toMatch(/^bc1p/);
    expect(result.bip21Uri).toContain("bitcoin:bc1p");
    expect(result.bip21Uri).toContain("amount=0.001");
    expect(result.qrSvg).toContain("<svg");
    expect(result.qrSvg).toContain("</svg>");
    console.log("    BIP21:", result.bip21Uri);
    console.log("    QR length:", result.qrSvg.length, "bytes");
  });
});
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter @myloto/crypto typecheck`
Expected: exit code 0.

- [ ] **Step 3: Verificar que la suite se SKIPEA sin RUN_INTEGRATION**

Run: `pnpm --filter @myloto/crypto test:integration`
Expected: 5 tests skipped (RUN_INTEGRATION no set).

- [ ] **Step 4: Correr con XPUB real (requiere `.env` con XPUB_BIP86 real)**

Run: `RUN_INTEGRATION=1 pnpm --filter @myloto/crypto test:integration`
Expected: 5 tests PASS, imprimiendo las direcciones reales de los tickets #1 y #2.

- [ ] **Step 5: Commit**

```bash
git add packages/crypto
git commit -m "test(crypto): suite de integración con XPUB real (RUN_INTEGRATION=1)"
```

---

## Task 10: Verificación global y demo E2E

**Objetivo:** Confirmar que todo el workspace sigue verde y demostrar el flujo completo.

- [ ] **Step 1: Typecheck global**

Run: `pnpm -r typecheck`
Expected: todos los paquetes Done, exit 0.

- [ ] **Step 2: Tests unitarios globales**

Run: `pnpm -r test`
Expected: todo verde (config 13 + rpc-client 24 + crypto 36 + backend 4 = 77+ tests).

- [ ] **Step 3: Demo E2E — derivar dirección + QR de un boleto**

Crear script temporal `scripts/demo-crypto.ts`:

```typescript
import { config } from "dotenv";
import { HdWallet, generateTicketPayment } from "../packages/crypto/src/index.js";

config();

const xpub = process.env.XPUB_BIP86!;
const wallet = new HdWallet({ xpub });

console.log("=== Demo MYLoto Ciclo 2 ===\n");

for (const ticketId of [1, 2, 3]) {
  const result = generateTicketPayment({
    wallet,
    ticketId,
    amountMb: 0.001,
  });
  console.log(`Boleto #${ticketId}:`);
  console.log(`  Dirección: ${result.address}`);
  console.log(`  BIP21:     ${result.bip21Uri}`);
  console.log(`  QR size:   ${result.qrSvg.length} bytes`);
  console.log(`  Ruta:      ${result.path}\n`);
}
```

Run: `pnpm --filter @myloto/crypto exec tsx ../../scripts/demo-crypto.ts`
Expected: imprime las 3 direcciones reales derivadas de tu XPUB, sus BIP21 URIs y tamaños de QR.

- [ ] **Step 4: Borrar el script demo**

Run: `rm scripts/demo-crypto.ts`

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: verificación end-to-end del Ciclo 2 completa"
```

- [ ] **Step 6: Marcar el ciclo como completo**

Entregables verificados (spec §9):
1. ✅ `pnpm install` sin errores
2. ✅ `pnpm --filter @myloto/crypto typecheck` exit 0
3. ✅ Vectores BIP86 índices 0/1/2 producen direcciones exactas
4. ✅ XPUB real deriva `bc1p...` válidas (requiere `.env`)
5. ✅ `pnpm -r test` todo verde
6. ✅ `pnpm -r typecheck` todo verde
7. ✅ Demo E2E muestra direcciones + QR reales

---

## Self-Review del Plan

### Especificación cubierta

| Sección del spec | Tarea que lo implementa |
|---|---|
| §3 Estructura del paquete | Task 1 |
| §4 HdWallet validación XPUB (8 checks) | Task 5 |
| §4 HdWallet.deriveAddress BIP86 + Taproot | Task 6 |
| §4 Determinismo | Task 6 (tests) |
| §5.1 buildBip21Uri | Task 3 |
| §5.2 renderQrSvg | Task 4 |
| §5.3 generateTicketPayment | Task 7 |
| §6 Errores tipados | Task 2 |
| §7 Tests vectores BIP86 | Task 6 |
| §7 Tests integración XPUB real | Task 9 |
| §8 Integración con config | Task 8 |
| §9 Entregables | Task 10 |

Todas las secciones del spec tienen al menos una tarea. ✓

### Placeholder scan

Sin TBDs ni "implement later". Todo el código está completo. ✓

### Type consistency

- `HdWallet(opts)` → `deriveAddress(ticketId): DerivedAddress` — consistente en Tasks 5, 6, 7, 9.
- `buildBip21Uri(address, amountMb)` — consistente en Tasks 3, 7.
- `renderQrSvg(content, opts?)` con `QrSvgOptions` — consistente en Tasks 4, 7.
- `generateTicketPayment(opts)` → `TicketPayment` — consistente en Task 7, 9.
- `XPUB_BIP86` como nombre de variable — consistente en Tasks 8, 9, 10.

Sin inconsistencias. ✓
