import { CheckCircle2, MapPin, Package, Star, Truck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BloquePedido, CabeceraPedido } from "@/components/shared/cabecera-pedido";
import { Estrellas } from "@/components/shared/estrellas";
import { TimelineEtapas } from "@/components/shared/timeline/timeline-etapas";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ETIQUETA_ESTADO_INICIAL, ETIQUETA_VEHICULO, FRANJA } from "@/domain/catalogos";
import { esEtapaActiva } from "@/domain/ciclo-flete";
import { esSolicitudEditable } from "@/domain/solicitud";
import { CancelarSolicitud } from "@/features/clientes/solicitudes/components/cancelar-solicitud";
import { FotosSolicitud } from "@/features/clientes/solicitudes/components/fotos-solicitud";
import { PresupuestosRecibidos } from "@/features/clientes/solicitudes/components/presupuestos-recibidos";
import { getSolicitudDelCliente, type SolicitudDelCliente } from "@/features/clientes/solicitudes/queries";
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
import { hrefCalificar } from "@/features/fletes/rutas";
import { fotosHabilitadas } from "@/features/uploads/storage";
import { formatearDia, formatearHora, formatearKg, formatearM3, formatearPesos } from "@/lib/formato";
import { requireCliente } from "@/lib/session";

export const metadata: Metadata = { title: "Pedido" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string }> };

const VOLVER = { href: "/cliente", label: "Mis pedidos" };

