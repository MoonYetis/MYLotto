import { describe, it, expect } from "vitest";
import { getNextDrawTime, formatCountdown } from "../services/schedule.js";

describe("getNextDrawTime", () => {
  // Días ISO: 1=Lun, 4=Jue, 6=Sáb. Hora: 20. Timezone: America/Bogota (UTC-5, sin DST).
  // 20:00 Bogotá = 01:00 UTC del día siguiente.
  const days = [1, 4, 6];
  const hour = 20;
  const tz = "America/Bogota";

  it("martes 15:00 Bogotá → próximo jueves 20:00 Bogotá", () => {
    // Mar 27 ene 2026, 15:00 Bogotá = 20:00 UTC
    const now = new Date("2026-01-27T20:00:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Jue 29 ene 2026, 20:00 Bogotá = 2026-01-30T01:00:00Z
    expect(next.toISOString()).toBe("2026-01-30T01:00:00.000Z");
  });

  it("jueves 19:00 Bogotá → hoy jueves 20:00 (aún no llega la hora)", () => {
    // Jue 29 ene 2026, 19:00 Bogotá = 2026-01-30T00:00:00Z
    const now = new Date("2026-01-30T00:00:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Jue 29 ene 2026, 20:00 Bogotá = 2026-01-30T01:00:00Z
    expect(next.toISOString()).toBe("2026-01-30T01:00:00.000Z");
  });

  it("jueves 20:30 Bogotá → próximo sábado 20:00 (ya pasó la hora de hoy)", () => {
    // Jue 29 ene 2026, 20:30 Bogotá = 2026-01-30T01:30:00Z
    const now = new Date("2026-01-30T01:30:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Sáb 31 ene 2026, 20:00 Bogotá = 2026-02-01T01:00:00Z
    expect(next.toISOString()).toBe("2026-02-01T01:00:00.000Z");
  });

  it("domingo 20:30 Bogotá → próximo lunes 20:00 (wrap de semana)", () => {
    // Dom 1 feb 2026, 20:30 Bogotá = 2026-02-02T01:30:00Z
    const now = new Date("2026-02-02T01:30:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Lun 2 feb 2026, 20:00 Bogotá = 2026-02-03T01:00:00Z
    expect(next.toISOString()).toBe("2026-02-03T01:00:00.000Z");
  });

  it("lunes 18:00 Bogotá → hoy lunes 20:00", () => {
    // Lun 26 ene 2026, 18:00 Bogotá = 2026-01-26T23:00:00Z
    const now = new Date("2026-01-26T23:00:00Z");
    const next = getNextDrawTime(now, days, hour, tz);
    // Lun 26 ene 2026, 20:00 Bogotá = 2026-01-27T01:00:00Z
    expect(next.toISOString()).toBe("2026-01-27T01:00:00.000Z");
  });
});

describe("formatCountdown", () => {
  it("formatea días+horas+minutos", () => {
    // 2d 5h 0m = 53h = 190800000 ms
    expect(formatCountdown(190800000)).toBe("2d 5h 0m");
  });

  it("formatea solo horas+minutos si < 1 día", () => {
    // 4h 30m = 16200000 ms
    expect(formatCountdown(16200000)).toBe("4h 30m");
  });

  it("formatea solo minutos si < 1 hora", () => {
    // 30m = 1800000 ms
    expect(formatCountdown(1800000)).toBe("30m");
  });

  it("devuelve 'Cerrando' si es 0 o negativo", () => {
    expect(formatCountdown(0)).toBe("Cerrando");
    expect(formatCountdown(-1000)).toBe("Cerrando");
  });
});
