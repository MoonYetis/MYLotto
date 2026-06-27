/**
 * Cálculo del calendario de sorteos y utilidades de tiempo.
 * Sorteos: días fijos semanales (ej. Lun/Jue/Sáb) a una hora fija (ej. 20:00)
 * en una timezone sin DST (America/Bogota).
 */

/**
 * Devuelve los componentes de una fecha (año, mes, día, hora, día-semana-ISO)
 * interpretados en la timezone indicada. Usa Intl.DateTimeFormat para evitar
 * dependencias externas (Node 22 lo soporta nativamente).
 */
function getDatePartsInTz(date: Date, timezone: string): {
  year: number; month: number; day: number; hour: number; minute: number;
  weekday: number; // ISO: 1=Lun ... 7=Dom
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 1,
  };
}

/**
 * Construye un Date UTC a partir de componentes tz-locales (year, month, day, hour, min).
 * Calcula el offset real de la timezone en ese momento para no asumir un offset fijo.
 * Así, "20:00 Bogotá" se convierte correctamente a "01:00 UTC del día siguiente".
 */
function dateFromTzParts(
  year: number, month: number, day: number, hour: number, minute: number,
  timezone: string,
): Date {
  // Interpretar los componentes como si fueran UTC (naive) para obtener un instante.
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  // Calcular el offset de la timezone en ese instante comparando cómo se ve
  // el naive en la tz vs en UTC.
  const asUtcParts = getDatePartsInTz(new Date(naive), "UTC");
  const asTzParts = getDatePartsInTz(new Date(naive), timezone);
  // Diferencia en minutos entre la representación naive-UTC y naive-tz.
  const utcMs = Date.UTC(asUtcParts.year, asUtcParts.month - 1, asUtcParts.day, asUtcParts.hour, asUtcParts.minute);
  const tzMs = Date.UTC(asTzParts.year, asTzParts.month - 1, asTzParts.day, asTzParts.hour, asTzParts.minute);
  const offsetMs = tzMs - utcMs;
  // El instante real = naive - offset (porque tz está detrás de UTC).
  return new Date(naive - offsetMs);
}

/**
 * Devuelve el próximo momento de sorteo (días/hora en timezone local).
 *
 * @param now momento actual (cualquier timezone internamente)
 * @param days días ISO sorted ascending (ej. [1,4,6] = Lun, Jue, Sáb)
 * @param hour hora del sorteo (0-23) en timezone local
 * @param timezone timezone IANA (ej. "America/Bogota")
 */
export function getNextDrawTime(
  now: Date,
  days: number[],
  hour: number,
  timezone: string,
): Date {
  const parts = getDatePartsInTz(now, timezone);
  const sortedDays = [...days].sort((a, b) => a - b);

  // ¿Hoy es día de sorteo y aún no llega la hora?
  if (sortedDays.includes(parts.weekday) && parts.hour < hour) {
    return dateFromTzParts(parts.year, parts.month, parts.day, hour, 0, timezone);
  }

  // Buscar el próximo día (iterando hasta 7 días adelante)
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const cp = getDatePartsInTz(candidate, timezone);
    if (sortedDays.includes(cp.weekday)) {
      return dateFromTzParts(cp.year, cp.month, cp.day, hour, 0, timezone);
    }
  }

  // No debería llegar aquí si hay al menos un día válido
  throw new Error("getNextDrawTime: no se encontró próximo día de sorteo en 7 días");
}

/**
 * Estima la altura de bloque para un momento futuro.
 *
 * @param targetTime momento futuro del sorteo
 * @param currentHeight altura actual del bloque
 * @param now momento actual
 * @param blockTimeMs tiempo promedio de bloque (default 600000 = 10 min Fractal)
 */
export function estimateBlockAtTime(
  targetTime: Date,
  currentHeight: number,
  now: Date,
  blockTimeMs = 600_000,
): number {
  const msUntilTarget = targetTime.getTime() - now.getTime();
  const blocksUntilTarget = Math.max(1, Math.ceil(msUntilTarget / blockTimeMs));
  return currentHeight + blocksUntilTarget;
}

/**
 * Formatea un tiempo en ms como cuenta regresiva legible.
 * Ej: 190800000 → "2d 5h 0m"
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Cerrando";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
