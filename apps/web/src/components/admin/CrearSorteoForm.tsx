"use client";

import { useCreateSorteo } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function CrearSorteoForm() {
  const createSorteo = useCreateSorteo();

  return (
    <Card>
      <p className="text-muted-light text-sm mb-3">Crear nuevo sorteo</p>
      <Button
        variant="primary"
        onClick={() => createSorteo.mutate()}
        disabled={createSorteo.isPending}
      >
        {createSorteo.isPending ? "Creando..." : "🎱 Crear sorteo"}
      </Button>
      {createSorteo.data && (
        <p className="text-green text-sm mt-2">
          ✓ Sorteo #{createSorteo.data.id} creado · Cierra en bloque {createSorteo.data.bloqueCierre}
        </p>
      )}
      {createSorteo.isError && (
        <p className="text-red text-sm mt-2">Error: {createSorteo.error.message}</p>
      )}
    </Card>
  );
}
