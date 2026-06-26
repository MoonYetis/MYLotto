import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TIER_DESC, formatMonto } from "@/lib/constants";
import type { GanadorResponse } from "@/lib/api";

export function GanadoresList({ ganadores }: { ganadores: GanadorResponse[] }) {
  if (ganadores.length === 0) {
    return <p className="text-muted text-center py-4">Sin ganadores registrados</p>;
  }
  return (
    <Card>
      <p className="text-muted-light text-sm mb-3">Ganadores ({ganadores.length})</p>
      <div className="space-y-2">
        {ganadores.map((g) => (
          <div key={g.id} className="flex justify-between items-center">
            <div>
              <span className="text-gold font-semibold text-sm">{TIER_DESC[g.tier] ?? `Tier ${g.tier}`}</span>
              <span className="text-muted text-xs ml-2">#{g.ticketId}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gold font-bold text-sm">{formatMonto(g.monto)} FB</span>
              {g.pagado ? <Badge variant="finalizado">Pagado</Badge> : <Badge variant="pendiente">Pendiente</Badge>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
