import { CrearSorteoForm } from "@/components/admin/CrearSorteoForm";
import { GanadoresAdmin } from "@/components/admin/GanadoresAdmin";
import { Card } from "@/components/ui/Card";

export default function AdminPage() {
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-gold text-2xl font-bold text-center mb-2">⚙️ Panel Admin</h1>
      <Card className="mb-6 border-gold/30 bg-gold/5">
        <p className="text-gold text-sm text-center">
          ⚠️ Panel de administración — sin auth. Opera con cuidado.
        </p>
      </Card>
      <div className="space-y-4">
        <CrearSorteoForm />
        <GanadoresAdmin />
      </div>
    </main>
  );
}
