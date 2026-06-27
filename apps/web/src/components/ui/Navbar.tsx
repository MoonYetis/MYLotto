"use client";

import Link from "next/link";
import { useSession } from "@/lib/hooks";
import { logout } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/resultados", label: "Resultados" },
  { href: "/mis-boletos", label: "Mis Boletos" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const { data: address } = useSession();
  const qc = useQueryClient();

  const handleLogout = async () => {
    await logout();
    qc.invalidateQueries({ queryKey: ["session"] });
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-neon-pink/25 bg-background/80 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-extrabold text-white flex items-center gap-2">
          <span className="text-2xl drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">🎱</span>
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">MYLoto</span>
        </Link>
        <div className="flex gap-4 text-sm font-semibold items-center">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-light hover:text-neon-pink hover:drop-shadow-[0_0_6px_rgba(236,72,153,0.8)] transition-all"
            >
              {l.label}
            </Link>
          ))}
          {address && (
            <>
              <span className="text-neon-green text-xs font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button onClick={handleLogout} className="text-muted hover:text-neon-red text-xs">
                Salir
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
