"use client";

import { useState } from "react";
import { useGanadores, usePagarGanador } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TIER_DESC, formatMonto } from "@/lib/constants";

export function GanadoresAdmin() {
  const [sorteoId, setSorteoId] = useState(1);
  const { data: ganadores } = useGanadores(sorteoId);
  const pagar = usePagarGanador();

  const handleSorteoChange = (value: string) => {
    const n = Number(value);
    // Ignorar vacío/NaN/0 — no dispara peticiones inválidas a /sorteos/0
    if (value !== "" && Number.isInteger(n) && n > 0) {
      setSorteoId(n);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-muted-light text-sm">Ganadores del sorteo #</p>
        <input
          type="number"
          value={sorteoId}
          onChange={(e) => handleSorteoChange(e.target.value)}
          className="w-16 bg-background border border-border rounded px-2 py-1 text-center text-sm text-muted-light"
          min={1}
        />
      </div>
      {ganadores && ganadores.length > 0 ? (
        <div className="space-y-2">
          {ganadores.map((g) => (
            <div key={g.id} className="flex justify-between items-center bg-background rounded-lg p-2">
              <div className="text-sm">
                <span className="text-gold font-semibold">{TIER_DESC[g.tier] ?? `Tier ${g.tier}`}</span>
                <span className="text-muted ml-2">#{g.ticketId}</span>
                <span className="text-gold ml-2">{formatMonto(g.monto)} FB</span>
              </div>
              {g.pagado ? (
                <Badge variant="finalizado">Pagado</Badge>
              ) : (
                <Button
                  variant="secondary"
                  className="text-xs px-3 py-1"
                  onClick={() => pagar.mutate(g.id)}
                  disabled={pagar.isPending && pagar.variables === g.id}
                >
                  {pagar.isPending && pagar.variables === g.id ? "Pagando..." : "Marcar pagado"}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm text-center py-4">Sin ganadores</p>
      )}
    </Card>
  );
}
