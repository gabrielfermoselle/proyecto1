import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedNav } from "@/components/shared/segmented-nav";
import { Cuentas, VerificacionFleteros } from "@/features/admin/components/secciones";
import { getResumenAdmin } from "@/features/admin/queries";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Fleteros" };

type Props = { searchParams: Promise<{ tab?: string; q?: string; rol?: string; pagina?: string }> };

/** Verificar la documentación de los fleteros, y las cuentas de la plataforma. */
export default async function AdminFleterosPage({ searchParams }: Props) {
  const yo = await requireRol("ADMIN");
  const q = await searchParams;
  const tab = q.tab === "verificados" || q.tab === "cuentas" ? q.tab : "pendientes";
  const resumen = await getResumenAdmin();

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fleteros"
        description="Revisá DNI, licencia y seguro antes de darles la insignia «Verificado»."
      />
      <SegmentedNav
        label="Fleteros"
        segmentos={[
          {
            href: "/admin/fleteros",
            label: "Por verificar",
            activo: tab === "pendientes",
            contador: resumen.sinVerificar,
          },
          { href: "/admin/fleteros?tab=verificados", label: "Verificados", activo: tab === "verificados" },
          { href: "/admin/fleteros?tab=cuentas", label: "Todas las cuentas", activo: tab === "cuentas" },
        ]}
      />
      {tab === "cuentas" ? (
        <Cuentas q={q.q} rolParam={q.rol} paginaParam={q.pagina} yoId={yo.id} />
      ) : (
        <VerificacionFleteros verificados={tab === "verificados"} />
      )}
    </div>
  );
}
