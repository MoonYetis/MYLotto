"use client";

import { NumberBall } from "@/components/ui/NumberBall";
import { Badge } from "@/components/ui/Badge";
import { TIER_DESC, formatMonto } from "@/lib/constants";
import type { MyTicket } from "@/lib/api";

export function TicketCard({ ticket }: { ticket: MyTicket }) {
  const isVigente = ticket.sorteoEstado === "ABIERTO";
  return (
    <div className={`bg-background-card/80 border rounded-2xl p-4 ${
      ticket.gano === true ? "border-neon-yellow/50 shadow-glow-yellow" :
      ticket.gano === false ? "border-muted/30 opacity-75" :
      "border-neon-pink/20"
    }`}>
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm">
          <span className="text-neon-cyan font-bold">Sorteo #{ticket.sorteoId}</span>
          <span className="text-muted text-xs ml-2">· {ticket.sorteoEstado}</span>
        </div>
        {isVigente ? (
          ticket.status === "ACTIVO" ? <Badge variant="activo">ACTIVO</Badge> : <Badge variant="pendiente">PENDIENTE</Badge>
        ) : ticket.gano ? (
          <Badge variant="finalizado">🏆 GANÓ</Badge>
        ) : (
          <Badge variant="cerrado">No ganó</Badge>
        )}
      </div>

      <div className="flex gap-2 justify-center items-center">
        {[ticket.n1, ticket.n2, ticket.n3, ticket.n4, ticket.n5].map((n, i) => (
          <NumberBall key={i} value={n} variant="balota" size="sm" />
        ))}
        <div className="w-0.5 h-6 bg-border mx-1" />
        <NumberBall value={ticket.powerball} variant="powerball" size="sm" />
      </div>

      {ticket.gano && ticket.monto && (
        <div className="text-center mt-3 text-neon-yellow font-bold text-sm">
          {TIER_DESC[ticket.tier!] ?? `Tier ${ticket.tier}`} · {formatMonto(ticket.monto)} FB
        </div>
      )}
    </div>
  );
}
