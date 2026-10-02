import { ArrowLeft, CalendarDays, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UbicacionLinea } from "@/components/shared/ubicacion-linea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ETIQUETA_ESTADO_INICIAL, ETIQUETA_TIPO_FLETE, ETIQUETA_VEHICULO, FRANJA } from "@/domain/catalogos";
import { esSolicitudEditable } from "@/domain/solicitud";
import { CancelarSolicitud } from "@/features/clientes/solicitudes/components/cancelar-solicitud";
import { FotosSolicitud } from "@/features/clientes/solicitudes/components/fotos-solicitud";
import { PresupuestosRecibidos } from "@/features/clientes/solicitudes/components/presupuestos-recibidos";
import { getSolicitudDelCliente } from "@/features/clientes/solicitudes/queries";
import { MapaSeguimiento } from "@/features/fletes/components/mapa-seguimiento";
import { hrefFlete } from "@/features/fletes/rutas";
import { fotosHabilitadas } from "@/features/uploads/storage";
import { formatearDia, formatearKg, formatearKm, formatearM3 } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Solicitud" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string }> };

export default async function SolicitudPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { nueva } = await searchParams;
  const usuario = await requireRol("CLIENTE");
  const s = usuario.clienteProfile ? await getSolicitudDelCliente(usuario.clienteProfile.id, id) : null;
  if (!s) notFound();
  // Con flete, todo pasa en el seguimiento.
  if (s.flete) redirect(hrefFlete("CLIENTE", s.flete.id));

  const editable = esSolicitudEditable(s.estado);
  const textoCuando = `${formatearDia(s.fecha, { largo: true })}, ${FRANJA[s.franja].etiqueta.toLowerCase()}`;
  const pendientes = s.presupuestos.filter((p) => p.estado === "PENDIENTE" && !p.vencido).length;

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/cliente/solicitudes">
          <ArrowLeft aria-hidden="true" />
          Mis solicitudes
        </Link>
      </Button>

      {nueva && editable ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden="true" />
          <p>
            ¡Listo, ya está publicada! Los fleteros de la zona la están viendo. Si sumás fotos, te pueden
            presupuestar mejor.
          </p>
        </Alert>
      ) : null}
      {s.estado === "CANCELADA" ? (
        <Alert>
          <p>Cancelaste esta solicitud.</p>
        </Alert>
      ) : null}
      {s.estado === "VENCIDA" ? (
        <Alert>
          <p>
            Esta solicitud venció sin que eligieras un presupuesto. Podés publicarla de nuevo con otra fecha.
          </p>
        </Alert>
      ) : null}

      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{ETIQUETA_TIPO_FLETE[s.tipoFlete]}</Badge>
          {editable ? <Badge>Abierta</Badge> : null}
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{s.titulo}</h1>
        <p className="flex items-center gap-2 font-semibold">
          <CalendarDays className="size-5 text-primary" aria-hidden="true" />
          {formatearDia(s.fecha, { largo: true })} · {FRANJA[s.franja].etiqueta}
        </p>
      </header>

      <section aria-labelledby="titulo-presupuestos" className="grid gap-3">
        <h2 id="titulo-presupuestos" className="text-lg font-bold">
          Presupuestos {pendientes > 0 ? `(${pendientes})` : ""}
        </h2>
        <PresupuestosRecibidos
          presupuestos={s.presupuestos}
          textoCuando={textoCuando}
          puedeAceptar={editable}
        />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:pt-6">
            <UbicacionLinea etiqueta="Retiro" colorPunto="bg-primary" {...s.origen} />
            <UbicacionLinea etiqueta="Entrega" colorPunto="bg-accent" {...s.destino} />
            <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Distancia</dt>
                <dd className="font-semibold">{formatearKm(s.distanciaKm)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Peso</dt>
                <dd className="font-semibold">{formatearKg(s.carga.pesoTotalKg)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Volumen</dt>
                <dd className="font-semibold">{formatearM3(s.carga.volumenTotalM3)}</dd>
              </div>
            </dl>
            {s.ayudantesRequeridos || s.tipoVehiculoSugerido ? (
              <p className="text-sm text-muted-foreground">
                {s.ayudantesRequeridos
                  ? `${s.ayudantesRequeridos} ${s.ayudantesRequeridos === 1 ? "ayudante" : "ayudantes"}`
                  : ""}
                {s.ayudantesRequeridos && s.tipoVehiculoSugerido ? " · " : ""}
                {s.tipoVehiculoSugerido
                  ? `Sugeriste ${ETIQUETA_VEHICULO[s.tipoVehiculoSugerido].toLowerCase()}`
                  : ""}
              </p>
            ) : null}
            {s.descripcion ? (
              <p className="whitespace-pre-line border-t pt-4 text-sm">{s.descripcion}</p>
            ) : null}
          </CardContent>
        </Card>
        <MapaSeguimiento origen={s.origen} destino={s.destino} ultimaUbicacion={null} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-lg font-bold">Inventario</h2>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            {s.items.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 last:border-0"
              >
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
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-bold">Fotos</h2>
            <p className="text-sm text-muted-foreground">
              Solo las ven los fleteros que pueden presupuestar tu pedido.
            </p>
          </CardHeader>
          <CardContent>
            <FotosSolicitud
              solicitudId={s.id}
              general={s.fotos}
              items={s.items.map((i) => ({ id: i.id, nombre: i.nombre, fotos: i.fotos }))}
              habilitadas={fotosHabilitadas()}
            />
          </CardContent>
        </Card>
      ) : null}

      {editable ? <CancelarSolicitud solicitudId={s.id} presupuestos={pendientes} /> : null}
    </div>
  );
}
