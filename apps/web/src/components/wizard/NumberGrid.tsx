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
    <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
      {numbers.map((n) => {
        const isSelected = selected.includes(n);
        const disabled = !isSelected && full;
        return (
          <button
            key={n}
            disabled={disabled}
            onClick={() => onToggle(n)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center
              ${isSelected
                ? "bg-gold text-background"
                : "bg-background-card text-muted-light hover:bg-border"}
              ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
