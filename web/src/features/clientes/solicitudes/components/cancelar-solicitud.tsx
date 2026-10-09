"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MOTIVOS_CANCELACION } from "@/domain/catalogos";
import { cancelarSolicitud } from "../actions";

const OTRO = "Otro";

/** Cancelar el pedido antes de elegir un presupuesto, con el motivo (lo ven los fleteros). */
export function CancelarSolicitud({
  solicitudId,
  presupuestos,
}: {
  solicitudId: string;
  presupuestos: number;
}) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idDetalle = useId();
  const nombre = useId();
  const texto = motivo === OTRO ? detalle.trim() : motivo;

  return (
    <ConfirmDialog
      title="¿Cancelar el pedido?"
      description={
        presupuestos > 0
          ? `${presupuestos === 1 ? "El fletero que te presupuestó recibe" : `Los ${presupuestos} fleteros que te presupuestaron reciben`} el aviso con el motivo y sus chats quedan cerrados.`
          : "Deja de aparecer para los fleteros."
      }
      confirmLabel="Cancelar el pedido"
      variant="destructive"
      confirmDisabled={!texto}
      onConfirm={async () => {
        setError(null);
        const r = await cancelarSolicitud({ solicitudId, motivo: texto ?? undefined });
        if (!r.ok) {
          setError(r.error);
          return false;
        }
      }}
      trigger={(abrir) => (
        <Button type="button" variant="ghost" className="justify-self-start text-destructive" onClick={abrir}>
          Cancelar el pedido
        </Button>
      )}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">¿Por qué lo cancelás?</legend>
        {MOTIVOS_CANCELACION.map((m) => (
          <label
            key={m}
            className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <input
              type="radio"
              name={nombre}
              value={m}
              checked={motivo === m}
              onChange={() => setMotivo(m)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            {m}
          </label>
        ))}
      </fieldset>
      {motivo === OTRO ? (
        <div className="grid gap-2">
          <Label htmlFor={idDetalle}>Contalo en pocas palabras</Label>
          <Textarea
            id={idDetalle}
            rows={2}
            maxLength={300}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
