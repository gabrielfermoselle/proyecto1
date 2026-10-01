"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { retirarPresupuesto } from "../actions";

export function RetirarPresupuesto({ presupuestoId }: { presupuestoId: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <ConfirmDialog
        title="¿Retirar el presupuesto?"
        description="El cliente ya no lo va a ver y no vas a poder enviar otro para esta solicitud."
        confirmLabel="Sí, retirarlo"
        variant="destructive"
        onConfirm={async () => {
          setError(null);
          const resultado = await retirarPresupuesto({ presupuestoId });
          if (!resultado.ok) setError(resultado.error);
        }}
        trigger={(abrir) => (
          <Button type="button" variant="outline" onClick={abrir}>
            Retirar presupuesto
          </Button>
        )}
      />
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
