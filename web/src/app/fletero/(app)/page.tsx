import { ArrowRight, CalendarDays, ExternalLink, Inbox, PartyPopper, PauseCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Estrellas } from "@/components/shared/estrellas";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TurnoCard } from "@/features/fleteros/fletes/components/turno-card";
import { GananciasChart } from "@/features/fleteros/metricas/components/ganancias-chart";
import { getPanelFletero } from "@/features/fleteros/metricas/queries";
import { formatearDia, formatearPesos, formatearPorcentaje, formatearRating } from "@/lib/formato";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Panel" };

export default async function PanelFleteroPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const { usuario, fleteroId } = await requireFletero();
  const { bienvenida } = await searchParams;
  const panel = await getPanelFletero(fleteroId);
  const { metricas: m } = panel;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hola, ${usuario.nombre}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/fleteros/${fleteroId}`}>
              Mi perfil público
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {bienvenida ? (
        <Alert variant="success">
          <PartyPopper aria-hidden="true" />
          <p>
            <strong>¡Tu perfil está listo!</strong> Ya aparecés en el buscador y podés presupuestar
            solicitudes cerca tuyo.
          </p>
        </Alert>
      ) : null}
      {!panel.disponible ? (
        <Alert>
          <PauseCircle aria-hidden="true" />
          <p>
            Estás en pausa: no aparecés en el buscador.{" "}
            <Link href="/fletero/perfil" className="font-semibold text-primary underline underline-offset-4">
              Activar disponibilidad
            </Link>
          </p>
        </Alert>
      ) : null}

      <Link
        href="/fletero/solicitudes"
        className="group flex items-center gap-4 rounded-lg bg-secondary p-5 text-secondary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Inbox className="size-8 shrink-0" aria-hidden="true" />
        <span className="flex-1">
          <span className="block font-heading text-xl font-extrabold">
            {panel.solicitudesNuevas === 0
              ? "No hay solicitudes nuevas"
              : `${panel.solicitudesNuevas} solicitud${panel.solicitudesNuevas > 1 ? "es" : ""} nueva${panel.solicitudesNuevas > 1 ? "s" : ""} cerca tuyo`}
          </span>
          <span className="text-sm opacity-90">Que entran en tus vehículos y todavía no presupuestaste.</span>
        </span>
        <ArrowRight
          className="size-6 shrink-0 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </Link>

      <section aria-labelledby="titulo-numeros">
        <h2 id="titulo-numeros" className="sr-only">
          Tus números
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Ganancias del mes"
            value={formatearPesos(m.gananciasMes)}
            detail="Fletes confirmados por el cliente"
          />
          <StatTile
            label="Fletes completados"
            value={m.fletesCompletados}
            detail={m.fletesEnCurso > 0 ? `${m.fletesEnCurso} en curso` : "Ninguno en curso"}
          />
          <StatTile
            label="Calificación"
            value={panel.cantidadCalificaciones > 0 ? formatearRating(panel.rating) : "—"}
            detail={
              panel.cantidadCalificaciones > 0 ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Estrellas puntaje={panel.rating} />
                  {panel.cantidadCalificaciones} reseña{panel.cantidadCalificaciones > 1 ? "s" : ""}
                </span>
              ) : (
                "Todavía sin reseñas"
              )
            }
          />
          <StatTile
            label="Tasa de aceptación"
            value={m.tasaAceptacion === null ? "—" : formatearPorcentaje(m.tasaAceptacion)}
            detail={
              m.tasaAceptacion === null
                ? "Cuando los clientes elijan, la vas a ver acá"
                : `De ${m.presupuestosDecididos} presupuestos que los clientes decidieron`
            }
          />
        </dl>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-lg font-bold">Ganancias de los últimos 6 meses</h2>
            <p className="text-sm text-muted-foreground">
              Total histórico: {formatearPesos(m.gananciasTotales)}
            </p>
          </CardHeader>
          <CardContent>
            <GananciasChart datos={m.gananciasPorMes} />
          </CardContent>
        </Card>

        <section aria-labelledby="titulo-proximos" className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-proximos" className="text-lg font-bold">
              Próximos fletes
            </h2>
            <Button asChild variant="link" size="sm">
              <Link href="/fletero/agenda">Ver agenda</Link>
            </Button>
          </div>
          {panel.proximos.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="Sin fletes agendados"
              description="Cuando un cliente acepte tu presupuesto, lo vas a ver acá."
              className="py-8"
            />
          ) : (
            <ul className="grid gap-2">
              {panel.proximos.map((t) => (
                <li key={t.id} className="grid gap-1">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {formatearDia(t.fecha, { largo: true })}
                  </p>
                  <TurnoCard turno={t} enConflicto={panel.enConflicto.has(t.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
