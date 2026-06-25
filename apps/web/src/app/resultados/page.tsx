"use client";

import { useState } from "react";
import { useSorteo, useGanadores } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { CombinacionGanadora } from "@/components/resultados/CombinacionGanadora";
import { GanadoresList } from "@/components/resultados/GanadoresList";
import { VerificableBadge } from "@/components/resultados/VerificableBadge";

export default function ResultadosPage() {
  const [sorteoId, setSorteoId] = useState(1);
  const { data: sorteo, isLoading } = useSorteo(sorteoId);
  const { data: ganadores } = useGanadores(sorteoId);

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-gold text-2xl font-bold text-center mb-6">🏆 Resultados</h1>

      <div className="flex gap-2 justify-center mb-6">
        <input
          type="number"
          value={sorteoId}
          onChange={(e) => setSorteoId(Number(e.target.value))}
          className="w-20 bg-background-card border border-border rounded-lg px-3 py-2 text-center text-muted-light"
          min={1}
        />
        <span className="text-muted-light self-center">Sorteo #</span>
      </div>

      {isLoading ? (
        <Spinner label="Cargando..." />
      ) : sorteo ? (
        <div className="space-y-4">
          <Card className="text-center py-6">
            <p className="text-muted text-xs uppercase tracking-widest mb-1">
              Sorteo #{sorteo.id} · {sorteo.estado}
            </p>
            <div className="my-4">
              <CombinacionGanadora sorteo={sorteo} />
            </div>
            <VerificableBadge />
          </Card>
          {ganadores && <GanadoresList ganadores={ganadores} />}
        </div>
      ) : (
        <Card className="text-center py-8">
          <p className="text-muted">Sorteo no encontrado</p>
        </Card>
      )}
    </main>
  );
}
