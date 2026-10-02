import { ChevronRight, ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_ETAPA, FRANJA } from "@/domain/catalogos";
import { getSolicitudesDelCliente, type SolicitudDeLista } from "@/features/clientes/solicitudes/queries";
import { hrefFlete } from "@/features/fletes/rutas";
import { formatearDia } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Mis solicitudes" };

const ESTADO: Record<SolicitudDeLista["estado"], { texto: string; variante: BadgeVariant }> = {
  ABIERTA: { texto: "Abierta", variante: "default" },
  ADJUDICADA: { texto: "Con flete", variante: "success" },
  CANCELADA: { texto: "Cancelada", variante: "muted" },
  VENCIDA: { texto: "Vencida", variante: "muted" },
};

function Fila({ s }: { s: SolicitudDeLista }) {
  // Con flete, el detalle útil es el seguimiento.
  const href = s.flete ? hrefFlete("CLIENTE", s.flete.id) : `/cliente/solicitudes/${s.id}`;
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{s.titulo}</span>
            <Badge variant={ESTADO[s.estado].variante}>
              {s.flete ? ETIQUETA_ETAPA[s.flete.etapa] : ESTADO[s.estado].texto}
            </Badge>
            {s.estado === "ABIERTA" && s.presupuestosPendientes > 0 ? (
              <Badge variant="warning">
                {s.presupuestosPendientes} {s.presupuestosPendientes === 1 ? "presupuesto" : "presupuestos"}
              </Badge>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatearDia(s.fecha)} · {FRANJA[s.franja].etiqueta} · {s.items}{" "}
            {s.items === 1 ? "ítem" : "ítems"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {s.origen} → {s.destino}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function SolicitudesPage() {
  const usuario = await requireRol("CLIENTE");
  const solicitudes = usuario.clienteProfile ? await getSolicitudesDelCliente(usuario.clienteProfile.id) : [];
  const abiertas = solicitudes.filter((s) => s.estado === "ABIERTA");
  const resto = solicitudes.filter((s) => s.estado !== "ABIERTA");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Mis solicitudes"
        description="Lo que publicaste para recibir presupuestos."
        actions={
          <Button asChild>
            <Link href="/cliente/solicitudes/nueva">
              <Plus aria-hidden="true" />
              Publicar un flete
            </Link>
          </Button>
        }
      />
      {solicitudes.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="Todavía no publicaste nada"
          description="Contá qué necesitás trasladar y los fleteros de la zona te mandan presupuestos."
        />
      ) : null}
      {abiertas.length > 0 ? (
        <section aria-labelledby="titulo-abiertas" className="grid gap-3">
          <h2 id="titulo-abiertas" className="text-lg font-bold">
            Esperando presupuestos
          </h2>
          <ul className="grid gap-2">
            {abiertas.map((s) => (
              <Fila key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ) : null}
      {resto.length > 0 ? (
        <section aria-labelledby="titulo-resto" className="grid gap-3">
          <h2 id="titulo-resto" className="text-lg font-bold">
            Anteriores
          </h2>
          <ul className="grid gap-2">
            {resto.map((s) => (
              <Fila key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
