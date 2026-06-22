import { type HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-background-card rounded-xl border border-border p-4 ${className}`}
      {...props}
    />
  );
}
