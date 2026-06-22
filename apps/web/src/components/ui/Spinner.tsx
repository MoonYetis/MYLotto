export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-light">
      <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
