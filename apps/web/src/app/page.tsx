import { Navbar } from "@/components/ui/Navbar";
import { HeroSection } from "@/components/home/HeroSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { LastResult } from "@/components/home/LastResult";
import { LiveStats } from "@/components/home/LiveStats";
import { Footer } from "@/components/home/Footer";
import { getSorteo } from "@/lib/api";

export default async function HomePage() {
  // Traer el último sorteo finalizado para mostrar en LastResult.
  // Intentamos el sorteo #1 por defecto; si no existe, la sección no renderiza.
  const ultimoSorteo = await getSorteo(1);

  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <LastResult sorteo={ultimoSorteo} />
        <LiveStats />
      </main>
      <Footer />
    </>
  );
}
