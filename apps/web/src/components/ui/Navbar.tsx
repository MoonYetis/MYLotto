import Link from "next/link";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/resultados", label: "Resultados" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-neon-pink/25 bg-background/80 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-extrabold text-white flex items-center gap-2">
          <span className="text-2xl drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">🎱</span>
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">MYLoto</span>
        </Link>
        <div className="flex gap-6 text-sm font-semibold">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-light hover:text-neon-pink hover:drop-shadow-[0_0_6px_rgba(236,72,153,0.8)] transition-all"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
