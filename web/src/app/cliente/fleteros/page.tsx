import { BadgeCheck, ChevronRight, MapPin, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Estrellas } from "@/components/shared/estrellas";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_VEHICULO } from "@/domain/catalogos";
import { FiltrosBuscador } from "@/features/clientes/fleteros/components/filtros-buscador";
import { leerParametrosBuscador, radioDeUrl } from "@/features/clientes/fleteros/parametros";
import {
  buscarFleteros,
  getSolicitudesAbiertas,
  resolverReferencia,
} from "@/features/clientes/fleteros/queries";
import { getDireccionHabitual } from "@/features/clientes/perfil/queries";
import { formatearKm, formatearPesos, formatearRating } from "@/lib/formato";
import { requireCliente } from "@/lib/session";

export const metadata: Metadata = { title: "Fleteros" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FleterosPage({ searchParams }: Props) {
  const { clienteId } = await requireCliente();
  const valores = leerParametrosBuscador(await searchParams);

  const [referencia, habitual, solicitudes] = await Promise.all([
    resolverReferencia(clienteId, valores),
    getDireccionHabitual(clienteId),
    getSolicitudesAbiertas(clienteId),
  ]);
  const fleteros = await buscarFleteros({
    referencia,
    radio: radioDeUrl(valores.radio),
    tipoVehiculo: valores.vehiculo ?? null,
    soloDisponibles: valores.todos !== "1",
    precioMaximo: valores.precioMax ?? null,
    ratingMinimo: valores.rating ? Number(valores.rating) : null,
    orden: valores.orden,
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fleteros"
        description="Compará por cercanía, precio y calificación. Para recibir presupuestos, publicá tu flete: les llega a los de tu zona."
        actions={
          <Button asChild>
            <Link href="/cliente/nuevo">Pedir un flete</Link>
          </Button>
        }
      />
      <FiltrosBuscador
        valores={valores}
        referenciaAplicada={referencia.tipo}
        direccionHabitual={habitual?.direccion ?? null}
        solicitudes={solicitudes}
      />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {fleteros.length === 0
          ? null
          : `${fleteros.length} ${fleteros.length === 1 ? "fletero" : "fleteros"}`}
        {referencia.etiqueta && fleteros.length > 0 ? ` cerca de ${referencia.etiqueta}` : null}
        {referencia.carga && fleteros.length > 0
          ? ". El precio estimado sale de las tarifas de cada fletero."
          : null}
      </p>

      {fleteros.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No hay fleteros con esos filtros"
          description="Probá con otra distancia, otro vehículo o sin tope de precio."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {fleteros.map((f) => (
            <li key={f.id}>
              <Link
                href={`/fleteros/${f.id}`}
                className="flex h-full items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-heading text-lg font-extrabold text-secondary-foreground">
                  {f.nombre.charAt(0)}
                </span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{f.nombre}</span>
                    {f.verificado ? (
                      <BadgeCheck className="size-4 text-success" aria-label="Verificado" />
                    ) : null}
                    {!f.disponible ? <Badge variant="muted">En pausa</Badge> : null}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {f.rating !== null ? (
                      <>
                        <Estrellas puntaje={f.rating} />
                        {formatearRating(f.rating)} ({f.calificaciones})
                      </>
                    ) : (
                      "Sin calificaciones todavía"
                    )}
                    <span>
                      · {f.fletesCompletados} {f.fletesCompletados === 1 ? "flete" : "fletes"}
                    </span>
                  </p>
                  {f.distanciaKm !== null ? (
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span>A {formatearKm(f.distanciaKm)}</span>
                      {f.cubreZona ? (
                        <Badge variant="outline">Llega a tu punto</Badge>
                      ) : (
                        <Badge variant="muted">Fuera de su zona ({f.radioKm} km)</Badge>
                      )}
                    </p>
                  ) : f.zona ? (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {f.zona} · hasta {f.radioKm} km
                      </span>
                    </p>
                  ) : null}
                  <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    {f.precioEstimado !== null ? (
                      <span>
                        <span className="text-muted-foreground">Estimado </span>
                        <span className="font-heading text-base font-extrabold tabular-nums">
                          {formatearPesos(f.precioEstimado)}
                        </span>
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">Desde {formatearPesos(f.precioMinimo)}</span>
                  </p>
                  <p className="flex flex-wrap gap-1 pt-1">
                    {[...new Set(f.vehiculos.map((v) => v.tipo))].map((t) => (
                      <Badge key={t} variant="outline">
                        {ETIQUETA_VEHICULO[t]}
                      </Badge>
                    ))}
                  </p>
                </div>
                <ChevronRight
                  className="size-5 shrink-0 self-center text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
