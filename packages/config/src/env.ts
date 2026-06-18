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
