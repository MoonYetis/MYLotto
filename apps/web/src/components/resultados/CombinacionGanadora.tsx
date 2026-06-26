import { NumberBall } from "@/components/ui/NumberBall";
import type { SorteoCompleto } from "@/lib/api";

/**
 * Muestra la combinación ganadora de un sorteo.
 * Defensivo: el jsonb de la DB puede tener objetos parciales/incompletos,
 * así que validamos antes de renderizar para no romper toda la tarjeta.
 */
export function CombinacionGanadora({ sorteo }: { sorteo: SorteoCompleto }) {
  const combinacion = sorteo.combinacionGanadora;
  if (
    !combinacion ||
    !Array.isArray(combinacion.balotas) ||
    combinacion.balotas.length === 0 ||
    typeof combinacion.powerball !== "number"
  ) {
    return (
      <p className="text-muted text-sm">Combinación no disponible todavía</p>
    );
  }
  const { balotas, powerball } = combinacion;
  return (
    <div className="flex gap-2 justify-center">
      {balotas.map((b, i) => (
        <NumberBall key={`${b}-${i}`} value={b} variant="ganadora-b" size="lg" />
      ))}
      <NumberBall value={powerball} variant="ganadora-pb" size="lg" />
    </div>
  );
}
