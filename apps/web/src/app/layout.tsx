import type { Metadata } from "next";
import "./../styles/globals.css";

export const metadata: Metadata = {
  title: "MYLoto — Lotería Powerball sobre Fractal Bitcoin",
  description: "Lotería cripto verificable on-chain. Hold-to-Earn con Moonyetis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
