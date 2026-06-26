"use client";

import { useState } from "react";
import { useSorteo, useGanadores } from "@/lib/hooks";
import { Navbar } from "@/components/ui/Navbar";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { CombinacionGanadora } from "@/components/resultados/CombinacionGanadora";
import { GanadoresList } from "@/components/resultados/GanadoresList";

export default function ResultadosPage() {
  const [sorteoId, setSorteoId] = useState(1);
  const [showBlocks, setShowBlocks] = useState(false);
  const { data: sorteo, isLoading } = useSorteo(sorteoId);
  const { data: ganadores } = useGanadores(sorteoId);

  const handleSorteoChange = (value: string) => {
    const n = Number(value);
    if (value !== "" && Number.isInteger(n) && n > 0) {
      setSorteoId(n);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-2xl mx-auto px-4 py-8 content-layer">
        <h1 className="text-2xl font-black text-white text-center mb-6">
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">🏆 Resultados</span>
        </h1>

        <div className="flex gap-2 justify-center mb-6">
          <span className="text-muted-light self-center text-sm">Sorteo</span>
          <input
            type="number"
            value={sorteoId}
            onChange={(e) => handleSorteoChange(e.target.value)}
            className="w-20 bg-background-card border border-neon-pink/30 rounded-lg px-3 py-2 text-center text-neon-pink font-bold focus:border-neon-pink focus:outline-none"
            min={1}
          />
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

              {/* Badge "Verificar on-chain" clicable que expande bloques semilla (arregla M8) */}
              {sorteo.bloquesSemilla && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowBlocks(!showBlocks)}
                    className="inline-flex items-center gap-2 bg-neon-green/10 border border-neon-green/40 rounded-full px-4 py-1.5 text-xs text-neon-green hover:bg-neon-green/20 transition-colors"
                  >
                    <span>🔒</span>
                    <span>{showBlocks ? "Ocultar" : "Verificar"} on-chain</span>
                  </button>
                  {showBlocks && (
                    <div className="mt-3 bg-background-elevated/50 rounded-lg p-3 text-left max-w-md mx-auto">
                      <p className="text-[10px] text-muted tracking-wide mb-2">BLOCKS SEED</p>
                      <pre className="font-mono text-[10px] text-neon-purple break-all whitespace-pre-wrap">
                        {sorteo.bloquesSemilla.n1}
                        {"\n"}
                        {sorteo.bloquesSemilla.n2}
                        {"\n"}
                        {sorteo.bloquesSemilla.n3}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </Card>
            {ganadores && <GanadoresList ganadores={ganadores} />}
          </div>
        ) : (
          <Card className="text-center py-8">
            <p className="text-muted">Sorteo no encontrado</p>
          </Card>
        )}
      </main>
    </>
  );
}
