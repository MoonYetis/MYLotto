"use client";

/**
 * Error boundary de ruta: captura errores de cualquier página (/resultados, /admin, ...).
 * Mantiene el Navbar del layout y muestra un mensaje de recuperación con la marca.
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En producción esto lo captura tu servicio de telemetría si lo configuras.
    console.error("Error de ruta capturado:", error);
  }, [error]);

  return (
    <main className="min-h-[60vh] max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-5xl mb-4">⚠️</p>
      <h1 className="text-gold text-2xl font-bold mb-2">Algo salió mal</h1>
      <p className="text-muted-light text-sm mb-6">
        Ocurrió un error inesperado al cargar esta página. Puedes intentarlo de nuevo.
      </p>
      <Button variant="primary" onClick={() => reset()}>
        Reintentar
      </Button>
    </main>
  );
}
