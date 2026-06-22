import type { Metadata } from "next";
import { QueryProvider } from "@/components/QueryProvider";
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
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
