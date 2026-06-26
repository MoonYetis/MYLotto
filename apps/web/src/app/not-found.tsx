import Link from "next/link";

/**
 * Página 404 personalizada. Se muestra cuando una ruta no existe.
 */
export default function NotFound() {
  return (
    <main className="min-h-[60vh] max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-6xl mb-4">🎱</p>
      <h1 className="text-gold text-3xl font-bold mb-2">404</h1>
      <p className="text-muted-light text-sm mb-6">
        Esta página no existe o ya no está disponible.
      </p>
      <Link
        href="/"
        className="inline-block bg-gold text-background font-bold px-6 py-2 rounded-lg hover:brightness-110 transition-all"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
