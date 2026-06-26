"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/anim/CountUp";
import { useSorteoActivo, useJackpot } from "@/lib/hooks";

export function LiveStats() {
  const { data: sorteo } = useSorteoActivo();
  const { data: jackpot } = useJackpot();

  return (
    <section className="py-12 px-4 content-layer border-t border-neon-divider">
      <div className="text-center mb-6">
        <p className="text-xs text-neon-cyan tracking-[3px] font-bold">📊 EN VIVO</p>
        <h2 className="text-xl font-black text-white mt-2">Stats del sorteo actual</h2>
      </div>
      <div className="flex gap-4 justify-center max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex-1 bg-neon-pink/5 border border-neon-pink/20 rounded-xl p-5 text-center"
        >
          <div className="text-3xl font-black text-neon-pink">
            {sorteo ? <CountUp value={sorteo.id * 20} /> : "—"}
          </div>
          <div className="text-xs text-muted-light mt-1 tracking-wide">BOLETOS VENDIDOS</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl p-5 text-center"
        >
          <div className="text-3xl font-black text-neon-cyan">{sorteo ? "8h" : "—"}</div>
          <div className="text-xs text-muted-light mt-1 tracking-wide">TIEMPO RESTANTE</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-neon-yellow/5 border border-neon-yellow/20 rounded-xl p-5 text-center"
        >
          <div className="text-3xl font-black text-neon-yellow">
            {jackpot ? <CountUp value={jackpot.saldo / 1000000} decimals={1} /> : "—"}
          </div>
          <div className="text-xs text-muted-light mt-1 tracking-wide">PREMIO ACTUAL (M)</div>
        </motion.div>
      </div>
    </section>
  );
}
