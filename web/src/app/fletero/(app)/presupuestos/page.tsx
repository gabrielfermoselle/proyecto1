import { ArrowRight, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedNav } from "@/components/shared/segmented-nav";
import { Button } from "@/components/ui/button";
import { FRANJA } from "@/domain/catalogos";
import { EstadoPresupuestoBadge } from "@/features/fleteros/presupuestos/components/estado-presupuesto";
import {
  getMisPresupuestos,
  TABS_PRESUPUESTOS,
  type TabPresupuestos,
} from "@/features/fleteros/presupuestos/queries";
import { formatearDia, formatearFechaHora, formatearPesos } from "@/lib/formato";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Mis presupuestos" };

const ETIQUETA_TAB: Record<TabPresupuestos, string> = {
  pendientes: "Pendientes",
  aceptados: "Aceptados",
  historial: "Historial",
};

const VACIO: Record<TabPresupuestos, string> = {
  pendientes: "No tenés presupuestos esperando respuesta.",
  aceptados: "Todavía no te aceptaron ningún presupuesto.",
  historial: "Acá van a aparecer los presupuestos no elegidos, retirados o vencidos.",
};

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { fleteroId } = await requireFletero();
  const { tab: tabParam } = await searchParams;
  const tab: TabPresupuestos = (TABS_PRESUPUESTOS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabPresupuestos)
    : "pendientes";
  const { presupuestos, conteos } = await getMisPresupuestos(fleteroId, tab);

  return (
    <div className="grid gap-5">
      <PageHeader title="Mis presupuestos" description="Seguí qué pasó con cada presupuesto que enviaste." />
      <SegmentedNav
        label="Estado de los presupuestos"
        segmentos={TABS_PRESUPUESTOS.map((t) => ({
          href: t === "pendientes" ? "/fletero/presupuestos" : `/fletero/presupuestos?tab=${t}`,
          label: ETIQUETA_TAB[t],
          activo: t === tab,
          contador: conteos[t],
        }))}
      />

      {presupuestos.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={VACIO[tab]}
          action={
            <Button asChild variant="outline">
              <Link href="/fletero/solicitudes">Ver solicitudes cerca tuyo</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {presupuestos.map((p) => {
            const href = p.fleteId ? `/fletero/fletes/${p.fleteId}` : `/fletero/solicitudes/${p.solicitudId}`;
            return (
              <li key={p.id}>
                <article className="relative grid gap-2 rounded-lg border bg-card p-4 shadow-sm focus-within:ring-2 focus-within:ring-ring sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="grid gap-1">
                    <h2 className="font-bold">
                      <Link
                        href={href}
                        className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
                      >
                        {p.titulo}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {formatearDia(p.fecha)} · {FRANJA[p.franja].etiqueta} · {p.zonaOrigen} → {p.zonaDestino}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Enviado el {formatearFechaHora(p.enviadoEn)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="font-heading text-xl font-extrabold tabular-nums">
                      {formatearPesos(p.monto)}
                    </span>
                    <EstadoPresupuestoBadge estado={p.estado} validoHasta={p.validoHasta} />
                  </div>
                  {p.fleteId ? (
                    <p className="flex items-center gap-1 text-sm font-semibold text-primary sm:col-span-2">
                      Gestionar el flete <ArrowRight className="size-4" aria-hidden="true" />
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
