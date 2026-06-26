"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = ["#ec4899", "#22d3ee", "#facc15", "#a78bfa"];

/**
 * Partículas flotantes decorativas de fondo. Lightweight: solo posiciona
 * N divs con animación de Framer Motion.
 */
export function Particles({ count = 10 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 3 + Math.random() * 4,
        color: COLORS[i % COLORS.length],
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 4,
      })),
    [count],
  );

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
