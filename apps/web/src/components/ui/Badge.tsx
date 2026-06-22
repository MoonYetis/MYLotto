type BadgeVariant = "activo" | "pendiente" | "finalizado" | "abierto" | "cerrado";

const styles: Record<BadgeVariant, string> = {
  activo: "bg-green/20 text-green",
  pendiente: "bg-muted/20 text-muted-light",
  finalizado: "bg-blue-500/20 text-blue-400",
  abierto: "bg-gold/20 text-gold",
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
    <span className={`px-2 py-1 rounded-md text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}
