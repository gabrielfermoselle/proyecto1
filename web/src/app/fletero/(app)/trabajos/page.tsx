import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedNav } from "@/components/shared/segmented-nav";
import { Button } from "@/components/ui/button";
import { getAgenda } from "@/features/fleteros/fletes/queries";
import { getMisPresupuestos } from "@/features/fleteros/presupuestos/queries";
import { Agenda, Ganancias, Presupuestos } from "@/features/fleteros/trabajos/secciones";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Mis trabajos" };

const TABS = ["agenda", "presupuestos", "ganancias"] as const;
type Tab = (typeof TABS)[number];

type Props = { searchParams: Promise<{ tab?: string; estado?: string; semana?: string }> };

/** Mis presupuestos y trabajos: la agenda de lo aceptado, lo presupuestado y los números. */
export default async function TrabajosPage({ searchParams }: Props) {
  const { fleteroId } = await requireFletero();
  const q = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(q.tab ?? "") ? (q.tab as Tab) : "agenda";
  // Los contadores de las pestañas (las consultas son chicas: fletes activos y presupuestos pendientes).
  const [{ turnos }, { conteos }] = await Promise.all([
    getAgenda(fleteroId),
    getMisPresupuestos(fleteroId, "pendientes"),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Mis trabajos"
        description="Tus fletes aceptados, los presupuestos que enviaste y cuánto llevás ganado."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/fleteros/${fleteroId}`}>
              Mi perfil público
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <SegmentedNav
        label="Secciones de mis trabajos"
        segmentos={[
          { href: "/fletero/trabajos", label: "Agenda", activo: tab === "agenda", contador: turnos.length },
          {
            href: "/fletero/trabajos?tab=presupuestos",
            label: "Presupuestos",
            activo: tab === "presupuestos",
            contador: conteos.pendientes,
          },
          { href: "/fletero/trabajos?tab=ganancias", label: "Ganancias", activo: tab === "ganancias" },
        ]}
      />
      {tab === "agenda" ? <Agenda fleteroId={fleteroId} semana={q.semana} /> : null}
      {tab === "presupuestos" ? <Presupuestos fleteroId={fleteroId} estado={q.estado} /> : null}
      {tab === "ganancias" ? <Ganancias fleteroId={fleteroId} /> : null}
    </div>
  );
}
