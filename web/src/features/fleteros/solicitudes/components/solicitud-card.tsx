import { AlertTriangle, ArrowRight, CalendarDays, MapPin, Package, Route, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_TIPO_FLETE, FRANJA } from "@/domain/catalogos";
import { fechaIsoAr, sumarDias } from "@/domain/fechas";
import { formatearDia, formatearKg, formatearKm, formatearM3, formatearPesos } from "@/lib/formato";
import type { TarjetaSolicitud } from "../queries";

export function SolicitudCard({ solicitud: s }: { solicitud: TarjetaSolicitud }) {
  const hoy = fechaIsoAr();
  const urgente = s.fecha === hoy || s.fecha === sumarDias(hoy, 1);

  return (
    <article className="relative grid gap-3 rounded-lg border bg-card p-4 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{ETIQUETA_TIPO_FLETE[s.tipoFlete]}</Badge>
        {s.itemsSinMedidas > 0 ? (
          <Badge variant="warning">
            <AlertTriangle aria-hidden="true" />
            Medidas incompletas
          </Badge>
        ) : null}
        {s.miMonto !== null ? (
          <Badge variant="success">Tu presupuesto: {formatearPesos(s.miMonto)}</Badge>
        ) : null}
      </div>

      <h2 className="text-lg font-bold leading-snug">
        <Link
          href={`/fletero/solicitudes/${s.id}`}
          className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
        >
          {s.titulo}
        </Link>
      </h2>

      <p className="flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          {s.zonaOrigen}
          <ArrowRight className="mx-1 inline size-3.5 text-muted-foreground" aria-label="hasta" />
          {s.zonaDestino}
        </span>
      </p>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <dt>
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Fecha</span>
          </dt>
          <dd className={urgente ? "font-semibold text-primary" : undefined}>
            {formatearDia(s.fecha, { hoy })} · {FRANJA[s.franja].etiqueta}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>
            <Route className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Distancia</span>
          </dt>
          <dd>
            <strong>a {formatearKm(s.distanciaBaseKm)}</strong> de tu base · recorrido ~
            {formatearKm(s.recorridoKm)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt>
            <Package className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Carga</span>
          </dt>
          <dd>
            {s.cantidadItems} {s.cantidadItems === 1 ? "ítem" : "ítems"} · {formatearKg(s.pesoTotalKg)} ·{" "}
            {formatearM3(s.volumenTotalM3)}
            {s.itemsFragiles > 0 ? ` · ${s.itemsFragiles} frágil${s.itemsFragiles > 1 ? "es" : ""}` : ""}
          </dd>
        </div>
        {s.ayudantesRequeridos > 0 ? (
          <div className="flex items-center gap-2">
            <dt>
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Ayudantes</span>
            </dt>
            <dd>
              Pide {s.ayudantesRequeridos} ayudante{s.ayudantesRequeridos > 1 ? "s" : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
        <span>
          {s.vehiculoSugerido ? `Entra en tu ${s.vehiculoSugerido}` : "Revisá si entra en tus vehículos"}
        </span>
        <span>
          {s.presupuestosRecibidos === 0
            ? "Sin presupuestos todavía"
            : `${s.presupuestosRecibidos} presupuesto${s.presupuestosRecibidos > 1 ? "s" : ""} recibido${s.presupuestosRecibidos > 1 ? "s" : ""}`}
        </span>
      </p>
    </article>
  );
}
