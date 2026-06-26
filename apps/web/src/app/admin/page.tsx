import { CrearSorteoForm } from "@/components/admin/CrearSorteoForm";
import { GanadoresAdmin } from "@/components/admin/GanadoresAdmin";
import { Navbar } from "@/components/ui/Navbar";

export default function AdminPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-2xl mx-auto px-4 py-8 content-layer">
        <h1 className="text-2xl font-black text-white text-center mb-6">
          <span className="drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]">⚙️ Admin</span>
        </h1>
        <div className="bg-gradient-to-r from-neon-yellow/10 to-neon-pink/10 border border-neon-yellow/30 rounded-xl p-3 mb-6 text-center">
          <p className="text-xs text-neon-yellow font-bold">⚠️ Panel de administración — sin auth</p>
        </div>
        <div className="space-y-6">
          <CrearSorteoForm />
          <GanadoresAdmin />
        </div>
      </main>
    </>
  );
}
