import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ETAPA } from "@/domain/catalogos";
import { getSolicitudesAdmin } from "@/features/admin/queries";
import { formatearDia, formatearFecha } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Solicitudes" };

const ESTADO = {
  ABIERTA: "Abierta",
  ADJUDICADA: "Con flete",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
} as const;

export default async function SolicitudesAdminPage() {
  await requireRol("ADMIN");
  const solicitudes = await getSolicitudesAdmin();
  return (
    <div className="grid gap-6">
      <PageHeader title="Solicitudes" description="Las últimas publicadas en la plataforma." />
      {/* En el teléfono la tabla se desplaza de costado: enfocable para hacerlo con el teclado. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de solicitudes"
        className="overflow-x-auto rounded-lg border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th scope="col" className="p-3">
                Solicitud
              </th>
              <th scope="col" className="p-3">
                Cliente
              </th>
              <th scope="col" className="p-3">
                Para el
              </th>
              <th scope="col" className="p-3">
                Presupuestos
              </th>
              <th scope="col" className="p-3">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">
                  <span className="font-semibold">{s.titulo}</span>
                  <span className="block text-muted-foreground">publicada {formatearFecha(s.publicada)}</span>
                </td>
                <td className="p-3">{s.cliente}</td>
                <td className="p-3">{formatearDia(s.fecha)}</td>
                <td className="p-3 tabular-nums">{s.presupuestos}</td>
                <td className="p-3">
                  <Badge
                    variant={
                      s.estado === "ABIERTA" ? "default" : s.estado === "ADJUDICADA" ? "success" : "muted"
                    }
                  >
                    {s.flete ? ETIQUETA_ETAPA[s.flete.etapa] : ESTADO[s.estado]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
