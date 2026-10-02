import { ChevronRight, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_ETAPA, FRANJA } from "@/domain/catalogos";
import { esEtapaActiva } from "@/domain/ciclo-flete";
import { hrefFlete } from "@/features/fletes/rutas";
import { getFletesDelCliente } from "@/features/fletes/queries";
import { formatearDia, formatearPesos } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Mis fletes" };

type FleteLista = Awaited<ReturnType<typeof getFletesDelCliente>>[number];

function FilaFlete({ f }: { f: FleteLista }) {
  const pendienteDeCalificar = f.etapa === "CERRADO" && !f.calificado;
  return (
    <li>
      <Link
        href={hrefFlete("CLIENTE", f.id)}
        className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{f.titulo}</span>
            <Badge
              variant={
                f.etapa === "CANCELADO" ? "destructive" : f.etapa === "CERRADO" ? "success" : "default"
              }
            >
              {ETIQUETA_ETAPA[f.etapa]}
            </Badge>
            {f.etapa === "ENTREGADO" ? <Badge variant="warning">Revisá la recepción</Badge> : null}
            {pendienteDeCalificar ? <Badge variant="warning">Calificá al fletero</Badge> : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatearDia(f.fecha)} · {FRANJA[f.franja].etiqueta} · {f.fletero} ·{" "}
            {formatearPesos(f.precioAcordado)}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {f.origen} → {f.destino}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function ClienteInicioPage() {
  const usuario = await requireRol("CLIENTE");
  const fletes = usuario.clienteProfile ? await getFletesDelCliente(usuario.clienteProfile.id) : [];
  const enCurso = fletes.filter((f) => esEtapaActiva(f.etapa));
  const anteriores = fletes.filter((f) => !esEtapaActiva(f.etapa));

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hola, ${usuario.nombre}`}
        description="Acá seguís tus fletes: en qué etapa están, el inventario y la recepción."
      />
      {fletes.length === 0 ? (
        <EmptyState
          icon={<Truck />}
          title="Todavía no tenés fletes"
          description="Cuando aceptes el presupuesto de un fletero, vas a poder seguir el flete desde acá."
        />
      ) : null}
      {enCurso.length > 0 ? (
        <section aria-labelledby="titulo-en-curso" className="grid gap-3">
          <h2 id="titulo-en-curso" className="text-lg font-bold">
            En curso
          </h2>
          <ul className="grid gap-2">
            {enCurso.map((f) => (
              <FilaFlete key={f.id} f={f} />
            ))}
          </ul>
        </section>
      ) : null}
      {anteriores.length > 0 ? (
        <section aria-labelledby="titulo-anteriores" className="grid gap-3">
          <h2 id="titulo-anteriores" className="text-lg font-bold">
            Anteriores
          </h2>
          <ul className="grid gap-2">
            {anteriores.map((f) => (
              <FilaFlete key={f.id} f={f} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
