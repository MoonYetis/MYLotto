"use client";

import { motion } from "framer-motion";

// IMPORTANTE: Tailwind purga clases que no aparecen literalmente.
// Por eso usamos un lookup con STRINGS LITERALES completos (no `bg-${var}`).
const steps = [
  {
    num: 1,
    icon: "🎱",
    title: "Elige números",
    desc: "5 balotas (1-69) + 1 powerball (1-26)",
    circle: "bg-balota-pink shadow-glow-pink",
    label: "text-neon-pink",
  },
  {
    num: 2,
    icon: "₿",
    title: "Paga con FB",
    desc: "Escanea el QR o copia la dirección Taproot",
    circle: "bg-balota-cyan shadow-glow-cyan",
    label: "text-neon-cyan",
  },
  {
    num: 3,
    icon: "🏆",
    title: "¡Gana!",
    desc: "Sorteo verificable on-chain con aleatoriedad criptográfica",
    circle: "bg-balota-yellow shadow-glow-yellow",
    label: "text-neon-yellow",
  },
];

export function HowItWorks() {
  return (
    <section className="py-12 px-4 text-center content-layer">
      <p className="text-xs text-neon-cyan tracking-[3px] font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">⚡ CÓMO FUNCIONA ⚡</p>
      <h2 className="text-2xl font-black text-white mt-2 mb-8">3 pasos para ganar</h2>
      <div className="flex flex-col md:flex-row gap-4 justify-center max-w-2xl mx-auto">
        {steps.map((s, i) => (
          <motion.div
            key={s.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="flex-1 bg-background-card/80 border border-neon-pink/20 rounded-2xl p-6"
          >
            <div className={`w-14 h-14 mx-auto mb-3 ${s.circle} rounded-full flex items-center justify-center text-2xl`}>
              {s.icon}
            </div>
            <div className={`text-xs font-bold tracking-wide mb-2 ${s.label}`}>PASO {s.num}</div>
            <div className="text-base font-bold text-white mb-1">{s.title}</div>
            <div className="text-xs text-muted-light leading-relaxed">{s.desc}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
