import { Inbox, PauseCircle, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedNav } from "@/components/shared/segmented-nav";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FRANJA } from "@/domain/catalogos";
import { SolicitudCard } from "@/features/fleteros/solicitudes/components/solicitud-card";
import { leerParametrosFeed, urlFeed } from "@/features/fleteros/solicitudes/parametros";
import { getFeed } from "@/features/fleteros/solicitudes/queries";
import { MapaPuntos } from "@/features/mapas/components/mapas-dinamicos";
import { formatearDia, formatearKm } from "@/lib/formato";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Solicitudes" };

/** En el mapa se muestran más solicitudes de una vez (no hay "ver más"). */
const PAGINAS_MAPA = 10;

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { fleteroId } = await requireFletero();
  const params = leerParametrosFeed(await searchParams);
  const enMapa = params.vista === "mapa";
  const feed = await getFeed(fleteroId, {
    tab: params.tab,
    orden: params.orden,
    pagina: enMapa ? PAGINAS_MAPA : params.pagina,
  });
  const esNuevas = params.tab === "nuevas";

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Solicitudes"
        description={`Pedidos a menos de ${feed.perfil.radioKm} km de tu base que entran en tus vehículos.`}
        actions={
          <Button asChild variant="outline" size="sm" className="md:hidden">
            <Link href="/fletero/presupuestos">Mis presupuestos</Link>
          </Button>
        }
      />

      {!feed.perfil.disponible ? (
        <Alert>
          <PauseCircle aria-hidden="true" />
          <p>
            <strong>Estás en pausa.</strong> Podés ver las solicitudes, pero para enviar presupuestos{" "}
            <Link href="/fletero/perfil" className="font-semibold text-primary underline underline-offset-4">
              activá tu disponibilidad
            </Link>
            .
          </p>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedNav
          label="Tipo de solicitudes"
          segmentos={[
            {
              href: urlFeed(params, { tab: "nuevas" }),
              label: "Nuevas",
              activo: esNuevas,
              contador: feed.conteos.nuevas,
            },
            {
              href: urlFeed(params, { tab: "presupuestadas" }),
              label: "Presupuestadas",
              activo: !esNuevas,
              contador: feed.conteos.presupuestadas,
            },
          ]}
        />
        <div className="flex flex-wrap gap-3">
          {!enMapa ? (
            <SegmentedNav
              label="Ordenar por"
              segmentos={[
                {
                  href: urlFeed(params, { orden: "distancia" }),
                  label: "Más cerca",
                  activo: params.orden === "distancia",
                },
                {
                  href: urlFeed(params, { orden: "fecha" }),
                  label: "Más pronto",
                  activo: params.orden === "fecha",
                },
              ]}
            />
          ) : null}
          <SegmentedNav
            label="Vista"
            segmentos={[
              { href: urlFeed(params, { vista: "lista" }), label: "Lista", activo: !enMapa },
              { href: urlFeed(params, { vista: "mapa" }), label: "Mapa", activo: enMapa },
            ]}
          />
        </div>
      </div>

      {feed.solicitudes.length === 0 ? (
        esNuevas ? (
          <EmptyState
            icon={<Inbox />}
            title="No hay solicitudes nuevas en tu zona"
            description={
              <p>
                Te mostramos los pedidos a menos de {feed.perfil.radioKm} km que entran en tus vehículos. Si
                ampliás tu radio o sumás un vehículo más grande, vas a ver más.
              </p>
            }
            action={
              <Button asChild variant="outline">
                <Link href="/fletero/perfil#zona">Ajustar mi zona</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Send />}
            title="Todavía no tenés presupuestos en curso"
            description="Cuando envíes un presupuesto, la solicitud va a aparecer acá hasta que el cliente elija."
            action={
              <Button asChild variant="outline">
                <Link href={urlFeed(params, { tab: "nuevas" })}>Ver solicitudes nuevas</Link>
              </Button>
            }
          />
        )
      ) : enMapa ? (
        <div className="grid gap-2">
          <MapaPuntos
            etiqueta="Mapa de solicitudes cerca de tu base. Cada pin es una ubicación aproximada."
            base={feed.perfil.base}
            radioKm={feed.perfil.radioKm}
            puntos={feed.solicitudes.map((s) => ({
              id: s.id,
              ...s.ubicacion,
              titulo: s.titulo,
              detalle: `${formatearDia(s.fecha)} · ${FRANJA[s.franja].etiqueta} · a ${formatearKm(s.distanciaBaseKm)}`,
              href: `/fletero/solicitudes/${s.id}`,
              variante: "aprox",
            }))}
          />
          <p className="text-sm text-muted-foreground">
            Los pines muestran una ubicación aproximada. La dirección exacta aparece cuando el cliente acepta
            tu presupuesto.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {feed.solicitudes.map((s) => (
              <li key={s.id}>
                <SolicitudCard solicitud={s} />
              </li>
            ))}
          </ul>
          {feed.hayMas ? (
            <Button asChild variant="outline" className="justify-self-center">
              <Link href={urlFeed(params, { pagina: params.pagina + 1 })} scroll={false}>
                Ver más solicitudes
              </Link>
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
