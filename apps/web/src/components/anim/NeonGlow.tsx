"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wrapper que aplica un glow pulsante a sus hijos.
 */
export function NeonGlow({
  children,
  color = "pink",
  className,
}: {
  children: ReactNode;
  color?: "pink" | "cyan" | "yellow";
  className?: string;
}) {
  const glowMap = {
    pink: "shadow-glow-pink",
    cyan: "shadow-glow-cyan",
    yellow: "shadow-glow-yellow",
  } as const;
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    return <div className={`${glowMap[color]} ${className ?? ""}`}>{children}</div>;
  }

  return (
    <motion.div
      className={`${glowMap[color]} ${className ?? ""}`}
      animate={{ boxShadow: [
        "0 0 15px rgba(236,72,153,0.4)",
        "0 0 30px rgba(236,72,153,0.7)",
        "0 0 15px rgba(236,72,153,0.4)",
      ]}}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
