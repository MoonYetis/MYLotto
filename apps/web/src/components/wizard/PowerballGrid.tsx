"use client";

import { POWERBALL_MAX } from "@/lib/constants";

export function PowerballGrid({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (n: number) => void;
}) {
  const numbers = Array.from({ length: POWERBALL_MAX }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
      {numbers.map((n) => {
        const isSelected = selected === n;
        return (
          <button
            key={n}
            onClick={() => onSelect(n)}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center
              ${isSelected
                ? "bg-balota-yellow text-background border-2 border-neon-yellow shadow-[0_0_10px_rgba(250,204,21,0.6)]"
                : "bg-background-card text-muted-light border border-border hover:border-neon-yellow"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
