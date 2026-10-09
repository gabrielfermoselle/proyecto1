import { AlertTriangle, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Estrellas } from "@/components/shared/estrellas";
import { SegmentedNav } from "@/components/shared/segmented-nav";
import { StatTile } from "@/components/shared/stat-tile";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FRANJA, FRANJAS_HORARIAS } from "@/domain/catalogos";
import { agruparPorDia } from "@/domain/agenda";
import { fechaIsoAr, inicioDeSemana, sumarDias } from "@/domain/fechas";
import { TurnoCard } from "@/features/fleteros/fletes/components/turno-card";
import { getAgenda } from "@/features/fleteros/fletes/queries";
import { GananciasChart } from "@/features/fleteros/metricas/components/ganancias-chart";
import { getPanelFletero } from "@/features/fleteros/metricas/queries";
import { EstadoPresupuestoBadge } from "@/features/fleteros/presupuestos/components/estado-presupuesto";
import {
  getMisPresupuestos,
  TABS_PRESUPUESTOS,
  type TabPresupuestos,
} from "@/features/fleteros/presupuestos/queries";
import { hrefPedido } from "@/features/fletes/rutas";
import {
  formatearDia,
  formatearDiaAbsoluto,
  formatearFechaHora,
  formatearPesos,
  formatearPorcentaje,
  formatearRating,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

// Las tres pestañas de "Mis trabajos": la agenda de fletes aceptados, los presupuestos enviados y
// los números (ganancias, calificación, aceptación).

const esFechaIso = (v: string | undefined): v is string =>
  Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));

