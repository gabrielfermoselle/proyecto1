import { cn } from "@/lib/utils";
import type { PasoTimeline } from "./tipos";

/**
 * Progreso compacto por etapas: una barra segmentada con "Paso N de M". Los nombres de cada
 * segmento aparecen desde tablet; en el celular alcanza con el paso actual.
 */
export function ProgresoEtapas({
  pasos,
  etiqueta = "Progreso",
  className,
}: {
  pasos: Pick<PasoTimeline, "clave" | "titulo" | "estado">[];
  etiqueta?: string;
  className?: string;
}) {
  const indiceActual = pasos.findIndex((p) => p.estado === "actual" || p.estado === "cancelado");
  const actual = indiceActual >= 0 ? pasos[indiceActual] : pasos.at(-1);
  const numero = indiceActual >= 0 ? indiceActual + 1 : pasos.length;
  return (
    <div className={cn("grid gap-2", className)}>
      <p className="text-sm font-semibold" aria-live="polite">
        <span className="text-muted-foreground">
          Paso {numero} de {pasos.length}:{" "}
        </span>
        {actual?.titulo}
      </p>
      <ol
        aria-label={etiqueta}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))` }}
      >
        {pasos.map((p) => (
          <li
            key={p.clave}
            aria-current={p.estado === "actual" ? "step" : undefined}
            className="grid gap-1.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-2 rounded-full",
                p.estado === "hecho" && "bg-success",
                p.estado === "actual" && "bg-primary",
                p.estado === "pendiente" && "bg-muted",
                p.estado === "cancelado" && "bg-destructive",
              )}
            />
            <span
              className={cn(
                "hidden text-[11px] font-semibold leading-tight md:block",
                p.estado === "actual" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {p.titulo}
            </span>
            <span className="sr-only md:hidden">
              {p.titulo} ({p.estado})
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
