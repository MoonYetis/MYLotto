type BallVariant =
  | "balota"
  | "powerball"
  | "ganadora-b"
  | "ganadora-pb"
  | "muted";

const styles: Record<BallVariant, string> = {
  "balota": "bg-balota-pink text-white border-neon-pink/30 shadow-glow-pink",
  "powerball": "bg-balota-yellow text-background border-neon-yellow/40 shadow-glow-yellow",
  "ganadora-b": "bg-balota-cyan text-white border-neon-cyan/40 shadow-glow-cyan",
  "ganadora-pb": "bg-balota-yellow text-background border-neon-yellow/40 shadow-glow-yellow",
  "muted": "bg-background-card text-muted border-border",
};

const sizes = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
} as const;

export function NumberBall({
  value,
  variant = "balota",
  size = "md",
}: {
  value: number;
  variant?: BallVariant;
  size?: "sm" | "md" | "lg";
}) {
  const isPowerball = variant === "powerball" || variant === "ganadora-pb";
  return (
    <div
      className={`${sizes[size]} ${styles[variant]} ${
        isPowerball ? "rounded-full" : "rounded-lg"
      } border-2 flex items-center justify-center font-extrabold flex-shrink-0`}
    >
      {value}
    </div>
  );
}
