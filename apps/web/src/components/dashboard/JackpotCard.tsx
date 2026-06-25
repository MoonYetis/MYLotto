"use client";

import { useJackpot, useSorteoActivo } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

export function JackpotCard() {
  const { data: jackpot, isLoading: jpLoading } = useJackpot();
  const { data: sorteo, isLoading: saLoading } = useSorteoActivo();

  if (jpLoading || saLoading) {
    return (
      <Card className="text-center py-8">
        <Spinner label="Cargando..." />
      </Card>
    );
  }

  return (
    <Card className="text-center py-8 bg-gradient-to-br from-background-card to-background">
      <p className="text-muted text-xs uppercase tracking-widest">Jackpot acumulado</p>
      <p className="text-gold text-4xl font-bold my-2">
        {jackpot ? `${jackpot.saldo.toLocaleString()} FB` : "0 FB"}
      </p>
      {sorteo ? (
        <p className="text-muted-light text-sm">
          Sorteo #{sorteo.id} · Cierra en bloque {sorteo.bloqueCierre}
        </p>
      ) : (
        <p className="text-muted text-sm">No hay sorteo activo</p>
      )}
    </Card>
  );
}
