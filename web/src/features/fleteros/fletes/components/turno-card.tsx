import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ETAPA, FRANJA } from "@/domain/catalogos";
import { VehiculoIcono } from "@/features/fleteros/components/vehiculo-icono";
import { hrefPedido } from "@/features/fletes/rutas";
import { formatearPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { TurnoAgenda } from "../queries";

export function TurnoCard({
  turno,
  enConflicto,
  compacto = false,
}: {
  turno: TurnoAgenda;
  enConflicto: boolean;
  compacto?: boolean;
}) {
  return (
    <article
      className={cn(
        "relative grid gap-1 rounded-lg border-2 bg-card p-3 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md",
        enConflicto ? "border-destructive" : "border-transparent",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={turno.etapa === "CONFIRMADO" ? "outline" : "default"}>
          {ETIQUETA_ETAPA[turno.etapa]}
        </Badge>
        {enConflicto ? (
          <Badge variant="destructive">
            <AlertTriangle aria-hidden="true" />
            Superpuesto
          </Badge>
        ) : null}
      </div>
      <h3 className={cn("font-bold leading-snug", compacto && "text-sm")}>
        <Link
          href={hrefPedido("FLETERO", turno.solicitudId)}
          className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
        >
          {turno.titulo}
        </Link>
      </h3>
      {!compacto ? (
        <>
          <p className="text-sm text-muted-foreground">{FRANJA[turno.franja].etiqueta}</p>
          <p className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5">
              <VehiculoIcono tipo={turno.tipoVehiculo} className="size-4 text-muted-foreground" />
              {turno.vehiculo}
            </span>
            <strong className="tabular-nums">{formatearPesos(turno.precioAcordado)}</strong>
          </p>
        </>
      ) : null}
    </article>
  );
}
