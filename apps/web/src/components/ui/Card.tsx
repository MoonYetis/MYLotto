import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-background-card/80 border border-neon-pink/20 rounded-2xl p-5 backdrop-blur-sm ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
