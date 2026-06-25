import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { GanadorResponse } from "@/lib/api";

const TIER_DESC: Record<number, string> = {
  1: "5 + PB (Jackpot)", 2: "5 balotas", 3: "4 + PB", 4: "4 balotas",
  5: "3 + PB", 6: "3 balotas", 7: "2 + PB", 8: "1 + PB", 9: "0 + PB",
};

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
              <span className="text-gold font-bold text-sm">{g.monto} FB</span>
              {g.pagado ? <Badge variant="finalizado">Pagado</Badge> : <Badge variant="pendiente">Pendiente</Badge>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
