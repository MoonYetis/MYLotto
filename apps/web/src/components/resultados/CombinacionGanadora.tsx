import { NumberBall } from "@/components/ui/NumberBall";
import type { SorteoCompleto } from "@/lib/api";

export function CombinacionGanadora({ sorteo }: { sorteo: SorteoCompleto }) {
  if (!sorteo.combinacionGanadora) return null;
  const { balotas, powerball } = sorteo.combinacionGanadora;
  return (
    <div className="flex gap-2 justify-center">
      {balotas.map((b) => (
        <NumberBall key={b} value={b} variant="ganadora-b" size="lg" />
      ))}
      <NumberBall value={powerball} variant="ganadora-pb" size="lg" />
    </div>
  );
}
