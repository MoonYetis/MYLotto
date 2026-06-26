"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSorteoActivo,
  getJackpot,
  createTicket,
  getTicket,
  getSorteo,
  getGanadores,
  createSorteo,
  markGanadorPagado,
  type TicketInput,
} from "./api";

// Dashboard: refetch cada 30s
export function useJackpot() {
  return useQuery({ queryKey: ["jackpot"], queryFn: getJackpot, refetchInterval: 30_000 });
}

export function useSorteoActivo() {
  return useQuery({ queryKey: ["sorteo-activo"], queryFn: getSorteoActivo, refetchInterval: 30_000 });
}

// Wizard: crear ticket
export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketInput) => createTicket(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

// Wizard: polling de estado (5s mientras no esté ACTIVO).
// Resiliente: si una petición falla (getTicket devuelve null por catch),
// seguimos polleando — solo paramos cuando vemos status === "ACTIVO" de verdad.
export function useTicketStatus(id: number | null) {
  return useQuery({
    queryKey: ["ticket", id],
    queryFn: () => (id ? getTicket(id) : null),
    enabled: id !== null,
    refetchInterval: (query) => {
      // Paramos el polling solo cuando tenemos confirmación explícita de ACTIVO.
      // null (error de red / no encontrado) NO detiene el polling.
      return query.state.data?.status === "ACTIVO" ? false : 5_000;
    },
  });
}

// Resultados
export function useSorteo(id: number) {
  return useQuery({ queryKey: ["sorteo", id], queryFn: () => getSorteo(id) });
}

export function useGanadores(sorteoId: number) {
  return useQuery({ queryKey: ["ganadores", sorteoId], queryFn: () => getGanadores(sorteoId) });
}

// Admin
export function useCreateSorteo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSorteo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sorteo-activo"] }),
  });
}

export function usePagarGanador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markGanadorPagado(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ganadores"] }),
  });
}
