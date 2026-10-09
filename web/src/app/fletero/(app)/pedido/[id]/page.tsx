import { CheckCircle2, Clock, Lock, MessagesSquare, Package, PauseCircle, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BloquePedido, CabeceraPedido } from "@/components/shared/cabecera-pedido";
import { Estrellas } from "@/components/shared/estrellas";
import { GaleriaFotos } from "@/components/shared/galeria-fotos";
import { TimelineEtapas } from "@/components/shared/timeline/timeline-etapas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ACTOR_DE_FASE, esEtapaActiva, FASE_DE_ETAPA } from "@/domain/ciclo-flete";
import type { EstadoSolicitudPedido } from "@/domain/pedido";
import { hrefConversacion } from "@/features/chat/acceso-rutas";
import { EstadoPresupuestoBadge } from "@/features/fleteros/presupuestos/components/estado-presupuesto";
import { PresupuestoForm } from "@/features/fleteros/presupuestos/components/presupuesto-form";
import { RetirarPresupuesto } from "@/features/fleteros/presupuestos/components/retirar-presupuesto";
import { InventarioLista } from "@/features/fleteros/solicitudes/components/inventario-lista";
import { getSolicitudParaFletero } from "@/features/fleteros/solicitudes/queries";
import { AccionEtapa } from "@/features/fletes/components/accion-etapa";
import { CancelarFlete } from "@/features/fletes/components/cancelar-flete";
import { FleteEnVivo } from "@/features/fletes/components/flete-en-vivo";
import { InventarioControl } from "@/features/fletes/components/inventario-control";
import { InventarioLectura, ResumenInventarioTiles } from "@/features/fletes/components/inventario-lectura";
import { MapaSeguimiento } from "@/features/fletes/components/mapa-seguimiento";
import {
  FirmasYComprobante,
  RecorridoFlete,
  TarjetaContraparte,
} from "@/features/fletes/components/secciones";
import { etapaEnCurso, pasosTimeline } from "@/features/fletes/presentacion";
import { getFleteDetalle, type FleteDetalle } from "@/features/fletes/queries";
import { MapaPuntos } from "@/features/mapas/components/mapas-dinamicos";
import { fotosHabilitadas } from "@/features/uploads/storage";
import { formatearFechaHora, formatearKm, formatearPesos } from "@/lib/formato";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Pedido" };

type Solicitud = NonNullable<Awaited<ReturnType<typeof getSolicitudParaFletero>>>;

