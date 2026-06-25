"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { BuyWizard } from "@/components/wizard/BuyWizard";

export function ComprarButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        className="text-lg px-8 py-3 mt-4"
        onClick={() => setOpen(true)}
      >
        🎱 Comprar boleto
      </Button>
      {open && <BuyWizard onClose={() => setOpen(false)} />}
    </>
  );
}
