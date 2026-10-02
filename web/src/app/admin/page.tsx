import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ETIQUETA_ETAPA } from "@/domain/catalogos";
import { getFletesDemorados, getResumenAdmin } from "@/features/admin/queries";
import { formatearDia } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminInicioPage() {
  // Cada página verifica la sesión, además del layout (y así nunca se intenta prerenderizar).
  await requireRol("ADMIN");
  const [r, demorados] = await Promise.all([getResumenAdmin(), getFletesDemorados()]);
  return (
    <div className="grid gap-6">
      <PageHeader title="Administración" description="Cuentas, reclamos y fletes que necesitan atención." />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clientes" value={r.clientes} />
        <StatTile
          label="Fleteros"
          value={r.fleteros}
          detail={r.sinVerificar ? `${r.sinVerificar} sin verificar` : null}
        />
        <StatTile label="Solicitudes abiertas" value={r.solicitudesAbiertas} />
        <StatTile label="Fletes en curso" value={r.fletesActivos} />
        <StatTile
          label="Reclamos abiertos"
          value={
            <Link href="/admin/reclamos" className="underline-offset-2 hover:underline">
              {r.reclamosAbiertos}
            </Link>
          }
          className={r.reclamosAbiertos ? "border-destructive/50" : ""}
        />
        <StatTile
          label="Fletes demorados"
          value={r.demorados}
          className={r.demorados ? "border-warning/60" : ""}
        />
        <StatTile label="Cuentas desactivadas" value={r.inactivos} />
      </dl>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-lg font-bold">Fletes demorados</h2>
          <p className="text-sm text-muted-foreground">
            Su día ya pasó y no empezaron. Las dos partes reciben un aviso automático una vez.
          </p>
        </CardHeader>
        <CardContent>
          {demorados.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay fletes demorados.</p>
          ) : (
            <ul className="grid gap-2">
              {demorados.map((f) => (
                <li key={f.id} className="grid gap-1 border-b pb-2 text-sm last:border-0">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
