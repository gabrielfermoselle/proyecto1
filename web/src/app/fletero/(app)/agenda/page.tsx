import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FRANJA, FRANJAS_HORARIAS } from "@/domain/catalogos";
import { agruparPorDia } from "@/domain/agenda";
import { fechaIsoAr, inicioDeSemana, sumarDias } from "@/domain/fechas";
import { TurnoCard } from "@/features/fleteros/fletes/components/turno-card";
import { getAgenda } from "@/features/fleteros/fletes/queries";
import { formatearDia, formatearDiaAbsoluto } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Agenda" };

const esFechaIso = (v: string | undefined): v is string =>
  Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { fleteroId } = await requireFletero();
  const { semana: semanaParam } = await searchParams;
  const hoy = fechaIsoAr();
  const lunes = inicioDeSemana(esFechaIso(semanaParam) ? semanaParam : hoy);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

  const { turnos, enConflicto } = await getAgenda(fleteroId);
  const grupos = agruparPorDia(turnos);
  const diasConConflicto = [...new Set(turnos.filter((t) => enConflicto.has(t.id)).map((t) => t.fecha))];

  return (
    <div className="grid gap-5">
      <PageHeader title="Agenda" description="Tus fletes aceptados que todavía no terminaron." />

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

      {turnos.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No tenés fletes agendados"
          description="Cuando un cliente acepte tu presupuesto, el flete aparece acá con su fecha y horario."
          action={
            <Button asChild variant="outline">
              <Link href="/fletero/solicitudes">Buscar solicitudes</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Celular: lista por día. */}
          <div className="grid gap-6 md:hidden">
            {grupos.map(({ fecha, turnos: delDia }) => (
              <section key={fecha} aria-labelledby={`dia-${fecha}`} className="grid gap-2">
                <h2
                  id={`dia-${fecha}`}
                  className="text-sm font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {formatearDia(fecha, { largo: true, hoy })}
                  {fecha < hoy ? " · día anterior" : ""}
                </h2>
                <ul className="grid gap-2">
                  {delDia.map((t) => (
                    <li key={t.id}>
                      <TurnoCard turno={t} enConflicto={enConflicto.has(t.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Escritorio: semana por franjas. */}
          <section aria-label="Semana" className="hidden gap-3 md:grid">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">Semana del {formatearDiaAbsoluto(lunes)}</h2>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/fletero/agenda?semana=${sumarDias(lunes, -7)}`} scroll={false}>
                    <ChevronLeft aria-hidden="true" />
                    Anterior
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/fletero/agenda" scroll={false}>
                    Hoy
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/fletero/agenda?semana=${sumarDias(lunes, 7)}`} scroll={false}>
                    Siguiente
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
            {/* Se desplaza de costado en pantallas angostas: enfocable para hacerlo con el teclado. */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Grilla de la semana"
              className="overflow-x-auto rounded-lg border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
                <caption className="sr-only">Fletes de la semana por día y franja horaria</caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="w-28 border-b p-2 text-left font-semibold text-muted-foreground"
                    >
                      Franja
                    </th>
                    {dias.map((d) => (
                      <th
                        key={d}
                        scope="col"
                        className={cn(
                          "border-b border-l p-2 text-left font-semibold",
                          d === hoy && "bg-primary/5 text-primary",
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
                            className={cn("border-b border-l p-1.5 align-top", d === hoy && "bg-primary/5")}
                          >
                            <div className="grid gap-1.5">
                              {enCelda.map((t) => (
                                <TurnoCard
                                  key={t.id}
                                  turno={t}
                                  enConflicto={enConflicto.has(t.id)}
                                  compacto
                                />
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
        </>
      )}
    </div>
  );
}
