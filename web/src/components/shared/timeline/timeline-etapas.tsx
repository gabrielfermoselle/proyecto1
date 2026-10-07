import { Check, X } from "lucide-react";
import { formatearFechaHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { EstadoPaso, PasoTimeline } from "./tipos";

const ESTADO_ACCESIBLE: Record<EstadoPaso, string> = {
  hecho: "hecho",
  actual: "etapa actual",
  pendiente: "pendiente",
  cancelado: "cancelado",
};

function Marcador({ estado }: { estado: EstadoPaso }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 bg-card",
        estado === "hecho" && "border-success bg-success text-success-foreground",
        estado === "actual" && "border-primary",
        estado === "pendiente" && "border-input",
        estado === "cancelado" && "border-destructive bg-destructive text-destructive-foreground",
      )}
    >
      {estado === "hecho" ? <Check className="size-4" /> : null}
      {estado === "cancelado" ? <X className="size-4" /> : null}
      {estado === "actual" ? <span className="size-2.5 animate-pulse rounded-full bg-primary" /> : null}
    </span>
  );
}

/**
 * Línea de tiempo vertical con la hora de cada paso. La descripción se muestra solo en el paso
 * actual (y en el cancelado), para que la lista se lea de un vistazo.
 */
export function TimelineEtapas({
  pasos,
  etiqueta = "Etapas",
  className,
}: {
  pasos: PasoTimeline[];
  etiqueta?: string;
  className?: string;
}) {
  return (
    <ol aria-label={etiqueta} className={cn("grid", className)}>
      {pasos.map((paso, i) => {
        const ultimo = i === pasos.length - 1;
        const destacado = paso.estado === "actual" || paso.estado === "cancelado";
        return (
          <li
            key={paso.clave}
            aria-current={paso.estado === "actual" ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!ultimo ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5",
                  paso.estado === "hecho" ? "bg-success" : "bg-border",
                )}
              />
            ) : null}
            <Marcador estado={paso.estado} />
            <div className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span
                  className={cn(
                    "font-semibold",
                    paso.estado === "pendiente" && "text-muted-foreground",
                    paso.estado === "cancelado" && "text-destructive",
                  )}
                >
                  {paso.titulo}
                  <span className="sr-only"> ({ESTADO_ACCESIBLE[paso.estado]})</span>
                </span>
                {paso.fecha ? (
                  <time
                    dateTime={paso.fecha.toISOString()}
                    className="text-sm tabular-nums text-muted-foreground"
                  >
                    {formatearFechaHora(paso.fecha)}
                  </time>
                ) : null}
              </p>
              {destacado && paso.descripcion ? (
                <p className="text-sm text-muted-foreground">{paso.descripcion}</p>
              ) : null}
              {paso.detalle}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
