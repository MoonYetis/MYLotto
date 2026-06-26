"use client";

import { motion } from "framer-motion";
import { NumberBall } from "@/components/ui/NumberBall";

export function LastResult({
  sorteo,
}: {
  sorteo: {
    id: number;
    combinacionGanadora: { balotas: number[]; powerball: number } | null;
  } | null;
}) {
  if (!sorteo || !sorteo.combinacionGanadora) return null;
  const { balotas, powerball } = sorteo.combinacionGanadora;

  return (
    <section className="py-12 px-4 text-center content-layer border-t border-neon-divider">
      <p className="text-xs text-neon-purple tracking-[3px] font-bold">🏆 ÚLTIMO RESULTADO</p>
      <h2 className="text-lg font-bold text-white mt-2 mb-5">Sorteo #{sorteo.id} · <span className="text-neon-green">FINALIZADO</span></h2>
      <div className="flex gap-3 justify-center items-center mb-4">
        {balotas.map((b, i) => (
          <motion.div
            key={`${b}-${i}`}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, type: "spring" }}
          >
            <NumberBall value={b} variant="ganadora-b" size="lg" />
          </motion.div>
        ))}
        <div className="w-0.5 h-8 bg-border mx-1" />
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: balotas.length * 0.1, type: "spring" }}
        >
          <NumberBall value={powerball} variant="ganadora-pb" size="lg" />
        </motion.div>
      </div>
      <div className="inline-flex items-center gap-2 bg-neon-green/10 border border-neon-green/30 rounded-full px-4 py-1.5 text-xs text-neon-green">
        <span>🔒</span><span>Verificable on-chain</span>
      </div>
    </section>
  );
}
