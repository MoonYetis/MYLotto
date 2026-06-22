type BallVariant = "balota" | "powerball" | "ganadora-b" | "ganadora-pb" | "muted";

const styles: Record<BallVariant, string> = {
  "balota": "bg-gold text-background",
  "powerball": "bg-red text-white",
  "ganadora-b": "bg-gold text-background shadow-[0_0_12px_rgba(245,158,11,0.4)]",
  "ganadora-pb": "bg-red text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]",
  "muted": "bg-border text-muted",
};

export function NumberBall({
  value,
  variant = "balota",
  size = "md",
}: {
  value: number;
  variant?: BallVariant;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };
  return (
    <div
      className={`${sizes[size]} ${styles[variant]} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
    >
      {value}
    </div>
  );
}
