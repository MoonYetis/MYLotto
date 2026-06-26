export const BALOTAS_MAX = 69;
export const POWERBALL_MAX = 26;
export const BALOTAS_TO_SELECT = 5;
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

/**
 * Descripción de cada tier de premio (Powerball).
 * Fuente única de verdad — usada tanto por la vista pública (resultados)
 * como por el panel de admin, para que ambas muestren etiquetas consistentes.
 */
export const TIER_DESC: Record<number, string> = {
  1: "5 + PB (Jackpot)",
  2: "5 balotas",
  3: "4 + PB",
  4: "4 balotas",
  5: "3 + PB",
  6: "3 balotas",
  7: "2 + PB",
  8: "1 + PB",
  9: "0 + PB",
};

/**
 * Formatea un monto (string de la API o número) como número legible con
 * separadores de miles. Ej: "1000000" → "1,000,000".
 */
export function formatMonto(monto: string | number): string {
  const n = typeof monto === "number" ? monto : Number(monto);
  if (!Number.isFinite(n)) return String(monto);
  return n.toLocaleString("es");
}
