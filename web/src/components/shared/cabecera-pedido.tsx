import { ArrowLeft, CalendarDays, Route } from "lucide-react";
import Link from "next/link";
import { ETIQUETA_TIPO_FLETE, FRANJA, type FranjaHoraria, type TipoFlete } from "@/domain/catalogos";
import { formatearDia, formatearKm } from "@/lib/formato";
import { EstadoPedidoBar } from "./estado-pedido";
import { TipoFleteIcono } from "./tipo-flete-icono";

/**
 * Encabezado de la página de un pedido (cliente y fletero): volver, tipo, título, cuándo y la
 * barra de estado, que queda siempre arriba.
 */
export function CabeceraPedido({
  volver,
  tipo,
  titulo,
  fecha,
  franja,
  distanciaKm,
  estado,
  extra,
  aside,
  detalle,
}: {
  volver: { href: string; label: string };
  tipo: TipoFlete;
  titulo: string;
  fecha: string;
  franja: FranjaHoraria;
  distanciaKm?: number;
  estado: Parameters<typeof EstadoPedidoBar>[0]["estado"];
  /** Línea extra bajo el título (p. ej. quién lo publicó). */
  extra?: React.ReactNode;
  /** A la derecha del título (p. ej. el precio acordado). */
  aside?: React.ReactNode;
  /** Bajo la barra: la etapa detallada del flete ("Etapa 3 de 7: Cargando"). */
  detalle?: string | null;
}) {
  return (
    <header className="grid gap-5">
      <Link
        href={volver.href}
        className="inline-flex items-center gap-1.5 justify-self-start rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {volver.label}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <TipoFleteIcono tipo={tipo} className="size-14 [&_svg]:size-7" />
          <div className="grid min-w-0 gap-1">
            <p className="text-sm font-semibold text-muted-foreground">{ETIQUETA_TIPO_FLETE[tipo]}</p>
            <h1 className="text-3xl font-extrabold leading-[1.1] sm:text-4xl">{titulo}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                {formatearDia(fecha, { largo: true })} · {FRANJA[franja].etiqueta}
              </span>
              {distanciaKm !== undefined ? (
                <span className="inline-flex items-center gap-1.5">
                  <Route className="size-4 text-primary" aria-hidden="true" />
                  {formatearKm(distanciaKm)}
                </span>
              ) : null}
            </p>
            {extra ? <div className="text-sm text-muted-foreground">{extra}</div> : null}
          </div>
        </div>
        {aside ? <div className="shrink-0 sm:text-right">{aside}</div> : null}
      </div>
      <div className="rounded-xl border bg-card px-3 py-4 shadow-sm sm:px-6">
        <EstadoPedidoBar estado={estado} />
        {detalle ? (
          <p className="mt-4 border-t pt-3 text-center text-sm font-semibold" aria-live="polite">
            {detalle}
          </p>
        ) : null}
      </div>
    </header>
  );
}

/** Bloque titulado de la página del pedido. */
export function BloquePedido({
  titulo,
  descripcion,
  acciones,
  children,
  id,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-label={titulo}
      className="grid scroll-mt-24 gap-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <h2 className="text-xl font-bold">{titulo}</h2>
          {descripcion ? <p className="text-sm text-muted-foreground">{descripcion}</p> : null}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  );
}