export async function Agenda({ fleteroId, semana }: { fleteroId: string; semana: string | undefined }) {
  const hoy = fechaIsoAr();
  const lunes = inicioDeSemana(esFechaIso(semana) ? semana : hoy);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const { turnos, enConflicto } = await getAgenda(fleteroId);
  const grupos = agruparPorDia(turnos);
  const diasConConflicto = [...new Set(turnos.filter((t) => enConflicto.has(t.id)).map((t) => t.fecha))];

  if (turnos.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="No tenés trabajos agendados"
        description="Cuando un cliente acepte tu presupuesto, el flete aparece acá con su fecha y horario."
        action={
          <Button asChild variant="outline">
            <Link href="/fletero">Ver pedidos disponibles</Link>
          </Button>
        }
      />
    );
  }

  const semanaHref = (d: string) => `/fletero/trabajos?semana=${d}`;
  return (
    <div className="grid gap-5">
      {diasConConflicto.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <p>
            <strong>Tenés fletes superpuestos</strong> el{" "}
            {diasConConflicto.map((d) => formatearDia(d, { hoy })).join(", ")}. Revisá los horarios con los
            clientes por el chat.
          </p>
        </Alert>
      ) : null}

      {/* Celular y tablet: lista por día. */}
      <div className="grid gap-6 lg:hidden">
        {grupos.map(({ fecha, turnos: delDia }) => (
          <section key={fecha} aria-labelledby={`dia-${fecha}`} className="grid gap-2">
            <h3 id={`dia-${fecha}`} className="font-bold">
              {formatearDia(fecha, { largo: true, hoy })}
              {fecha < hoy ? (
                <span className="font-normal text-muted-foreground"> · día anterior</span>
              ) : null}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {delDia.map((t) => (
                <li key={t.id}>
                  <TurnoCard turno={t} enConflicto={enConflicto.has(t.id)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Escritorio: la semana por franjas. */}
      <section aria-label="Semana" className="hidden gap-3 lg:grid">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Semana del {formatearDiaAbsoluto(lunes)}</h3>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={semanaHref(sumarDias(lunes, -7))} scroll={false}>
                <ChevronLeft aria-hidden="true" />
                Anterior
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/fletero/trabajos" scroll={false}>
                Hoy
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={semanaHref(sumarDias(lunes, 7))} scroll={false}>
                Siguiente
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
        <div
          tabIndex={0}
          role="region"
          aria-label="Grilla de la semana"
          className="overflow-x-auto rounded-xl border bg-card shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
            <caption className="sr-only">Fletes de la semana por día y franja horaria</caption>
            <thead>
              <tr>
                <th scope="col" className="w-28 border-b p-2 text-left font-semibold text-muted-foreground">
                  Franja
                </th>
                {dias.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className={cn(
                      "border-b border-l p-2 text-left font-semibold",
                      d === hoy && "bg-accent/15 text-foreground",
                    )}
                  >
                    {formatearDia(d, { hoy })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FRANJAS_HORARIAS.map((franja) => (
                <tr key={franja}>
                  <th
                    scope="row"
                    className="border-b p-2 text-left align-top font-semibold text-muted-foreground"
                  >
                    {FRANJA[franja].etiqueta}
                  </th>
                  {dias.map((d) => {
                    const enCelda = turnos.filter((t) => t.fecha === d && t.franja === franja);
                    return (
                      <td
                        key={d}
                        className={cn("border-b border-l p-1.5 align-top", d === hoy && "bg-accent/10")}
                      >
                        <div className="grid gap-1.5">
                          {enCelda.map((t) => (
                            <TurnoCard key={t.id} turno={t} enConflicto={enConflicto.has(t.id)} compacto />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const ETIQUETA_ESTADO: Record<TabPresupuestos, string> = {
  pendientes: "Pendientes",
  aceptados: "Aceptados",
  historial: "Historial",
};

const VACIO: Record<TabPresupuestos, string> = {
  pendientes: "No tenés presupuestos esperando respuesta.",
  aceptados: "Todavía no te aceptaron ningún presupuesto.",
  historial: "Acá van a aparecer los presupuestos no elegidos, retirados o vencidos.",
};

export async function Presupuestos({ fleteroId, estado }: { fleteroId: string; estado: string | undefined }) {
  const tab: TabPresupuestos = (TABS_PRESUPUESTOS as readonly string[]).includes(estado ?? "")
    ? (estado as TabPresupuestos)
    : "pendientes";
  const { presupuestos, conteos } = await getMisPresupuestos(fleteroId, tab);
  return (
    <div className="grid gap-4">
      <SegmentedNav
        label="Estado de los presupuestos"
        segmentos={TABS_PRESUPUESTOS.map((t) => ({
          href: `/fletero/trabajos?tab=presupuestos${t === "pendientes" ? "" : `&estado=${t}`}`,
          label: ETIQUETA_ESTADO[t],
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
              <Link href="/fletero">Ver pedidos disponibles</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {presupuestos.map((p) => (
            <li key={p.id}>
              <article className="group relative grid gap-2 rounded-xl border bg-card p-4 shadow-sm transition-[border-color,box-shadow] focus-within:ring-2 focus-within:ring-ring hover:border-primary/40 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="grid gap-1">
                  <h3 className="font-bold">
                    <Link
                      href={hrefPedido("FLETERO", p.solicitudId)}
                      className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
                    >
                      {p.titulo}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {formatearDia(p.fecha)} · {FRANJA[p.franja].etiqueta} · {p.zonaOrigen} → {p.zonaDestino}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Enviado el {formatearFechaHora(p.enviadoEn)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <span className="font-heading text-2xl font-extrabold tabular-nums">
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
          ))}
        </ul>
      )}
    </div>
  );
}

export async function Ganancias({ fleteroId }: { fleteroId: string }) {
  const panel = await getPanelFletero(fleteroId);
  const { metricas: m } = panel;
  return (
    <div className="grid gap-6">
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
      <section
        aria-labelledby="titulo-ganancias"
        className="grid gap-3 rounded-xl border bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="grid gap-1">
          <h3 id="titulo-ganancias" className="text-lg font-bold">
            Ganancias de los últimos 6 meses
          </h3>
          <p className="text-sm text-muted-foreground">
            Total histórico: {formatearPesos(m.gananciasTotales)}
          </p>
        </div>
        <GananciasChart datos={m.gananciasPorMes} />
      </section>
    </div>
  );
}