/** El presupuesto: el formulario para enviarlo, o el enviado con su estado. */
function PanelPresupuesto({ s, fleteroId }: { s: Solicitud; fleteroId: string }) {
  const abierta = s.estado === "ABIERTA";
  const mio = s.miPresupuesto;
  return (
    <section
      aria-labelledby="titulo-presupuesto"
      className="grid gap-4 rounded-xl border-2 border-primary/20 bg-card p-5 shadow-sm"
    >
      <h2 id="titulo-presupuesto" className="text-xl font-bold">
        {mio ? "Tu presupuesto" : "Enviar presupuesto"}
      </h2>
      {mio ? (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-heading text-3xl font-extrabold tabular-nums">
              {formatearPesos(mio.monto)}
            </span>
            <EstadoPresupuestoBadge estado={mio.estado} validoHasta={mio.validoHasta} />
          </div>
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Ayudantes</dt>
              <dd>{mio.incluyeAyudantes}</dd>
            </div>
            {mio.horaLlegada ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Llegás a las</dt>
                <dd>{mio.horaLlegada} h</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Vale hasta</dt>
              <dd>{formatearFechaHora(mio.validoHasta)}</dd>
            </div>
          </dl>
          {mio.mensaje ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">«{mio.mensaje}»</p> : null}
          {mio.estado === "PENDIENTE" ? (
            <>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                El cliente lo está comparando con otros. Te avisamos cuando elija.
              </p>
              <RetirarPresupuesto presupuestoId={mio.id} />
            </>
          ) : null}
        </div>
      ) : !abierta ? (
        <p className="text-muted-foreground">Este pedido ya no recibe presupuestos.</p>
      ) : !s.disponible ? (
        <p className="flex items-start gap-2">
          <PauseCircle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Estás en pausa.{" "}
            <Link href="/fletero/perfil" className="font-semibold text-primary underline underline-offset-4">
              Activá tu disponibilidad
            </Link>{" "}
            para presupuestar.
          </span>
        </p>
      ) : s.vehiculos.every((v) => !v.puedeLlevar) ? (
        <p className="text-muted-foreground">
          La carga no entra en ninguno de tus vehículos activos.{" "}
          <Link
            href="/fletero/perfil#vehiculos"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Revisá tus vehículos
          </Link>
          .
        </p>
      ) : (
        <PresupuestoForm
          solicitudId={s.id}
          fechaFlete={s.fecha}
          franja={s.franja}
          pideEmbalaje={s.requiereEmbalaje}
          vehiculos={s.vehiculos}
          vehiculoSugeridoId={s.vehiculoSugeridoId}
          tarifas={s.tarifas}
          distanciaLinealKm={s.distanciaLinealKm}
          volumenM3={s.carga.volumenTotalM3}
          ayudantesRequeridos={s.ayudantesRequeridos}
          conflictos={s.conflictos}
        />
      )}
      {s.conversacionId ? (
        <Button asChild variant="outline" className="justify-self-start">
          <Link href={hrefConversacion("FLETERO", s.id, fleteroId)}>
            <MessagesSquare aria-hidden="true" />
            Chat con {s.cliente}
          </Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          El chat con el cliente se abre cuando le presupuestás.
        </p>
      )}
    </section>
  );
}

/** Antes de la adjudicación: el pedido (zona aproximada) y el presupuesto. */
function VerPedido({ s, fleteroId }: { s: Solicitud; fleteroId: string }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid gap-6">
        {s.estado === "CANCELADA" ? (
          <Alert>
            <p>El cliente canceló este pedido{s.motivoCancelacion ? `: «${s.motivoCancelacion}»` : "."}</p>
          </Alert>
        ) : null}
        <RecorridoFlete
          origen={{ ...s.origen, ...s.origen.punto }}
          destino={{ ...s.destino, ...s.destino.punto }}
        >
          <p className="text-sm">
            A <strong>{formatearKm(s.distanciaBaseKm)}</strong> de tu base · recorrido estimado{" "}
            <strong>{formatearKm(s.recorridoKm)}</strong>
          </p>
          {!s.origen.exacta ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Ves la zona aproximada. La dirección exacta y el teléfono aparecen si el cliente acepta tu
              presupuesto.
            </p>
          ) : null}
          <MapaPuntos
            className="h-64"
            etiqueta="Mapa con el origen y el destino del pedido"
            puntos={[
              {
                id: "origen",
                ...s.origen.punto,
                titulo: "Retira",
                detalle: s.origen.direccion,
                variante: "origen",
              },
              {
                id: "destino",
                ...s.destino.punto,
                titulo: "Entrega",
                detalle: s.destino.direccion,
                variante: "destino",
              },
            ]}
          />
        </RecorridoFlete>

        <BloquePedido titulo="Qué hay que llevar">
          {s.descripcion ? <p className="whitespace-pre-line">{s.descripcion}</p> : null}
          <InventarioLista items={s.items} totales={s.carga} />
          {s.ayudantesRequeridos > 0 || s.requiereEmbalaje ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {s.ayudantesRequeridos > 0 ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-semibold">
                  <Users className="size-4" aria-hidden="true" />
                  Pide {s.ayudantesRequeridos} {s.ayudantesRequeridos === 1 ? "ayudante" : "ayudantes"}
                </li>
              ) : null}
              {s.requiereEmbalaje ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-semibold">
                  <Package className="size-4" aria-hidden="true" />
                  Pide embalaje
                </li>
              ) : null}
            </ul>
          ) : null}
        </BloquePedido>

        <BloquePedido titulo="Fotos" descripcion="Para presupuestar sin tener que llamar.">
          <GaleriaFotos fotos={s.fotos} descripcion={s.titulo} />
        </BloquePedido>
      </div>

      <aside className="lg:sticky lg:top-24">
        <PanelPresupuesto s={s} fleteroId={fleteroId} />
      </aside>
    </div>
  );
}

