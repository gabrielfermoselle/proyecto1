"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RadioCard } from "@/components/shared/radio-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FRANJA, FRANJAS_HORARIAS, type FranjaHoraria } from "@/domain/catalogos";
import { fechaIsoAr, sumarDias } from "@/domain/fechas";
import { DIAS_MAXIMOS_PROPUESTA } from "../schemas";

interface DialogoPropuestaProps {
  fechaActual: { fecha: string; franja: FranjaHoraria };
  onProponer: (fecha: string, franja: FranjaHoraria) => Promise<string | null>;
}

/** "Proponer otra fecha": la otra parte la acepta o rechaza con un toque desde el chat. */
export function DialogoPropuesta({ fechaActual, onProponer }: DialogoPropuestaProps) {
  const hoy = fechaIsoAr();
  const [fecha, setFecha] = useState(fechaActual.fecha >= hoy ? fechaActual.fecha : hoy);
  const [franja, setFranja] = useState<FranjaHoraria>(fechaActual.franja);
  const [error, setError] = useState<string | null>(null);
  const sinCambios = fecha === fechaActual.fecha && franja === fechaActual.franja;

  return (
    <ConfirmDialog
      title="Proponer otra fecha"
      description="La otra parte la va a ver en el chat y la puede aceptar con un toque."
      confirmLabel="Enviar propuesta"
      confirmDisabled={sinCambios || !fecha}
      onConfirm={async () => {
        setError(null);
        const problema = await onProponer(fecha, franja);
        if (problema) {
          setError(problema);
          return false;
        }
      }}
      trigger={(abrir) => (
        <Button type="button" variant="ghost" size="icon" onClick={abrir} title="Proponer otra fecha">
          <CalendarPlus aria-hidden="true" />
          <span className="sr-only">Proponer otra fecha</span>
        </Button>
      )}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="propuesta-fecha">Día</Label>
          <Input
            id="propuesta-fecha"
            type="date"
            min={hoy}
            max={sumarDias(hoy, DIAS_MAXIMOS_PROPUESTA)}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Horario</legend>
          <div className="grid grid-cols-2 gap-2">
            {FRANJAS_HORARIAS.map((f) => (
              <RadioCard
                key={f}
                name="propuesta-franja"
                value={f}
                checked={franja === f}
                onChange={() => setFranja(f)}
                title={FRANJA[f].etiqueta}
                className="p-3 text-sm"
              />
            ))}
          </div>
        </fieldset>
        {sinCambios ? (
          <p className="text-sm text-muted-foreground">Es la fecha que ya está acordada.</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
