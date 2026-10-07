import { BadgeCheck, MapPin, MessageSquareQuote, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { Estrellas } from "@/components/shared/estrellas";
import { GaleriaFotos } from "@/components/shared/galeria-fotos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ETIQUETA_TIPO_FLETE, ETIQUETA_VEHICULO } from "@/domain/catalogos";
import { VehiculoIcono } from "@/features/fleteros/components/vehiculo-icono";
import { getPerfilPublico } from "@/features/fleteros/publico/queries";
import { MapaPuntos } from "@/features/mapas/components/mapas-dinamicos";
import { formatearFecha, formatearKg, formatearM3, formatearRating } from "@/lib/formato";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> };

const leerPagina = (valor: string | undefined) =>
  Math.min(50, Math.max(1, Number.parseInt(valor ?? "1", 10) || 1));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const perfil = await getPerfilPublico(id);
  return perfil
    ? {
        title: `${perfil.nombre} · Fletero`,
        description: perfil.bio ?? `Fletero en Tucumán con ${perfil.fletesCompletados} fletes completados.`,
      }
    : { title: "Fletero no encontrado" };
}

export default async function PerfilPublicoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const pagina = leerPagina((await searchParams).pagina);
  const perfil = await getPerfilPublico(id, pagina);
  if (!perfil) notFound();

  const maxDistribucion = Math.max(1, ...perfil.distribucion.map((d) => d.cantidad));

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-secondary font-heading text-2xl font-extrabold text-secondary-foreground">
          {perfil.nombre.charAt(0)}
        </span>
        <div className="grid gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold sm:text-3xl">
            {perfil.nombre}
            {perfil.verificado ? (
              <Badge variant="success">
                <BadgeCheck aria-hidden="true" />
                Identidad verificada
              </Badge>
            ) : null}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            {perfil.cantidadCalificaciones > 0 ? (
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Estrellas puntaje={perfil.rating} />
                {formatearRating(perfil.rating)} ({perfil.cantidadCalificaciones})
              </span>
            ) : (
              <span>Sin reseñas todavía</span>
            )}
            <span>{perfil.fletesCompletados} fletes completados</span>
            <span>En la plataforma desde {formatearFecha(perfil.miembroDesde)}</span>
          </p>
          {!perfil.disponible ? (
            <Badge variant="muted" className="justify-self-start">
              No está tomando pedidos por ahora
            </Badge>
          ) : null}
        </div>
      </header>

      {perfil.bio ? <p className="max-w-prose text-lg">{perfil.bio}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Truck className="size-5 text-primary" aria-hidden="true" />
                Vehículos
              </h2>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-4">
                {perfil.vehiculos.map((v) => (
                  <li key={v.id} className="grid gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                        <VehiculoIcono tipo={v.tipo} className="size-5" />
                      </span>
                      <div>
                        <p className="font-bold">
                          {v.marca} {v.modelo}{" "}
                          {v.anio ? (
                            <span className="font-normal text-muted-foreground">{v.anio}</span>
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {ETIQUETA_VEHICULO[v.tipo]} · hasta {formatearKg(v.capacidadKg)} y{" "}
                          {formatearM3(v.volumenM3)}
                        </p>
                      </div>
                    </div>
                    {v.fotos.length > 0 ? (
                      <GaleriaFotos fotos={v.fotos} descripcion={`${v.marca} ${v.modelo}`} />
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <section aria-labelledby="titulo-resenas" className="grid gap-3">
            <h2 id="titulo-resenas" className="text-lg font-bold">
              Reseñas
            </h2>
            {perfil.resenas.length === 0 ? (
              <EmptyState
                icon={<MessageSquareQuote />}
                title="Todavía no tiene reseñas"
                description="Solo pueden calificar los clientes que confirmaron la entrega de un flete."
                className="py-8"
              />
            ) : (
              <>
                <ul className="grid gap-3">
                  {perfil.resenas.map((r) => (
                    <li key={r.id}>
                      <article className="grid gap-2 rounded-lg border bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Estrellas puntaje={r.puntaje} />
                          <span className="text-sm text-muted-foreground">{formatearFecha(r.fecha)}</span>
                        </div>
                        {r.comentario ? <p>“{r.comentario}”</p> : null}
                        <p className="text-sm text-muted-foreground">
                          {r.autor} · {ETIQUETA_TIPO_FLETE[r.tipoFlete]}
                        </p>
                      </article>
                    </li>
                  ))}
                </ul>
                <nav aria-label="Más reseñas" className="flex justify-between gap-2">
                  {perfil.pagina > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/fleteros/${perfil.id}?pagina=${perfil.pagina - 1}`}>
                        Reseñas más nuevas
                      </Link>
                    </Button>
                  ) : (
                    <span />
                  )}
                  {perfil.hayMasResenas ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/fleteros/${perfil.id}?pagina=${perfil.pagina + 1}`}>
                        Reseñas anteriores
                      </Link>
                    </Button>
                  ) : null}
                </nav>
              </>
            )}
          </section>
        </div>

        <aside className="grid gap-6">
          {perfil.cantidadCalificaciones > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <h2 className="text-lg font-bold">Calificaciones</h2>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1.5" aria-label="Distribución de calificaciones">
                  {perfil.distribucion.map((d) => (
                    <li
                      key={d.puntaje}
                      className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-2 text-sm"
                    >
                      <span>{d.puntaje} estrellas</span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${(d.cantidad / maxDistribucion) * 100}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">{d.cantidad}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {perfil.zona ? (
            <Card>
              <CardHeader className="pb-3">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <MapPin className="size-5 text-primary" aria-hidden="true" />
                  Zona de trabajo
                </h2>
                <p className="text-sm text-muted-foreground">
                  Hasta {perfil.zona.radioKm} km de su base (ubicación aproximada).
                </p>
              </CardHeader>
              <CardContent>
                <MapaPuntos
                  className="h-56"
                  etiqueta={`Zona de trabajo de ${perfil.nombre}`}
                  etiquetaBase="Zona aproximada de su base"
                  base={perfil.zona.centro}
                  radioKm={perfil.zona.radioKm}
                  puntos={[]}
                />
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
