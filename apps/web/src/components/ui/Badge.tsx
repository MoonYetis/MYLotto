type BadgeVariant = "activo" | "pendiente" | "finalizado" | "abierto" | "cerrado";

const styles: Record<BadgeVariant, string> = {
  activo: "bg-neon-green/20 text-neon-green",
  pendiente: "bg-neon-yellow/20 text-neon-yellow",
  finalizado: "bg-neon-green/20 text-neon-green",
  abierto: "bg-neon-cyan/20 text-neon-cyan",
  cerrado: "bg-muted/20 text-muted-light",
};

export function Badge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-semibold border border-current/20 ${styles[variant]}`}>
      {children}
    </span>
  );
}
