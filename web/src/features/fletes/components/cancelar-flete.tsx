"use client";

import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EtapaFlete } from "@/domain/catalogos";
import { LARGO_MINIMO_MOTIVO, puedeCancelar, type Actor, type ResumenInventario } from "@/domain/ciclo-flete";
import { cancelarFlete } from "../actions";

const TEXTOS: Record<Actor, { boton: string; descripcion: string; placeholder: string }> = {
  FLETERO: {
    boton: "No puedo hacer este flete",
    descripcion:
      "El cliente va a tener que publicar la solicitud de nuevo. Cancelar seguido afecta tu reputación.",
    placeholder: "Ej.: Se me rompió el vehículo y no llego a repararlo para esa fecha.",
  },
  CLIENTE: {
    boton: "Cancelar el flete",
    descripcion: "El chat queda bloqueado y vas a tener que publicar la solicitud de nuevo.",
    placeholder: "Ej.: Se postergó la mudanza y todavía no tengo fecha nueva.",
  },
};

export function CancelarFlete({
  fleteId,
  etapa,
  rol,
  resumen,
}: {
  fleteId: string;
  etapa: EtapaFlete;
  rol: Actor;
  resumen: ResumenInventario;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idMotivo = useId();
  if (!puedeCancelar(etapa, rol, resumen)) return null;
  const textos = TEXTOS[rol];

  return (
    <ConfirmDialog
      title="¿Cancelar el flete?"
      description={textos.descripcion}
      confirmLabel="Cancelar el flete"
      variant="destructive"
      confirmDisabled={motivo.trim().length < LARGO_MINIMO_MOTIVO}
      onConfirm={async () => {
        setError(null);
        const r = await cancelarFlete({ fleteId, motivo });
        if (!r.ok) {
          setError(r.error);
          return false;
        }
      }}
      trigger={(abrir) => (
        <Button type="button" variant="ghost" className="justify-self-start text-destructive" onClick={abrir}>
          {textos.boton}
        </Button>
      )}
    >
      <div className="grid gap-2">
        <Label htmlFor={idMotivo}>Motivo (lo ve {rol === "FLETERO" ? "el cliente" : "el fletero"})</Label>
        <Textarea
          id={idMotivo}
          rows={3}
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={textos.placeholder}
        />
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
