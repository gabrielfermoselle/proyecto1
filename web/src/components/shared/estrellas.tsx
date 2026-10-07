import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Puntaje de 0 a 5 (admite medios para promedios). El texto accesible lleva el número. */
export function Estrellas({ puntaje, className }: { puntaje: number; className?: string }) {
  const redondeado = Math.round(puntaje * 2) / 2;
  return (
    <span
      role="img"
      aria-label={`${puntaje.toLocaleString("es-AR", { maximumFractionDigits: 1 })} de 5 estrellas`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const llena = i + 1 <= redondeado;
        const media = !llena && i + 0.5 === redondeado;
        return (
          <span key={i} className="relative inline-block size-[1em]" aria-hidden="true">
            <Star className="absolute inset-0 size-full text-muted-foreground/40" />
            {llena || media ? (
              <span className={cn("absolute inset-0 overflow-hidden", media && "w-1/2")}>
                <Star className="size-[1em] fill-accent text-accent" />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
