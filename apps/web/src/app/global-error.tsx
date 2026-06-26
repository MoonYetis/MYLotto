"use client";

/**
 * Error boundary global: captura errores del propio RootLayout (incluido <html>/<body>).
 * Debe renderizar sus propios <html>/<body> porque reemplaza al layout raíz.
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error global capturado:", error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ backgroundColor: "#0f0f1e", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
          <p style={{ fontSize: "3rem", marginBottom: "1rem" }}>🚨</p>
          <h1 style={{ color: "#fbbf24", fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Error de aplicación
          </h1>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem", maxWidth: "28rem" }}>
            La aplicación no pudo cargarse. Intenta recargar la página.
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: "#fbbf24",
              color: "#0f0f1e",
              fontWeight: 700,
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
