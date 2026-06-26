import confetti from "canvas-confetti";

/**
 * Dispara confeti con la paleta neon de MYLoto.
 * Centralizado para testear y reutilizar desde cualquier componente.
 */
export function fireConfetti(opts?: {
  x?: number;
  y?: number;
  fullScreen?: boolean;
}) {
  const colors = ["#ec4899", "#22d3ee", "#facc15", "#a78bfa"];
  if (opts?.fullScreen) {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors,
      zIndex: 9999,
    });
    return;
  }
  confetti({
    particleCount: 60,
    spread: 70,
    origin: { x: opts?.x ?? 0.5, y: opts?.y ?? 0.5 },
    colors,
    zIndex: 9999,
  });
}
