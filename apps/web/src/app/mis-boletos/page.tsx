"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, useMyTickets } from "@/lib/hooks";
import { Navbar } from "@/components/ui/Navbar";
import { Spinner } from "@/components/ui/Spinner";
import { TicketCard } from "@/components/me/TicketCard";

export default function MisBoletosPage() {
  const [tab, setTab] = useState<"vigentes" | "pasados">("vigentes");
  const { data: address, isLoading: sessionLoading } = useSession();
  const { data: tickets, isLoading } = useMyTickets();
  const router = useRouter();

  if (sessionLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center content-layer">
          <Spinner label="Cargando..." />
        </div>
      </>
    );
  }

  if (!address) {
    // Sin sesión → redirigir a home
    router.push("/");
    return null;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-2xl mx-auto px-4 py-8 content-layer">
        <h1 className="text-2xl font-black text-white text-center mb-2">
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">🎫 Mis Boletos</span>
        </h1>
        <p className="text-center text-xs text-neon-purple mb-6 font-mono">
          {address.slice(0, 8)}...{address.slice(-4)}
        </p>

        {/* Pestañas */}
        <div className="flex gap-2 mb-6 border-b border-neon-pink/20">
          <button
            onClick={() => setTab("vigentes")}
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
              tab === "vigentes" ? "border-neon-pink text-neon-pink" : "border-transparent text-muted hover:text-muted-light"
            }`}
          >
            🟢 Vigentes ({tickets?.vigentes.length ?? 0})
          </button>
          <button
            onClick={() => setTab("pasados")}
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
              tab === "pasados" ? "border-neon-cyan text-neon-cyan" : "border-transparent text-muted hover:text-muted-light"
            }`}
          >
            🏆 Pasados ({tickets?.pasados.length ?? 0})
          </button>
        </div>

        {isLoading ? (
          <Spinner label="Cargando boletos..." />
        ) : tab === "vigentes" ? (
          tickets?.vigentes.length ? (
            <div className="space-y-3">
              {tickets.vigentes.map((t) => <TicketCard key={t.id} ticket={t} />)}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No tienes boletos vigentes</p>
          )
        ) : (
          tickets?.pasados.length ? (
            <div className="space-y-3">
              {tickets.pasados.map((t) => <TicketCard key={t.id} ticket={t} />)}
            </div>
          ) : (
            <p className="text-center text-muted py-8">No tienes boletos pasados todavía</p>
          )
        )}
      </main>
    </>
  );
}
