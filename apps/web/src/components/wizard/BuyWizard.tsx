"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { NumberBall } from "@/components/ui/NumberBall";
import { NumberGrid } from "./NumberGrid";
import { PowerballGrid } from "./PowerballGrid";
import { useCreateTicket, useTicketStatus } from "@/lib/hooks";
import { BALOTAS_TO_SELECT } from "@/lib/constants";
import type { TicketResponse } from "@/lib/api";

type Step = "seleccion" | "descuento" | "pago" | "confirmacion";

export function BuyWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("seleccion");
  const [balotas, setBalotas] = useState<number[]>([]);
  const [powerball, setPowerball] = useState<number | null>(null);
  const [brc20Address, setBrc20Address] = useState("");
  const [ticket, setTicket] = useState<TicketResponse | null>(null);

  const createTicket = useCreateTicket();
  const ticketStatus = useTicketStatus(ticket?.id ?? null);

  // Avanzar a confirmación cuando el ticket se activa
  if (ticketStatus.data?.status === "ACTIVO" && step === "pago") {
    setStep("confirmacion");
  }

  const toggleBalota = (n: number) => {
    setBalotas((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b),
    );
  };

  const handleCrear = async () => {
    if (!powerball || balotas.length !== BALOTAS_TO_SELECT) return;
    const result = await createTicket.mutateAsync({
      n1: balotas[0]!, n2: balotas[1]!, n3: balotas[2]!, n4: balotas[3]!, n5: balotas[4]!,
      powerball,
      ...(brc20Address ? { brc20Address } : {}),
    });
    setTicket(result);
    setStep("pago");
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-gold text-xl font-bold">
            {step === "seleccion" && "Paso 1: Elige tus números"}
            {step === "descuento" && "Paso 2: Descuento Hold-to-Earn"}
            {step === "pago" && "Paso 3: Paga con QR"}
            {step === "confirmacion" && "✅ ¡Ticket activo!"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-gold text-xl">✕</button>
        </div>

        {/* Paso 1: Selección */}
        {step === "seleccion" && (
          <div className="space-y-4">
            <div>
              <p className="text-muted-light text-sm mb-2">Balotas (elige 5 del 1 al 69)</p>
              <NumberGrid selected={balotas} onToggle={toggleBalota} />
            </div>
            <div>
              <p className="text-muted-light text-sm mb-2">Powerball (elige 1 del 1 al 26)</p>
              <PowerballGrid selected={powerball} onSelect={setPowerball} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const random = new Set<number>();
                  while (random.size < 5) random.add(Math.floor(Math.random() * 69) + 1);
                  setBalotas([...random].sort((a, b) => a - b));
                  setPowerball(Math.floor(Math.random() * 26) + 1);
                }}
              >
                🎲 Aleatorio
              </Button>
              <Button
                variant="primary"
                disabled={balotas.length !== 5 || powerball === null}
                onClick={() => setStep("descuento")}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        )}

        {/* Paso 2: Descuento */}
        {step === "descuento" && (
          <div className="space-y-4 text-center">
            <p className="text-4xl">🪙</p>
            <p className="text-gold font-bold">¿Tienes tokens Moonyetis?</p>
            <p className="text-muted-light text-sm">
              Ingresa tu dirección Bitcoin para verificar tu balance BRC-20 y obtener 20% de descuento.
            </p>
            <input
              type="text"
              value={brc20Address}
              onChange={(e) => setBrc20Address(e.target.value)}
              placeholder="bc1q... (opcional)"
              className="w-full bg-background-card border border-border rounded-lg px-4 py-2 text-muted-light placeholder:text-muted text-center font-mono text-sm"
            />
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => setStep("seleccion")}>← Atrás</Button>
              <Button variant="primary" onClick={handleCrear} disabled={createTicket.isPending}>
                {createTicket.isPending ? "Creando..." : "Continuar →"}
              </Button>
            </div>
          </div>
        )}

        {/* Paso 3: Pago QR */}
        {step === "pago" && ticket && (
          <div className="space-y-4 text-center">
            <p className="text-gold font-bold text-lg">Paga {ticket.expectedAmount} FB</p>
            <div className="bg-white rounded-xl p-4 inline-block" dangerouslySetInnerHTML={{ __html: ticket.qrSvg }} />
            <p className="text-muted-light text-sm">Escanea con Sparrow / UniSat o copia:</p>
            <div className="flex gap-2 justify-center">
              <code className="bg-background-card px-3 py-1 rounded text-xs text-muted-light font-mono break-all max-w-xs">
                {ticket.paymentAddress}
              </code>
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(ticket.paymentAddress)}
              >
                Copiar
              </Button>
            </div>
            <Spinner label="⏳ Esperando pago..." />
          </div>
        )}

        {/* Paso 4: Confirmación */}
        {step === "confirmacion" && ticket && (
          <div className="space-y-4 text-center">
            <p className="text-green text-2xl font-bold">¡Ticket activo!</p>
            <div className="bg-background-card rounded-xl p-4 inline-block">
              <p className="text-muted text-xs mb-2">Tu combinación</p>
              <div className="flex gap-2 justify-center">
                {balotas.map((b) => (
                  <NumberBall key={b} value={b} variant="balota" />
                ))}
                {powerball && <NumberBall value={powerball} variant="powerball" />}
              </div>
            </div>
            <p className="text-muted-light text-sm">Ticket #{ticket.id} · Sorteo #{ticket.sorteoId}</p>
            <Button variant="primary" onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
