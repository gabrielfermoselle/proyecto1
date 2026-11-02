"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { guardarDisponibilidad } from "../actions";

/** Pausar o reanudar la recepción de solicitudes. Cambia al instante y se revierte si falla. */
export function DisponibilidadSwitch({ disponible }: { disponible: boolean }) {
  const [optimista, setOptimista] = useOptimistic(disponible);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function alternar() {
    const nuevo = !optimista;
    setError(null);
    startTransition(async () => {
      setOptimista(nuevo);
      const resultado = await guardarDisponibilidad({ disponible: nuevo });
      if (!resultado.ok) setError(resultado.error);
    });
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={optimista}
        onClick={alternar}
        className="flex w-full items-center justify-between gap-4 rounded-lg border bg-card p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          <span className="block font-semibold">
            {optimista ? "Estoy recibiendo solicitudes" : "Estoy en pausa"}
          </span>
          <span className="text-sm text-muted-foreground">
            {optimista
              ? "Aparecés en el buscador y podés enviar presupuestos."
              : "No aparecés en el buscador ni podés presupuestar. Tus fletes aceptados siguen activos."}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors",
            optimista ? "bg-success" : "bg-input",
          )}
        >
          <span
            className={cn(
              "absolute top-1 size-5 rounded-full bg-card shadow transition-transform",
              optimista ? "translate-x-6" : "translate-x-1",
            )}
          />
        </span>
      </button>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