/** Datos de la carga y lo pedido, en la columna lateral. */
function DatosCarga({ s }: { s: SolicitudDelCliente }) {
  const extras = [
    s.ayudantesRequeridos
      ? {
          Icono: Users,
          texto: `${s.ayudantesRequeridos} ${s.ayudantesRequeridos === 1 ? "ayudante" : "ayudantes"}`,
        }
      : null,
    s.requiereEmbalaje ? { Icono: Package, texto: "Con embalaje" } : null,
    s.tipoVehiculoSugerido
      ? { Icono: Truck, texto: `Sugeriste ${ETIQUETA_VEHICULO[s.tipoVehiculoSugerido].toLowerCase()}` }
      : null,
  ].filter((x) => x !== null);
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Peso</dt>
          <dd className="font-semibold">{formatearKg(s.carga.pesoTotalKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Volumen</dt>
          <dd className="font-semibold">{formatearM3(s.carga.volumenTotalM3)}</dd>
        </div>
      </dl>
      {extras.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {extras.map(({ Icono, texto }) => (
            <li key={texto}>
              <Badge variant="muted" className="py-1 text-sm">
                <Icono aria-hidden="true" />
                {texto}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {s.descripcion ? <p className="whitespace-pre-line border-t pt-4 text-sm">{s.descripcion}</p> : null}
    </>
  );
}

function Inventario({ s }: { s: SolicitudDelCliente }) {
  return (
    <BloquePedido titulo="Qué llevás" descripcion="Es el inventario que se controla al cargar y al entregar.">
      <ul className="divide-y">
        {s.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
            <span className="font-semibold">
              {i.cantidad > 1 ? `${i.cantidad} × ` : ""}
              {i.nombre}
            </span>
            {i.fragil ? <Badge variant="warning">Frágil</Badge> : null}
            {i.estadoInicial !== "BUENO" ? (
              <Badge variant="outline">{ETIQUETA_ESTADO_INICIAL[i.estadoInicial]}</Badge>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {[i.medidas, i.pesoKgAprox ? formatearKg(i.pesoKgAprox) : null].filter(Boolean).join(" · ")}
            </span>
            {i.notas ? <span className="w-full text-sm text-muted-foreground">{i.notas}</span> : null}
          </li>
        ))}
      </ul>
    </BloquePedido>
  );
}

/** Antes de elegir: presupuestos para comparar, fotos e inventario. */
function PedidoSinFlete({ s, nueva }: { s: SolicitudDelCliente; nueva: boolean }) {
  const editable = esSolicitudEditable(s.estado);
  const textoCuando = `${formatearDia(s.fecha, { largo: true })}, ${FRANJA[s.franja].etiqueta.toLowerCase()}`;
  const vigentes = s.presupuestos.filter((p) => p.estado === "PENDIENTE" && !p.vencido).length;
  const sinFotos = s.fotos.length === 0 && s.items.every((i) => i.fotos.length === 0);

  const fotos = editable ? (
    <BloquePedido
      id="fotos"
      titulo="Fotos"
      descripcion="Con fotos los fleteros te presupuestan sin llamarte. Solo las ven los que pueden presupuestar tu pedido."
    >
      <FotosSolicitud
        solicitudId={s.id}
        general={s.fotos}
        items={s.items.map((i) => ({ id: i.id, nombre: i.nombre, fotos: i.fotos }))}
        habilitadas={fotosHabilitadas()}
      />
    </BloquePedido>
  ) : null;
  // Recién publicado y sin fotos: las fotos primero, que es lo que conviene hacer ahora.
  const fotosPrimero = nueva && sinFotos;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-6">
        {nueva && editable ? (
          <Alert variant="success">
            <CheckCircle2 aria-hidden="true" />
            <p>
              <strong>¡Listo, tu pedido está publicado!</strong> Los fleteros de la zona ya lo ven. Te
              avisamos cuando llegue cada presupuesto.
            </p>
          </Alert>
        ) : null}
        {s.estado === "CANCELADA" ? (
          <Alert>
            <p>Cancelaste este pedido{s.motivoCancelacion ? `: «${s.motivoCancelacion}»` : "."}</p>
          </Alert>
        ) : null}
        {s.estado === "VENCIDA" ? (
          <Alert>
            <p>
              Este pedido venció sin que eligieras un presupuesto. Podés publicarlo de nuevo con otra fecha.
            </p>
          </Alert>
        ) : null}

        {fotosPrimero ? fotos : null}
        <section aria-labelledby="titulo-presupuestos" className="grid gap-4">
          <h2 id="titulo-presupuestos" className="text-2xl font-extrabold">
            Presupuestos recibidos{" "}
            {vigentes > 0 ? <span className="font-normal text-muted-foreground">({vigentes})</span> : null}
          </h2>
          <PresupuestosRecibidos
            solicitudId={s.id}
            presupuestos={s.presupuestos}
            textoCuando={textoCuando}
            puedeAceptar={editable}
            pideEmbalaje={s.requiereEmbalaje}
          />
        </section>
        {fotosPrimero ? null : fotos}
        <Inventario s={s} />
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-24">
        <RecorridoFlete origen={s.origen} destino={s.destino}>
          <DatosCarga s={s} />
        </RecorridoFlete>
        <MapaSeguimiento origen={s.origen} destino={s.destino} ultimaUbicacion={null} />
        {editable ? <CancelarSolicitud solicitudId={s.id} presupuestos={vigentes} /> : null}
      </aside>
    </div>
  );
}

/** Con flete: seguimiento, recepción, calificación y contacto con el fletero. */
function PedidoConFlete({ s, f }: { s: SolicitudDelCliente; f: FleteDetalle }) {
  const recibiendo = f.etapa === "ENTREGADO";
  const conInventarioMovido = f.resumen.cargados + f.resumen.noCargados > 0;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <FleteEnVivo fleteId={f.id} activo={esEtapaActiva(f.etapa)} />
      <div className="grid gap-6">
        {recibiendo ? (
          <Alert>
            <p>
              <strong>{f.contraparte} registró la entrega.</strong> Revisá cada ítem: confirmalo o abrí un
              reclamo si algo llegó mal. Después firmá la conformidad para cerrar el flete.
            </p>
          </Alert>
        ) : null}
        {f.cancelacion ? (
          <Alert variant="destructive">
            <p>
              Flete cancelado {f.cancelacion.porRol === "CLIENTE" ? "por vos" : `por ${f.contraparte}`}
              {f.cancelacion.nota ? `: «${f.cancelacion.nota}»` : "."}
            </p>
          </Alert>
        ) : null}

        {f.etapa === "CERRADO" ? (
          f.calificacion ? (
            <BloquePedido titulo="Tu calificación">
              <Estrellas puntaje={f.calificacion.puntaje} className="text-xl" />
              {f.calificacion.comentario ? <p>“{f.calificacion.comentario}”</p> : null}
            </BloquePedido>
          ) : (
            <Link
              href={hrefCalificar(s.id)}
              className="group flex items-center gap-4 rounded-xl bg-secondary p-5 text-secondary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Star className="size-8 shrink-0 fill-accent text-accent" aria-hidden="true" />
              <span className="grid flex-1 gap-0.5">
                <span className="font-heading text-xl font-extrabold">¿Cómo te fue con {f.contraparte}?</span>
                <span className="text-sm text-secondary-foreground/80">
                  Tu calificación ayuda a otros clientes a elegir.
                </span>
              </span>
              <span className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
                Calificar
              </span>
            </Link>
          )
        ) : null}

        {recibiendo ? (
          <InventarioControl
            fleteId={f.id}
            fase="RECEPCION"
            items={f.items}
            fotosHabilitadas={fotosHabilitadas()}
          />
        ) : null}

        <BloquePedido titulo="Seguimiento" descripcion="Cada etapa con la hora en que pasó.">
          <TimelineEtapas pasos={pasosTimeline(f.pasos, f.cancelacion)} etiqueta="Etapas del flete" />
        </BloquePedido>

        {conInventarioMovido ? <ResumenInventarioTiles resumen={f.resumen} /> : null}
        {!recibiendo ? (
          <InventarioLectura
            items={f.items}
            titulo={esEtapaActiva(f.etapa) ? "Inventario en vivo" : "Inventario"}
          />
        ) : null}
        <FirmasYComprobante f={f} />
        <CancelarFlete fleteId={f.id} etapa={f.etapa} rol="CLIENTE" resumen={f.resumen} />
        <AccionEtapa fleteId={f.id} etapa={f.etapa} rol="CLIENTE" resumen={f.resumen} />
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-24">
        <TarjetaContraparte f={f} />
        <div className="grid gap-2">
          <MapaSeguimiento origen={f.origen} destino={f.destino} ultimaUbicacion={f.ultimaUbicacion} />
          {esEtapaActiva(f.etapa) ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {f.ultimaUbicacion
                ? `Última ubicación que compartió ${f.contraparte}: a las ${formatearHora(f.ultimaUbicacion.fecha)}, al cambiar de etapa.`
                : "Vas a ver dónde está el fletero cuando salga, si comparte su ubicación al cambiar de etapa."}
            </p>
          ) : null}
        </div>
        <RecorridoFlete origen={f.origen} destino={f.destino}>
          <DatosCarga s={s} />
        </RecorridoFlete>
      </aside>
    </div>
  );
}

function textoEtapa(f: FleteDetalle | null) {
  const e = f ? etapaEnCurso(f.pasos) : null;
  return e ? `Etapa ${e.numero} de ${e.total}: ${e.titulo}` : null;
}

export default async function PedidoClientePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { nueva } = await searchParams;
  const { usuario, clienteId } = await requireCliente();
  // En paralelo: el flete (si ya hay) no depende de lo que traiga la solicitud.
  const [s, f] = await Promise.all([
    getSolicitudDelCliente(clienteId, id),
    getFleteDetalle({ solicitudId: id }, usuario),
  ]);
  if (!s) notFound();

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <CabeceraPedido
        volver={VOLVER}
        tipo={s.tipoFlete}
        titulo={s.titulo}
        fecha={f?.fecha ?? s.fecha}
        franja={f?.franja ?? s.franja}
        distanciaKm={s.distanciaKm}
        detalle={textoEtapa(f)}
        estado={{ solicitudEstado: s.estado, fleteEtapa: s.flete?.etapa ?? null }}
        aside={
          f ? (
            <p className="grid">
              <span className="font-heading text-3xl font-extrabold tabular-nums">
                {formatearPesos(f.precioAcordado)}
              </span>
              <span className="text-sm text-muted-foreground">con {f.contraparte}</span>
            </p>
          ) : null
        }
      />
      {f ? <PedidoConFlete s={s} f={f} /> : <PedidoSinFlete s={s} nueva={Boolean(nueva)} />}
      {!f && !esSolicitudEditable(s.estado) ? (
        <Button asChild variant="outline" className="justify-self-start">
          <Link href="/cliente/nuevo">Publicar un pedido nuevo</Link>
        </Button>
      ) : null}
    </div>
  );
}
