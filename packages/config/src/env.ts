import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Nodo Fractal RPC ---
  FRACTAL_RPC_URL: z.string().url(),
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
  TICKET_PRICE_FB: z.coerce.number().positive().default(1),
  TICKET_DISCOUNT_PRICE_FB: z.coerce.number().positive().default(0.8),

  // --- Jackpot base garantizado (Ciclo 6) ---
  // Monto mínimo del jackpot mostrado al jugador, independiente de las ventas.
  // El operador fondea este monto con FB desde su wallet.
  JACKPOT_BASE_FB: z.coerce.number().min(0).default(1000),

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

  // --- Gestión de sorteos (Ciclo 7) ---
  DURACION_SORTEO_BLOQUES: z.coerce.number().int().positive().default(144),
  LIFECYCLE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),

  // --- Scheduler de sorteos (calendario semanal) ---
  // Días ISO separados por coma: 1=Lun, 4=Jue, 6=Sáb. El operador puede cambiarlos.
  SCHEDULE_DAYS: z.string().default("1,4,6"),
  // Hora del sorteo (0-23), hora local del timezone.
  SCHEDULE_HOUR: z.coerce.number().int().min(0).max(23).default(20),
  // Timezone IANA. America/Bogota no tiene DST.
  SCHEDULE_TIMEZONE: z.string().default("America/Bogota"),
  // Intervalo de check del scheduler (1 min).
  SCHEDULE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  // Tiempo promedio de bloque en Fractal (10 min = 600000 ms).
  BLOCK_TIME_MS: z.coerce.number().int().positive().default(600000),
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
