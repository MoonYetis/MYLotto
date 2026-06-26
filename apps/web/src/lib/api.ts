import { BACKEND_URL } from "./constants";

// --- Tipos de respuesta ---

export interface SorteoActivo {
  id: number;
  bloqueCierre: number;
  estado: string;
  creadoEn: string;
}

export interface TicketResponse {
  id: number;
  sorteoId: number;
  status: "PENDIENTE" | "ACTIVO";
  expectedAmount: number;
  hasDiscount: boolean;
  paymentAddress: string;
  bip21Uri: string;
  qrSvg: string;
}

export interface TicketDetalle {
  id: number;
  sorteoId: number;
  status: "PENDIENTE" | "ACTIVO";
  expectedAmount: string;
  paymentAddress: string;
  combinacion: {
    n1: number; n2: number; n3: number; n4: number; n5: number;
    powerball: number;
  };
  recibidoEn: string | null;
}

export interface JackpotResponse {
  saldo: number;
}

export interface GanadorResponse {
  id: number;
  ticketId: number;
  tier: number;
  monto: string;
  pagado: boolean;
}

export interface SorteoCompleto {
  id: number;
  bloqueCierre: number;
  estado: string;
  combinacionGanadora: { balotas: number[]; powerball: number } | null;
  bloquesSemilla: { n1: string; n2: string; n3: string } | null;
  creadoEn: string;
  cerradoEn: string | null;
  calculadoEn: string | null;
}

export interface TicketInput {
  n1: number; n2: number; n3: number; n4: number; n5: number;
  powerball: number;
  brc20Address?: string;
}

// --- Funciones fetch ---

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Aseguramos un body válido para POST/PUT/PATCH: Fastify rechaza peticiones
  // con Content-Type: application/json pero body vacío (FST_ERR_CTP_EMPTY_JSON_BODY)
  // y también POST sin content-type (FST_ERR_CTP_INVALID_MEDIA_TYPE).
  // Para verbos con body enviamos al menos "{}" con el Content-Type correcto.
  const method = init?.method?.toUpperCase();
  const hasBodyVerb = method === "POST" || method === "PUT" || method === "PATCH";
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    body: init?.body ?? (hasBodyVerb ? "{}" : undefined),
    headers:
      init?.body || hasBodyVerb
        ? { "Content-Type": "application/json", ...init?.headers }
        : init?.headers,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function getSorteoActivo(): Promise<SorteoActivo | null> {
  return apiFetch<SorteoActivo>("/sorteos/abierto").catch(() => null);
}

export function getJackpot(): Promise<JackpotResponse> {
  return apiFetch<JackpotResponse>("/jackpot");
}

export function createTicket(input: TicketInput): Promise<TicketResponse> {
  return apiFetch<TicketResponse>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getTicket(id: number): Promise<TicketDetalle | null> {
  return apiFetch<TicketDetalle>(`/tickets/${id}`).catch(() => null);
}

export function getSorteo(id: number): Promise<SorteoCompleto | null> {
  return apiFetch<SorteoCompleto>(`/sorteos/${id}`).catch(() => null);
}

export function getGanadores(sorteoId: number): Promise<GanadorResponse[]> {
  return apiFetch<GanadorResponse[]>(`/sorteos/${sorteoId}/ganadores`);
}

export function createSorteo(): Promise<SorteoActivo> {
  return apiFetch<SorteoActivo>("/admin/sorteos", { method: "POST" });
}

export function markGanadorPagado(id: number): Promise<{ id: number; pagado: boolean }> {
  return apiFetch(`/admin/ganadores/${id}/pagar`, { method: "POST" });
}
