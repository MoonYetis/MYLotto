"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/resultados", label: "Resultados" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-4 justify-center py-4 border-b border-border mb-6">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`text-sm font-semibold transition-colors ${
            pathname === l.href ? "text-gold" : "text-muted-light hover:text-gold"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