/** El flete es suyo: control de carga y descarga, etapas y contacto con el cliente. */
function GestionFlete({ f }: { f: FleteDetalle }) {
  const fase = FASE_DE_ETAPA[f.etapa];
  // En carga y descarga el inventario es lo primero: es lo que el fletero está haciendo.
  const controlando = fase && ACTOR_DE_FASE[fase] === "FLETERO" ? fase : null;
  const activo = esEtapaActiva(f.etapa);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <FleteEnVivo fleteId={f.id} activo={activo} />
      <div className="grid gap-6">
        {f.etapa === "ENTREGADO" ? (
          <Alert>
            <p>Entregaste la carga. Falta que el cliente revise los ítems y cierre el flete.</p>
          </Alert>
        ) : null}
        {f.cancelacion ? (
          <Alert variant="destructive">
            <p>
              Flete cancelado {f.cancelacion.porRol === "CLIENTE" ? "por el cliente" : "por vos"}
              {f.cancelacion.nota ? `: «${f.cancelacion.nota}»` : "."}
            </p>
          </Alert>
        ) : null}

        {controlando ? (
          <InventarioControl
            fleteId={f.id}
            fase={controlando}
            items={f.items}
            fotosHabilitadas={fotosHabilitadas()}
          />
        ) : null}

        <BloquePedido titulo="Seguimiento" descripcion="Cada etapa con la hora en que pasó.">
          <TimelineEtapas pasos={pasosTimeline(f.pasos, f.cancelacion)} etiqueta="Etapas del flete" />
        </BloquePedido>

        {!controlando && f.resumen.cargados + f.resumen.noCargados > 0 ? (
          <ResumenInventarioTiles resumen={f.resumen} />
        ) : null}
        {!controlando ? <InventarioLectura items={f.items} /> : null}
        <FirmasYComprobante f={f} />

        {f.calificacion ? (
          <BloquePedido titulo="Calificación del cliente">
            <Estrellas puntaje={f.calificacion.puntaje} className="text-xl" />
            {f.calificacion.comentario ? <p>“{f.calificacion.comentario}”</p> : null}
          </BloquePedido>
        ) : null}

        <CancelarFlete fleteId={f.id} etapa={f.etapa} rol="FLETERO" resumen={f.resumen} />
        <AccionEtapa fleteId={f.id} etapa={f.etapa} rol="FLETERO" resumen={f.resumen} />
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-24">
        <TarjetaContraparte f={f} />
        <RecorridoFlete origen={f.origen} destino={f.destino} conNavegacion={activo} />
        <MapaSeguimiento origen={f.origen} destino={f.destino} ultimaUbicacion={null} />
      </aside>
    </div>
  );
}

function textoEtapa(f: FleteDetalle | null) {
  const e = f ? etapaEnCurso(f.pasos) : null;
  return e ? `Etapa ${e.numero} de ${e.total}: ${e.titulo}` : null;
}

export default async function PedidoFleteroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { usuario, fleteroId } = await requireFletero();
  // En paralelo: getFleteDetalle solo devuelve el flete si es de este fletero.
  const [s, f] = await Promise.all([
    getSolicitudParaFletero(fleteroId, id),
    getFleteDetalle({ solicitudId: id }, usuario),
  ]);
  if (!s) notFound();

  // Para quien no lo ganó, un pedido adjudicado a otro se cortó en "Esperando".
  const solicitudEstado: EstadoSolicitudPedido =
    s.estado === "ADJUDICADA" && !f ? "VENCIDA" : (s.estado as EstadoSolicitudPedido);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <CabeceraPedido
        volver={
          f
            ? { href: "/fletero/trabajos", label: "Mis trabajos" }
            : { href: "/fletero", label: "Pedidos disponibles" }
        }
        tipo={s.tipoFlete}
        titulo={s.titulo}
        fecha={f?.fecha ?? s.fecha}
        franja={f?.franja ?? s.franja}
        distanciaKm={s.recorridoKm}
        detalle={textoEtapa(f)}
        estado={{ solicitudEstado, fleteEtapa: f?.etapa ?? null }}
        extra={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            Publicado por {s.cliente} el {formatearFechaHora(s.publicadaEn)}
            {!f ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {s.presupuestosRecibidos === 0
                    ? "sin presupuestos todavía"
                    : `${s.presupuestosRecibidos} ${s.presupuestosRecibidos === 1 ? "presupuesto" : "presupuestos"}`}
                </span>
              </>
            ) : null}
          </span>
        }
        aside={
          f ? (
            <p className="grid">
              <span className="font-heading text-3xl font-extrabold tabular-nums">
                {formatearPesos(f.precioAcordado)}
              </span>
              <span className="text-sm text-muted-foreground">acordado con {f.contraparte}</span>
            </p>
          ) : null
        }
      />
      {f ? <GestionFlete f={f} /> : <VerPedido s={s} fleteroId={fleteroId} />}
    </div>
  );
}
