"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/anim/CountUp";
import { Particles } from "@/components/anim/Particles";
import { ComprarButton } from "@/components/dashboard/ComprarButton";
import { useJackpot, useSorteoActivo, useCountdown } from "@/lib/hooks";

export function HeroSection() {
  const { data: jackpot } = useJackpot();
  const { data: sorteo } = useSorteoActivo();
  const countdown = useCountdown(sorteo?.bloqueCierre);

  return (
    <section className="relative overflow-hidden">
      <Particles count={12} />
      {/* glow radial detrás del jackpot */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[radial-gradient(ellipse,rgba(236,72,153,0.25),transparent_70%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center py-16 px-4 content-layer">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-neon-cyan tracking-[4px] uppercase drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] font-bold"
        >
          ⚡ Mega Jackpot ⚡
        </motion.div>

        {jackpot ? (
          <div className="my-4 relative">
            <CountUp
              value={jackpot.saldo}
              decimals={2}
              className="text-5xl md:text-6xl font-black text-white font-serif tracking-wide drop-shadow-[0_0_20px_rgba(236,72,153,0.6)]"
            />
            <span className="block text-xl font-bold text-neon-yellow drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">FB</span>
          </div>
        ) : (
          <div className="text-4xl text-muted animate-pulse my-4">Cargando...</div>
        )}

        {sorteo && (
          <div className="flex gap-4 text-sm text-neon-purple mb-6">
            <span>🎫 Sorteo #{sorteo.id} · {sorteo.estado}</span>
            <span>⏱ Cierra en {countdown ?? "..."}</span>
          </div>
        )}

        <ComprarButton />

        <div className="flex gap-6 mt-8 text-xs text-muted">
          <span>⛓️ On-chain Fractal</span>
          <span>🔒 Verificable</span>
          <span>💎 Hold-to-Earn</span>
        </div>
      </div>
    </section>
  );
}
