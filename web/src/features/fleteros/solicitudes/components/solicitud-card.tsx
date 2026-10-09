import { AlertTriangle, ArrowRight, Package, Users } from "lucide-react";
import Link from "next/link";
import { TipoFleteIcono } from "@/components/shared/tipo-flete-icono";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_TIPO_FLETE, FRANJA } from "@/domain/catalogos";
import { fechaIsoAr, sumarDias } from "@/domain/fechas";
import { hrefPedido } from "@/features/fletes/rutas";
import { formatearDia, formatearKg, formatearKm, formatearM3, formatearPesos } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { TarjetaSolicitud } from "../queries";

/**
 * Un pedido disponible, en una fila: qué es, de dónde a dónde, cuándo, a cuánto de tu base y
 * [Ver]. En el celular se apila.
 */
export function SolicitudCard({ solicitud: s }: { solicitud: TarjetaSolicitud }) {
  const hoy = fechaIsoAr();
  const urgente = s.fecha === hoy || s.fecha === sumarDias(hoy, 1);
  const href = hrefPedido("FLETERO", s.id);

  return (
    <article className="group relative grid gap-3 rounded-xl border bg-card p-4 shadow-sm transition-[border-color,box-shadow] focus-within:ring-2 focus-within:ring-ring hover:border-primary/40 hover:shadow-md lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_9rem_6rem_auto] lg:items-center lg:gap-5 lg:py-3">
      <div className="flex min-w-0 items-center gap-3">
        <TipoFleteIcono tipo={s.tipoFlete} />
        <div className="grid min-w-0 gap-0.5">
          <h2 className="truncate font-bold leading-snug">
            <Link
              href={href}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
            >
              {s.titulo}
            </Link>
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {ETIQUETA_TIPO_FLETE[s.tipoFlete]}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Package className="size-3.5" aria-hidden="true" />
              {s.cantidadItems} {s.cantidadItems === 1 ? "ítem" : "ítems"} · {formatearKg(s.pesoTotalKg)} ·{" "}
              {formatearM3(s.volumenTotalM3)}
            </span>
          </p>
        </div>
      </div>

      <p className="grid min-w-0 gap-0.5 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="truncate">{s.zonaOrigen}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span className="sr-only">hasta </span>
          <span className="truncate">{s.zonaDestino}</span>
        </span>
      </p>

      <div className="flex gap-8 lg:contents">
        <p className={cn("text-sm", urgente && "font-semibold text-primary")}>
          <span className="block">{formatearDia(s.fecha, { hoy })}</span>
          <span className="text-muted-foreground">{FRANJA[s.franja].etiqueta}</span>
        </p>

        <p className="text-sm">
          <span className="font-heading text-lg font-extrabold tabular-nums">
            {formatearKm(s.distanciaBaseKm)}
          </span>
          <span className="block text-muted-foreground">de tu base</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
        <div className="flex flex-wrap gap-1.5 lg:hidden xl:flex">
          {s.itemsSinMedidas > 0 ? (
            <Badge variant="warning">
              <AlertTriangle aria-hidden="true" />
              Sin medidas
            </Badge>
          ) : null}
          {s.ayudantesRequeridos > 0 ? (
            <Badge variant="muted">
              <Users aria-hidden="true" />
              {s.ayudantesRequeridos}
            </Badge>
          ) : null}
          {s.requiereEmbalaje ? <Badge variant="muted">Embalaje</Badge> : null}
          {s.miMonto !== null ? (
            <Badge variant="success">Tu presupuesto: {formatearPesos(s.miMonto)}</Badge>
          ) : null}
          {s.presupuestosRecibidos > 0 ? (
            <Badge variant="outline">
              {s.presupuestosRecibidos} {s.presupuestosRecibidos === 1 ? "presupuesto" : "presupuestos"}
            </Badge>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors group-hover:bg-primary/90"
        >
          Ver
          <ArrowRight className="size-4" />
        </span>
      </div>
    </article>
  );
}
