"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { BuyWizard } from "@/components/wizard/BuyWizard";
import { useSorteoActivo } from "@/lib/hooks";

export function ComprarButton() {
  const [open, setOpen] = useState(false);
  const { data: sorteo, isLoading } = useSorteoActivo();
  const sinSorteo = !isLoading && !sorteo;
  return (
    <>
      <Button
        variant="primary"
        className="text-lg px-8 py-3 mt-4"
        onClick={() => setOpen(true)}
        disabled={isLoading}
      >
        {isLoading ? "..." : "🎱 Comprar boleto"}
      </Button>
      {sinSorteo && (
        <p className="text-muted text-xs mt-2">
          No hay sorteo activo en este momento
        </p>
      )}
      {open && <BuyWizard onClose={() => setOpen(false)} />}
    </>
  );
}
