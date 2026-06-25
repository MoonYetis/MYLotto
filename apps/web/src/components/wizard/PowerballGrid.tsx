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
                ? "bg-red text-white"
                : "bg-background-card text-muted-light hover:bg-border"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
