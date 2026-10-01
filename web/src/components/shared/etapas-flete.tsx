import { Check } from "lucide-react";
import { ETIQUETA_ETAPA, type EtapaFlete } from "@/domain/catalogos";
import { cn } from "@/lib/utils";

const RECORRIDO: EtapaFlete[] = ["CONFIRMADO", "CARGADO", "EN_TRANSITO", "ENTREGADO", "COMPLETADO"];

/** Progreso del flete por etapas. Lo usan el fletero y el cliente. */
export function EtapasFlete({ etapa }: { etapa: EtapaFlete }) {
  if (etapa === "CANCELADO") return null;
  const actual = RECORRIDO.indexOf(etapa);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Etapas del flete">
      {RECORRIDO.map((e, i) => {
        const hecha = i < actual || etapa === "COMPLETADO";
        const esActual = i === actual && etapa !== "COMPLETADO";
        return (
          <li key={e} className="grid gap-1.5" aria-current={esActual ? "step" : undefined}>
            <span
              className={cn(
                "flex h-2 rounded-full",
                hecha ? "bg-success" : esActual ? "bg-primary" : "bg-muted",
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] font-semibold leading-tight sm:text-xs",
                esActual ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {hecha ? <Check className="hidden size-3 text-success sm:inline" aria-hidden="true" /> : null}
              {ETIQUETA_ETAPA[e]}
              <span className="sr-only">
                {hecha ? " (hecho)" : esActual ? " (etapa actual)" : " (pendiente)"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
