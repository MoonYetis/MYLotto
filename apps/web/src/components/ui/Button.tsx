"use client";

import type { ReactNode } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-cta-gradient text-white shadow-cta hover:brightness-110 active:scale-95",
  secondary: "bg-transparent border-2 border-neon-purple text-neon-purple hover:bg-neon-purple/10 active:scale-95",
  ghost: "bg-transparent text-muted-light hover:text-neon-cyan",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps & { children: ReactNode }) {
  return (
    <button
      className={`px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
