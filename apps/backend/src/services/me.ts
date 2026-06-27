import { eq } from "drizzle-orm";
import { tickets, sorteos, ganadores, type Database } from "@myloto/db";

export interface MyTicket {
  id: number;
  sorteoId: number;
  sorteoEstado: string;
  status: string;
  n1: number; n2: number; n3: number; n4: number; n5: number;
  powerball: number;
  expectedAmount: string;
  // Solo para pasados:
  gano?: boolean;
  tier?: number;
  monto?: string;
  pagado?: boolean;
}

/**
 * Devuelve los tickets de una wallet, separados en vigentes y pasados.
 * Vigentes = sorteo ABIERTO. Pasados = sorteo FINALIZADO/CERRADO/CALCULADO.
 */
export async function getTicketsByWallet(
  db: Database,
  walletAddress: string,
): Promise<{ vigentes: MyTicket[]; pasados: MyTicket[] }> {
  // Traer tickets de esta wallet con join al sorteo
  const rows = await db
    .select({
      id: tickets.id,
      sorteoId: tickets.sorteoId,
      sorteoEstado: sorteos.estado,
      status: tickets.status,
      n1: tickets.n1, n2: tickets.n2, n3: tickets.n3, n4: tickets.n4, n5: tickets.n5,
      powerball: tickets.powerball,
      expectedAmount: tickets.expectedAmount,
    })
    .from(tickets)
    .innerJoin(sorteos, eq(tickets.sorteoId, sorteos.id))
    .where(eq(tickets.walletAddress, walletAddress));

  const vigentes: MyTicket[] = [];
  const pasados: MyTicket[] = [];

  for (const row of rows) {
    const ticket: MyTicket = {
      id: Number(row.id),
      sorteoId: Number(row.sorteoId),
      sorteoEstado: row.sorteoEstado,
      status: row.status,
      n1: row.n1, n2: row.n2, n3: row.n3, n4: row.n4, n5: row.n5,
      powerball: row.powerball,
      expectedAmount: row.expectedAmount,
    };

    if (row.sorteoEstado === "ABIERTO") {
      vigentes.push(ticket);
    } else {
      // Buscar si este ticket ganó en ese sorteo
      const ganadorRows = await db
        .select({ tier: ganadores.tier, monto: ganadores.monto, pagado: ganadores.pagado })
        .from(ganadores)
        .where(eq(ganadores.ticketId, row.id))
        .limit(1);
      const ganador = ganadorRows[0];
      if (ganador) {
        ticket.gano = true;
        ticket.tier = ganador.tier;
        ticket.monto = ganador.monto;
        ticket.pagado = ganador.pagado;
      } else {
        ticket.gano = false;
      }
      pasados.push(ticket);
    }
  }

  return { vigentes, pasados };
}
