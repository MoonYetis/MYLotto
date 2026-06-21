import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Nodo Fractal RPC (Tailscale) ---
  FRACTAL_RPC_URL: z
    .string()
    .url()
    .refine((u) => /^http:\/\/100\./.test(u), {
      message: "FRACTAL_RPC_URL debe ser http://100.x.x.x:8332 (IP Tailscale)",
    }),
  FRACTAL_RPC_USER: z.string().min(1),
  FRACTAL_RPC_PASSWORD: z.string().min(1),
  FRACTAL_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // --- Postgres ---
  DATABASE_URL: z.string().url(),

  // --- Backend ---
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // --- XPUB BIP86 (OBLIGATORIO desde Ciclo 4 — derivación de direcciones de boleto) ---
  XPUB_BIP86: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("xpub"), {
      message: "XPUB_BIP86 debe empezar con 'xpub' (mainnet BIP86)",
    }),

  // --- UniSat BRC-20 API (para descuento Hold-to-Earn Moonyetis) ---
  UNISAT_BASE_URL: z
    .string()
    .url()
    .default("https://open-api-fractal.unisat.io"),
  UNISAT_API_KEY: z.string().min(1),
  UNISAT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // --- Ticker BRC-20 para Hold-to-Earn ---
  BRC20_TICKER: z.string().min(1).default("Moonyetis"),

  // --- Precios de boleto (Hold-to-Earn) ---
  TICKET_PRICE_FB: z.coerce.number().positive().default(100),
  TICKET_DISCOUNT_PRICE_FB: z.coerce.number().positive().default(80),

  // --- Worker de verificación de pagos ---
  PAYMENT_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  PAYMENT_MIN_CONFIRMATIONS: z.coerce.number().int().min(0).default(1),

  // --- Wallet del nodo para getreceivedbyaddress (multi-wallet watch-only) ---
  // Vacío = wallet por defecto. "myloto_watchonly" = wallet observador con la XPUB.
  FRACTAL_RPC_WALLET: z.string().default(""),

  // --- Worker de cálculo de sorteos (Ciclo 5) ---
  DRAW_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(30000),

  // --- Worker de escrutinio (Ciclo 6) ---
  SCRUTINY_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida y parsea el entorno. Lanza ZodError con la lista precisa de
 * variables faltantes/inválidas si la validación falla (fail-fast).
 */
export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  return envSchema.parse(source);
}
