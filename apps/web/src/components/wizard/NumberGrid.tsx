"use client";

import { BALOTAS_MAX, BALOTAS_TO_SELECT } from "@/lib/constants";

export function NumberGrid({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (n: number) => void;
}) {
  const numbers = Array.from({ length: BALOTAS_MAX }, (_, i) => i + 1);
  const full = selected.length >= BALOTAS_TO_SELECT;

  return (
    <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
      {numbers.map((n) => {
        const isSelected = selected.includes(n);
        const disabled = !isSelected && full;
        return (
          <button
            key={n}
            disabled={disabled}
            onClick={() => onToggle(n)}
            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center
              ${isSelected
                ? "bg-balota-pink text-white border-2 border-neon-pink shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                : "bg-background-card text-muted-light border border-border hover:border-neon-cyan"}
              ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
