import { ArrowRight, BriefcaseBusiness, Inbox, PartyPopper, PauseCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SegmentedNav } from "@/components/shared/segmented-nav";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FRANJA } from "@/domain/catalogos";
import { fechaIsoAr } from "@/domain/fechas";
import { getTurnosActivos } from "@/features/fleteros/fletes/queries";
import { FiltrosFeed } from "@/features/fleteros/solicitudes/components/filtros-feed";
import { SolicitudCard } from "@/features/fleteros/solicitudes/components/solicitud-card";
import {
  filtrosDeParametros,
  hayFiltros,
  leerParametrosFeed,
  urlFeed,
} from "@/features/fleteros/solicitudes/parametros";
import { getFeed } from "@/features/fleteros/solicitudes/queries";
import { hrefPedido } from "@/features/fletes/rutas";
import { MapaPuntos } from "@/features/mapas/components/mapas-dinamicos";
import { formatearDia, formatearKm } from "@/lib/formato";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Pedidos disponibles" };

/** En el mapa se muestran más pedidos de una vez (no hay "ver más"). */
const PAGINAS_MAPA = 10;

export default async function PedidosDisponiblesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { usuario, fleteroId } = await requireFletero();
  const crudos = await searchParams;
  const params = leerParametrosFeed(crudos);
  const hoy = fechaIsoAr();
  const enMapa = params.vista === "mapa";
  const conFiltros = hayFiltros(params);
  const [feed, turnos] = await Promise.all([
    getFeed(fleteroId, {
      tab: "nuevas",
      orden: params.orden,
      pagina: enMapa ? PAGINAS_MAPA : params.pagina,
      filtros: filtrosDeParametros(params, hoy),
    }),
    getTurnosActivos(fleteroId),
  ]);
  const proximo = [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Pedidos disponibles"
        description={`Hola, ${usuario.nombre}. Pedidos a menos de ${feed.perfil.radioKm} km de tu base que entran en tus vehículos.`}
      />

      {crudos.bienvenida ? (
        <Alert variant="success">
          <PartyPopper aria-hidden="true" />
          <p>
            <strong>¡Tu perfil está listo!</strong> Ya aparecés en el buscador y podés presupuestar pedidos
            cerca tuyo. Subí tus documentos para que te verifiquemos.
          </p>
        </Alert>
      ) : null}
      {!feed.perfil.disponible ? (
        <Alert>
          <PauseCircle aria-hidden="true" />
          <p>
            <strong>Estás en pausa.</strong> Podés ver los pedidos, pero para presupuestar{" "}
            <Link href="/fletero/perfil" className="font-semibold text-primary underline underline-offset-4">
              activá tu disponibilidad
            </Link>
            .
          </p>
        </Alert>
      ) : null}

      {proximo ? (
        <Link
          href={hrefPedido("FLETERO", proximo.solicitudId)}
          className="group flex items-center gap-4 rounded-xl bg-secondary px-5 py-4 text-secondary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BriefcaseBusiness className="size-6 shrink-0 text-accent" aria-hidden="true" />
          <span className="grid min-w-0 flex-1">
            <span className="text-sm text-secondary-foreground/80">
              Tu próximo trabajo{turnos.length > 1 ? ` (de ${turnos.length} en curso)` : ""}
            </span>
            <span className="truncate font-semibold">
              {formatearDia(proximo.fecha, { hoy })} · {FRANJA[proximo.franja].etiqueta} · {proximo.titulo}
            </span>
          </span>
          <ArrowRight
            className="size-5 shrink-0 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      ) : null}

      <FiltrosFeed params={params} radioKm={feed.perfil.radioKm} conFiltros={conFiltros} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold" aria-live="polite">
          {feed.solicitudes.length === 0
            ? "Ningún pedido"
            : `${feed.solicitudes.length}${feed.hayMas ? "+" : ""} ${feed.solicitudes.length === 1 ? "pedido" : "pedidos"}`}
          {conFiltros ? <span className="font-normal text-muted-foreground"> con estos filtros</span> : null}
        </p>
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
        <EmptyState
          icon={<Inbox />}
          title={conFiltros ? "No hay pedidos con esos filtros" : "No hay pedidos nuevos en tu zona"}
          description={
            conFiltros
              ? "Probá con otra fecha, otro tipo o todo tu radio."
              : `Te mostramos los pedidos a menos de ${feed.perfil.radioKm} km que entran en tus vehículos. Si ampliás tu radio o sumás un vehículo más grande, vas a ver más.`
          }
          action={
            conFiltros ? (
              <Button asChild variant="outline">
                <Link href="/fletero">Ver todos</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/fletero/perfil#zona">Ajustar mi zona</Link>
              </Button>
            )
          }
        />
      ) : enMapa ? (
        <div className="grid gap-2">
          <MapaPuntos
            etiqueta="Mapa de pedidos cerca de tu base. Cada pin es una ubicación aproximada."
            base={feed.perfil.base}
            radioKm={feed.perfil.radioKm}
            puntos={feed.solicitudes.map((s) => ({
              id: s.id,
              ...s.ubicacion,
              titulo: s.titulo,
              detalle: `${formatearDia(s.fecha)} · ${FRANJA[s.franja].etiqueta} · a ${formatearKm(s.distanciaBaseKm)}`,
              href: hrefPedido("FLETERO", s.id),
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
          <ul className="grid gap-3">
            {feed.solicitudes.map((s) => (
              <li key={s.id}>
                <SolicitudCard solicitud={s} />
              </li>
            ))}
          </ul>
          {feed.hayMas ? (
            <Button asChild variant="outline" className="justify-self-center">
              <Link href={urlFeed(params, { pagina: params.pagina + 1 })} scroll={false}>
                Ver más pedidos
              </Link>
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
