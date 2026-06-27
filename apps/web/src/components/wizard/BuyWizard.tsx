"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { NumberBall } from "@/components/ui/NumberBall";
import { NumberGrid } from "./NumberGrid";
import { PowerballGrid } from "./PowerballGrid";
import { useCreateTicket, useTicketStatus, useSorteoActivo, useSession, useAuth } from "@/lib/hooks";
import { hasWallet } from "@/lib/wallet";
import { BALOTAS_TO_SELECT, BALOTAS_MAX, POWERBALL_MAX } from "@/lib/constants";
import { fireConfetti } from "@/lib/confetti";
import type { TicketResponse } from "@/lib/api";

type Step = "wallet" | "seleccion" | "descuento" | "pago" | "confirmacion";

export function BuyWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("wallet");
  const [balotas, setBalotas] = useState<number[]>([]);
  const [powerball, setPowerball] = useState<number | null>(null);
  const [brc20Address, setBrc20Address] = useState("");
  const [ticket, setTicket] = useState<TicketResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createTicket = useCreateTicket();
  const ticketStatus = useTicketStatus(ticket?.id ?? null);
  const { data: sorteo } = useSorteoActivo();
  const { data: sessionAddress } = useSession();
  const auth = useAuth();

  // Si hay sesión, saltar directamente a selección
  useEffect(() => {
    if (sessionAddress && step === "wallet") {
      setStep("seleccion");
    }
  }, [sessionAddress, step]);

  // Avanzar a confirmación cuando el ticket se activa (en efecto, no en render)
  useEffect(() => {
    if (ticketStatus.data?.status === "ACTIVO" && step === "pago") {
      setStep("confirmacion");
      fireConfetti({ fullScreen: true });
    }
  }, [ticketStatus.data?.status, step]);

  const toggleBalota = (n: number) => {
    setBalotas((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b),
    );
  };

  const handleCrear = async () => {
    if (!powerball || balotas.length !== BALOTAS_TO_SELECT) return;
    setErrorMsg(null);
    try {
      const result = await createTicket.mutateAsync({
        n1: balotas[0]!, n2: balotas[1]!, n3: balotas[2]!, n4: balotas[3]!, n5: balotas[4]!,
        powerball,
        ...(brc20Address ? { brc20Address } : {}),
      });
      setTicket(result);
      setStep("pago");
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "No se pudo crear el boleto. Intenta de nuevo.",
      );
    }
  };

  // Si no hay sorteo activo, el wizard no debería dejar avanzar.
  const sinSorteo = !sorteo;

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-neon-pink text-xl font-bold">
            <span className="drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]">🎱</span>{" "}
            {step === "wallet" && "Conecta tu wallet"}
            {step === "seleccion" && "Elige tus números"}
            {step === "descuento" && "Descuento Hold-to-Earn"}
            {step === "pago" && "Paga con QR"}
            {step === "confirmacion" && "¡Ticket activo!"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-neon-pink text-xl">✕</button>
        </div>

        {/* Barra de progreso de 5 pasos */}
        <div className="flex gap-1.5 mb-5">
          {(["wallet", "seleccion", "descuento", "pago", "confirmacion"] as Step[]).map((s, i) => {
            const allSteps = ["wallet", "seleccion", "descuento", "pago", "confirmacion"] as Step[];
            const currentIdx = allSteps.indexOf(step);
            const isActive = i <= currentIdx;
            return (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition-all ${
                  isActive ? "bg-cta-gradient shadow-glow-pink" : "bg-muted/30"
                }`}
              />
            );
          })}
        </div>

        {/* Paso 0: Conectar wallet */}
        {step === "wallet" && (
          <div className="space-y-4 text-center py-4">
            <p className="text-4xl">🔗</p>
            <p className="text-neon-cyan font-bold text-lg">Conecta tu wallet</p>
            <p className="text-muted-light text-sm">
              Para comprar un boleto necesitas iniciar sesión con tu wallet Bitcoin.
              Firmarás un mensaje criptográfico (sin gas, sin transacción).
            </p>
            {auth.isError && (
              <p className="text-neon-red text-sm">
                {auth.error instanceof Error ? auth.error.message : "Error al conectar wallet"}
              </p>
            )}
            {auth.isPending ? (
              <p className="text-neon-purple text-sm animate-pulse">Conectando... revisa tu wallet</p>
            ) : (
              <Button variant="primary" onClick={() => auth.mutate()} disabled={!hasWallet()}>
                {hasWallet() ? "🔗 Conectar wallet" : "⚠️ Instala UniSat/Xverse"}
              </Button>
            )}
          </div>
        )}

        {/* Aviso: sin sorteo activo */}
        {sinSorteo && step === "seleccion" && (
          <div className="bg-neon-red/10 border border-neon-red/30 rounded-lg p-3 mb-4 text-center">
            <p className="text-neon-red text-sm">
              ⚠️ No hay un sorteo activo ahora mismo. Vuelve cuando abra el próximo sorteo.
            </p>
          </div>
        )}

        {/* Error de creación */}
        {errorMsg && step === "descuento" && (
          <div className="bg-neon-red/10 border border-neon-red/30 rounded-lg p-3 mb-4 text-center">
            <p className="text-neon-red text-sm">{errorMsg}</p>
          </div>
        )}

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
                  while (random.size < BALOTAS_TO_SELECT) random.add(Math.floor(Math.random() * BALOTAS_MAX) + 1);
                  setBalotas([...random].sort((a, b) => a - b));
                  setPowerball(Math.floor(Math.random() * POWERBALL_MAX) + 1);
                }}
              >
                🎲 Aleatorio
              </Button>
              <Button
                variant="primary"
                disabled={sinSorteo || balotas.length !== BALOTAS_TO_SELECT || powerball === null}
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
            <p className="text-neon-yellow font-bold">¿Tienes tokens Moonyetis?</p>
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
            <p className="text-neon-cyan font-bold text-lg">Paga {ticket.expectedAmount} FB</p>
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
            <p className="text-neon-green text-2xl font-bold">✅ ¡Ticket activo!</p>
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
