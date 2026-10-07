import { BadgeCheck, ChevronRight, MapPin, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Estrellas } from "@/components/shared/estrellas";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ETIQUETA_VEHICULO, TIPOS_VEHICULO, type TipoVehiculo } from "@/domain/catalogos";
import { buscarFleteros, type OrdenFleteros } from "@/features/clientes/fleteros/queries";
import { formatearRating } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Fleteros" };

type Props = { searchParams: Promise<{ vehiculo?: string; orden?: string; todos?: string }> };

export default async function FleterosPage({ searchParams }: Props) {
  await requireRol("CLIENTE");
  const q = await searchParams;
  // Los filtros llegan por URL: se validan contra los catálogos, nunca se usan tal cual.
  const tipoVehiculo = (TIPOS_VEHICULO as readonly string[]).includes(q.vehiculo ?? "")
    ? (q.vehiculo as TipoVehiculo)
    : null;
  const orden: OrdenFleteros = q.orden === "experiencia" ? "experiencia" : "calificacion";
  const soloDisponibles = q.todos !== "1";
  const fleteros = await buscarFleteros({ tipoVehiculo, orden, soloDisponibles });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fleteros"
        description="Mirá quién trabaja en Tucumán. Para recibir presupuestos, publicá tu flete: les llega a los de tu zona."
        actions={
          <Button asChild>
            <Link href="/cliente/solicitudes/nueva">Publicar un flete</Link>
          </Button>
        }
      />
      <form
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        method="get"
      >
        <div className="grid gap-2">
          <Label htmlFor="vehiculo">Vehículo</Label>
          <Select id="vehiculo" name="vehiculo" defaultValue={tipoVehiculo ?? ""}>
            <option value="">Cualquiera</option>
            {TIPOS_VEHICULO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_VEHICULO[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="orden">Ordenar por</Label>
          <Select id="orden" name="orden" defaultValue={orden}>
            <option value="calificacion">Mejor calificados</option>
            <option value="experiencia">Más reseñas</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 py-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            name="todos"
            value="1"
            defaultChecked={!soloDisponibles}
            className="size-5 accent-[hsl(var(--primary))]"
          />
          Incluir en pausa
        </label>
        <Button type="submit" variant="outline">
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </form>

      {fleteros.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No hay fleteros con esos filtros"
          description="Probá con otro vehículo."
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
                  {f.zona ? (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {f.zona} · hasta {f.radioKm} km
                      </span>
                    </p>
                  ) : null}
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
