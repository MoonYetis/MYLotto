import { JackpotCard } from "@/components/dashboard/JackpotCard";
import { ComprarButton } from "@/components/dashboard/ComprarButton";

export default function HomePage() {
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-gold text-3xl font-bold text-center mb-6">🎱 MYLoto</h1>
      <JackpotCard />
      <div className="text-center mt-4">
        <ComprarButton />
      </div>
    </main>
  );
}
