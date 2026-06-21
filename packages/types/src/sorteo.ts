/**
 * Tipos de dominio del juego de lotería.
 * Estos tipos reflejan las reglas de Powerball y NO deben duplicarse
 * — `packages/db` los re-exporta desde Drizzle, y los endpoints los usan.
 */

export const SORTEO_ESTADO = {
  ABIERTO: "ABIERTO",
  CERRADO: "CERRADO",
  CALCULADO: "CALCULADO",
  FINALIZADO: "FINALIZADO",
} as const;
export type SorteoEstado = (typeof SORTEO_ESTADO)[keyof typeof SORTEO_ESTADO];

export const TICKET_STATUS = {
  PENDIENTE: "PENDIENTE",
  ACTIVO: "ACTIVO",
} as const;
export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

/** Rangos del spec de Powerball */
export const BALOTA_MIN = 1;
export const BALOTA_MAX = 69;
export const POWERBALL_MIN = 1;
export const POWERBALL_MAX = 26;
export const CANTIDAD_BALOTAS = 5;

/** Combinación ganadora persistida en sorteos.combinacion_ganadora (JSONB) */
export interface CombinacionGanadora {
  balotas: [number, number, number, number, number]; // ordenadas asc
  powerball: number;
}

/** Hashes de los 3 bloques usados como semilla, persistidos en sorteos.bloques_semilla (JSONB) */
export interface BloquesSemilla {
  n1: string; // hash del bloque N+1
  n2: string; // hash del bloque N+2
  n3: string; // hash del bloque N+3
}
