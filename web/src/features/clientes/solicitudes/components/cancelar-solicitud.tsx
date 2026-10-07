"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cancelarSolicitud } from "../actions";

export function CancelarSolicitud({
  solicitudId,
  presupuestos,
}: {
  solicitudId: string;
  presupuestos: number;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      title="¿Cancelar la solicitud?"
      description={
        presupuestos > 0
          ? `Los ${presupuestos === 1 ? "fletero que te presupuestó va" : `${presupuestos} fleteros que te presupuestaron van`} a recibir el aviso y sus chats quedan cerrados.`
          : "Deja de aparecer para los fleteros."
      }
      confirmLabel="Cancelar la solicitud"
      variant="destructive"
      onConfirm={async () => {
        setError(null);
        const r = await cancelarSolicitud({ solicitudId });
        if (!r.ok) {
          setError(r.error);
          return false;
        }
      }}
      trigger={(abrir) => (
        <Button type="button" variant="ghost" className="justify-self-start text-destructive" onClick={abrir}>
          Cancelar la solicitud
        </Button>
      )}
    >
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
