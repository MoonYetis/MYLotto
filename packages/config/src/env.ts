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

  // --- XPUB BIP86 (para derivar direcciones de boletos, nivel m/86'/0'/0') ---
  // Opcional en desarrollo; el Ciclo 4 lo hará required cuando el backend lo use.
  XPUB_BIP86: z
    .string()
    .min(1)
    .refine((s) => s.startsWith("xpub"), {
      message: "XPUB_BIP86 debe empezar con 'xpub' (mainnet BIP86)",
    })
    .optional(),

  // --- UniSat BRC-20 API (para descuento Hold-to-Earn Moonyetis) ---
  UNISAT_BASE_URL: z
    .string()
    .url()
    .default("https://open-api-fractal.unisat.io"),
  UNISAT_API_KEY: z.string().min(1),
  UNISAT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  // --- Ticker BRC-20 para Hold-to-Earn ---
  BRC20_TICKER: z.string().min(1).default("Moonyetis"),
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
