import type { Metadata } from "next";
import Link from "next/link";
import { GaleriaFotos } from "@/components/shared/galeria-fotos";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_RESULTADO } from "@/domain/catalogos";
import { FormResolverReclamo } from "@/features/admin/components/acciones-admin";
import { getReclamos } from "@/features/admin/queries";
import { formatearFechaHora } from "@/lib/formato";
import { requireRol } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reclamos" };

const FASE = { CARGA: "Al cargar", DESCARGA: "Al descargar", RECEPCION: "Al recibir" } as const;

const PESTANAS = [
  { valor: "ABIERTO", etiqueta: "Abiertos", href: "/admin/reclamos" },
  { valor: "RESUELTO", etiqueta: "Resueltos", href: "/admin/reclamos?estado=resueltos" },
] as const;

type Props = { searchParams: Promise<{ estado?: string }> };

export default async function ReclamosPage({ searchParams }: Props) {
  await requireRol("ADMIN");
  const estado = (await searchParams).estado === "resueltos" ? "RESUELTO" : "ABIERTO";
  const reclamos = await getReclamos(estado);
  return (
    <div className="grid gap-6">
      <PageHeader title="Reclamos" description="Ítems que el cliente reclamó al recibir el flete." />
      <nav aria-label="Estado de los reclamos" className="flex gap-2">
        {PESTANAS.map((p) => (
          <Button
            key={p.valor}
            asChild
            size="sm"
            variant="outline"
            className={cn(estado === p.valor && "border-primary bg-primary/5")}
          >
            <Link href={p.href} aria-current={estado === p.valor ? "page" : undefined}>
              {p.etiqueta}
            </Link>
          </Button>
        ))}
      </nav>

      {reclamos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {estado === "ABIERTO" ? "No hay reclamos abiertos." : "Todavía no se resolvió ningún reclamo."}
        </p>
      ) : (
        <ul className="grid gap-4">
          {reclamos.map((r) => (
            <li key={r.id} className="grid gap-3 rounded-lg border bg-card p-4">
              <div className="grid gap-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{r.item}</span>
                  <span className="text-muted-foreground">en «{r.titulo}»</span>
                  <time dateTime={r.fecha.toISOString()} className="text-sm text-muted-foreground">
                    {formatearFechaHora(r.fecha)}
                  </time>
                </p>
                <p className="text-sm text-muted-foreground">
                  Cliente: {r.cliente.nombre} ({r.cliente.email}) · Fletero: {r.fletero.nombre} (
                  {r.fletero.email})
                </p>
              </div>
              <p className="rounded-md bg-destructive/10 p-3 text-sm">«{r.descripcion}»</p>
              {r.fotos.length > 0 ? (
                <GaleriaFotos fotos={r.fotos} descripcion={`Reclamo por ${r.item}`} />
              ) : null}
              {r.controles.length > 0 ? (
                <ul className="grid gap-1 text-sm" aria-label="Lo registrado sobre este ítem">
                  {r.controles.map((c) => (
                    <li key={c.fase} className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-muted-foreground">{FASE[c.fase]}:</span>
                      <Badge variant="outline">{ETIQUETA_RESULTADO[c.resultado]}</Badge>
                      {c.observacion ? <span>«{c.observacion}»</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {r.estado === "ABIERTO" ? (
                <FormResolverReclamo reclamoId={r.id} />
              ) : (
                <div className="grid gap-1 rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">
                    Resuelto{r.resueltoPor ? ` por ${r.resueltoPor}` : ""}
                    {r.resueltoEn ? ` el ${formatearFechaHora(r.resueltoEn)}` : ""}
                  </p>
                  <p>{r.resolucion}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
