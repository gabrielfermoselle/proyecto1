import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedNav } from "@/components/shared/segmented-nav";
import { StatTile } from "@/components/shared/stat-tile";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ETAPA } from "@/domain/catalogos";
import { Denuncias, Pedidos } from "@/features/admin/components/secciones";
import { getFletesDemorados, getResumenAdmin } from "@/features/admin/queries";
import { formatearDia } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Reportes" };

type Props = { searchParams: Promise<{ tab?: string; estado?: string }> };

/** Denuncias (reclamos de ítems) y pedidos de la plataforma, con los números generales arriba. */
export default async function AdminReportesPage({ searchParams }: Props) {
  // Cada página verifica la sesión, además del layout (y así nunca se intenta prerenderizar).
  await requireRol("ADMIN");
  const q = await searchParams;
  const tab = q.tab === "pedidos" ? "pedidos" : "denuncias";
  const resueltas = q.estado === "resueltas";
  const [r, demorados] = await Promise.all([getResumenAdmin(), getFletesDemorados()]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Reportes"
        description="Denuncias por ítems dañados o faltantes, y los pedidos de la plataforma."
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Denuncias abiertas"
          value={r.reclamosAbiertos}
          className={r.reclamosAbiertos ? "border-destructive/50" : ""}
        />
        <StatTile label="Pedidos abiertos" value={r.solicitudesAbiertas} />
        <StatTile
          label="Fletes en curso"
          value={r.fletesActivos}
          detail={r.demorados ? `${r.demorados} demorados` : null}
        />
        <StatTile
          label="Cuentas"
          value={r.clientes + r.fleteros}
          detail={`${r.clientes} clientes · ${r.fleteros} fleteros${r.inactivos ? ` · ${r.inactivos} desactivadas` : ""}`}
        />
      </dl>

      <SegmentedNav
        label="Reportes"
        segmentos={[
          {
            href: "/admin/reportes",
            label: "Denuncias",
            activo: tab === "denuncias",
            contador: r.reclamosAbiertos,
          },
          { href: "/admin/reportes?tab=pedidos", label: "Pedidos", activo: tab === "pedidos" },
        ]}
      />

      {tab === "denuncias" ? (
        <div className="grid gap-4">
          <SegmentedNav
            label="Estado de las denuncias"
            segmentos={[
              { href: "/admin/reportes", label: "Abiertas", activo: !resueltas },
              { href: "/admin/reportes?estado=resueltas", label: "Resueltas", activo: resueltas },
            ]}
          />
          <Denuncias resueltas={resueltas} />
        </div>
      ) : (
        <div className="grid gap-6">
          {demorados.length > 0 ? (
            <section
              aria-labelledby="titulo-demorados"
              className="grid gap-3 rounded-xl border border-warning/40 bg-card p-5 shadow-sm"
            >
              <div className="grid gap-1">
                <h2 id="titulo-demorados" className="text-lg font-bold">
                  Fletes demorados
                </h2>
                <p className="text-sm text-muted-foreground">
                  Su día ya pasó y no empezaron. Las dos partes reciben un aviso automático una vez.
                </p>
              </div>
              <ul className="divide-y">
                {demorados.map((f) => (
                  <li key={f.id} className="grid gap-1 py-2 text-sm first:pt-0 last:pb-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{f.titulo}</span>
                      <Badge variant="warning">{ETIQUETA_ETAPA[f.etapa]}</Badge>
                      <span className="text-muted-foreground">era para el {formatearDia(f.fecha)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Cliente: {f.cliente.nombre} ({f.cliente.email}) · Fletero: {f.fletero.nombre} (
                      {f.fletero.email})
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Pedidos />
        </div>
      )}
    </div>
  );
}
