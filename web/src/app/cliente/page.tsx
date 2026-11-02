import { ArrowRight, ChevronRight, ClipboardList, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { EstadoPedidoMini } from "@/components/shared/estado-pedido";
import { PageHeader } from "@/components/shared/page-header";
import { TipoFleteIcono } from "@/components/shared/tipo-flete-icono";
import { Button } from "@/components/ui/button";
import { ETIQUETA_TIPO_FLETE, FRANJA } from "@/domain/catalogos";
import { estadoPedido, pedidoEnCurso } from "@/domain/pedido";
import { getSolicitudesDelCliente, type SolicitudDeLista } from "@/features/clientes/solicitudes/queries";
import { hrefPedido } from "@/features/fletes/rutas";
import { formatearDia, formatearKm, formatearPesos } from "@/lib/formato";
import { requireCliente } from "@/lib/session";

export const metadata: Metadata = { title: "Mis pedidos" };

/** Lo que el cliente tiene que hacer con el pedido, si hay algo. */
function pendienteDe(p: SolicitudDeLista): string | null {
  if (p.estado === "ABIERTA" && p.presupuestosPendientes > 0) {
    const n = p.presupuestosPendientes;
    return `${n} ${n === 1 ? "presupuesto" : "presupuestos"} para comparar · desde ${formatearPesos(p.presupuestoMinimo!)}`;
  }
  if (p.flete?.etapa === "ENTREGADO") return "Revisá lo que llegó y confirmá la recepción";
  if (p.flete?.etapa === "CERRADO" && !p.flete.calificado) return "Calificá al fletero";
  return null;
}

function TarjetaPedido({ p }: { p: SolicitudDeLista }) {
  const pendiente = pendienteDe(p);
  const estado = { solicitudEstado: p.estado, fleteEtapa: p.flete?.etapa ?? null };
  return (
    <li>
      <Link
        href={hrefPedido("CLIENTE", p.id)}
        // Son pocos: se precargan enteros y abrir uno es instantáneo.
        prefetch
        className="group grid gap-4 rounded-xl border bg-card p-4 shadow-sm transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 md:grid-cols-[minmax(0,1fr)_11rem_auto] md:items-center md:gap-6"
      >
        <div className="flex min-w-0 gap-4">
          <TipoFleteIcono tipo={p.tipoFlete} />
          <div className="grid min-w-0 gap-1">
            <p className="text-sm text-muted-foreground">
              {ETIQUETA_TIPO_FLETE[p.tipoFlete]} · {formatearDia(p.fecha)} · {FRANJA[p.franja].etiqueta}
            </p>
            <h3 className="truncate text-lg font-bold leading-snug">{p.titulo}</h3>
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="truncate">{p.origen}</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="hasta" />
              <span className="truncate">{p.destino}</span>
              <span className="shrink-0 text-muted-foreground">· {formatearKm(p.distanciaKm)}</span>
            </p>
            {pendiente ? (
              <p className="mt-1 justify-self-start rounded-md bg-accent/20 px-2.5 py-1 text-sm font-semibold text-foreground">
                {pendiente}
              </p>
            ) : null}
          </div>
        </div>
        <EstadoPedidoMini estado={estado} />
        <div className="flex items-center justify-between gap-3 border-t pt-3 md:border-0 md:pt-0">
          <span className="text-sm text-muted-foreground md:text-right">
            {p.flete ? (
              <>
                <span className="block font-heading text-lg font-extrabold tabular-nums text-foreground">
                  {formatearPesos(p.flete.precioAcordado)}
                </span>
                acordado
              </>
            ) : (
              `${p.items} ${p.items === 1 ? "ítem" : "ítems"}`
            )}
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </Link>
    </li>
  );
}

function Seccion({ id, titulo, pedidos }: { id: string; titulo: string; pedidos: SolicitudDeLista[] }) {
  if (pedidos.length === 0) return null;
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="text-lg font-bold">
        {titulo} <span className="font-normal text-muted-foreground">({pedidos.length})</span>
      </h2>
      <ul className="grid gap-3">
        {pedidos.map((p) => (
          <TarjetaPedido key={p.id} p={p} />
        ))}
      </ul>
    </section>
  );
}

export default async function MisPedidosPage() {
  const { usuario, clienteId } = await requireCliente();
  const pedidos = await getSolicitudesDelCliente(clienteId);
  const activo = (p: SolicitudDeLista) =>
    pedidoEnCurso(estadoPedido({ solicitudEstado: p.estado, fleteEtapa: p.flete?.etapa ?? null })) ||
    pendienteDe(p) !== null;
  const enCurso = pedidos.filter(activo);
  const anteriores = pedidos.filter((p) => !activo(p));

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Mis pedidos"
        description={`Hola, ${usuario.nombre}. Acá ves los presupuestos que te llegan y en qué está cada flete.`}
      />

      {pedidos.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="Todavía no pediste ningún flete"
          description="Contá qué necesitás mover y los fleteros de la zona te mandan presupuestos para que elijas."
          action={
            <Button asChild size="lg">
              <Link href="/cliente/nuevo">
                <Plus aria-hidden="true" />
                Pedir un flete
              </Link>
            </Button>
          }
        />
      ) : null}

      <Seccion id="titulo-en-curso" titulo="En curso" pedidos={enCurso} />
      <Seccion id="titulo-anteriores" titulo="Anteriores" pedidos={anteriores} />

      <Link
        href="/cliente/fleteros"
        className="group flex items-center gap-4 rounded-xl border border-dashed p-4 text-sm transition-colors hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">
          <strong>¿Ya conocés a un fletero?</strong> Buscalo por zona, vehículo y calificación.
        </span>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
