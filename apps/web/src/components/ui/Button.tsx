"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-cta-gradient text-white shadow-cta",
  secondary: "bg-transparent border-2 border-neon-purple text-neon-purple",
  ghost: "bg-transparent text-muted-light hover:text-neon-cyan",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      className={`px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className ?? ""}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
