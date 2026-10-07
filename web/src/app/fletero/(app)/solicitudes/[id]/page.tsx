import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Lock,
  MessagesSquare,
  PauseCircle,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GaleriaFotos } from "@/components/shared/galeria-fotos";
import { UbicacionLinea } from "@/components/shared/ubicacion-linea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ETIQUETA_TIPO_FLETE, FRANJA } from "@/domain/catalogos";
import { EstadoPresupuestoBadge } from "@/features/fleteros/presupuestos/components/estado-presupuesto";
import { PresupuestoForm } from "@/features/fleteros/presupuestos/components/presupuesto-form";
import { RetirarPresupuesto } from "@/features/fleteros/presupuestos/components/retirar-presupuesto";
import { InventarioLista } from "@/features/fleteros/solicitudes/components/inventario-lista";
import { getSolicitudParaFletero } from "@/features/fleteros/solicitudes/queries";
import { MapaPuntos } from "@/features/mapas/components/mapas-dinamicos";
import { formatearDia, formatearFechaHora, formatearKm, formatearPesos } from "@/lib/formato";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Detalle de solicitud" };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-lg font-bold">{titulo}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function SolicitudFleteroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { fleteroId } = await requireFletero();
  const s = await getSolicitudParaFletero(fleteroId, id);
  if (!s) notFound();

  const abierta = s.estado === "ABIERTA";

  return (
    <div className="grid gap-5">
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/fletero/solicitudes">
          <ArrowLeft aria-hidden="true" />
          Solicitudes
        </Link>
      </Button>

      <header className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="muted">{ETIQUETA_TIPO_FLETE[s.tipoFlete]}</Badge>
          {!abierta ? <Badge variant="outline">Ya no recibe presupuestos</Badge> : null}
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{s.titulo}</h1>
        <p className="text-muted-foreground">
          Publicada por {s.cliente} el {formatearFechaHora(s.publicadaEn)} ·{" "}
          {s.presupuestosRecibidos === 0
            ? "sin presupuestos todavía"
            : `${s.presupuestosRecibidos} presupuesto(s) recibidos`}
        </p>
      </header>

      {s.conversacionId ? (
        <Button asChild variant="secondary" className="justify-self-start">
          <Link href={`/fletero/mensajes/${s.conversacionId}`}>
            <MessagesSquare aria-hidden="true" />
            Chat con {s.cliente}
          </Link>
        </Button>
      ) : null}

      {s.fleteId ? (
        <Alert variant="success">
          <Truck aria-hidden="true" />
          <p>
            <strong>Este flete es tuyo.</strong>{" "}
            <Link
              href={`/fletero/fletes/${s.fleteId}`}
              className="font-semibold underline underline-offset-4"
            >
              Ir a la gestión del flete
            </Link>
          </p>
        </Alert>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-5">
          <Seccion titulo="Cuándo y dónde">
            <div className="grid gap-4">
              <p className="flex items-center gap-2 font-semibold">
                <CalendarDays className="size-5 text-primary" aria-hidden="true" />
                {formatearDia(s.fecha, { largo: true })} · {FRANJA[s.franja].etiqueta}
              </p>
              <UbicacionLinea etiqueta="Retira en" colorPunto="bg-primary" {...s.origen} />
              <UbicacionLinea etiqueta="Entrega en" colorPunto="bg-accent" {...s.destino} />
              <p className="text-sm">
                A <strong>{formatearKm(s.distanciaBaseKm)}</strong> de tu base · recorrido estimado{" "}
                <strong>{formatearKm(s.recorridoKm)}</strong>
              </p>
              {!s.origen.exacta ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Ves la zona aproximada. La dirección exacta aparece si el cliente acepta tu presupuesto.
                </p>
              ) : null}
              <MapaPuntos
                className="h-56"
                etiqueta="Mapa con el origen y el destino del flete"
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
            </div>
          </Seccion>

          <Seccion titulo="Qué hay que llevar">
            <div className="grid gap-4">
              {s.descripcion ? <p className="whitespace-pre-line">{s.descripcion}</p> : null}
              <InventarioLista items={s.items} totales={s.carga} />
              {s.ayudantesRequeridos > 0 ? (
                <p className="text-sm">
                  El cliente pide <strong>{s.ayudantesRequeridos}</strong> ayudante
                  {s.ayudantesRequeridos > 1 ? "s" : ""}.
                </p>
              ) : null}
            </div>
          </Seccion>

          <Seccion titulo="Fotos">
            <GaleriaFotos fotos={s.fotos} descripcion={s.titulo} />
          </Seccion>
        </div>

        <aside className="lg:sticky lg:top-32">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-lg font-bold">
                {s.miPresupuesto ? "Tu presupuesto" : "Enviar presupuesto"}
              </h2>
            </CardHeader>
            <CardContent>
              {s.miPresupuesto ? (
                <div className="grid gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-heading text-3xl font-extrabold tabular-nums">
                      {formatearPesos(s.miPresupuesto.monto)}
                    </span>
                    <EstadoPresupuestoBadge
                      estado={s.miPresupuesto.estado}
                      validoHasta={s.miPresupuesto.validoHasta}
                    />
                  </div>
                  <dl className="grid gap-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Ayudantes</dt>
                      <dd>{s.miPresupuesto.incluyeAyudantes}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Vale hasta</dt>
                      <dd>{formatearFechaHora(s.miPresupuesto.validoHasta)}</dd>
                    </div>
                  </dl>
                  {s.miPresupuesto.mensaje ? (
                    <blockquote className="border-l-4 pl-3 text-sm italic">
                      {s.miPresupuesto.mensaje}
                    </blockquote>
                  ) : null}
                  {s.miPresupuesto.estado === "PENDIENTE" ? (
                    <>
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                        El cliente lo está comparando con otros. Te avisamos cuando elija.
                      </p>
                      <RetirarPresupuesto presupuestoId={s.miPresupuesto.id} />
                    </>
                  ) : null}
                </div>
              ) : !abierta ? (
                <p className="text-muted-foreground">Esta solicitud ya no recibe presupuestos.</p>
              ) : !s.disponible ? (
                <p className="flex items-start gap-2">
                  <PauseCircle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
                  <span>
                    Estás en pausa.{" "}
                    <Link
                      href="/fletero/perfil"
                      className="font-semibold text-primary underline underline-offset-4"
                    >
                      Activá tu disponibilidad
                    </Link>{" "}
                    para enviar presupuestos.
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
                  vehiculos={s.vehiculos}
                  vehiculoSugeridoId={s.vehiculoSugeridoId}
                  tarifas={s.tarifas}
                  distanciaLinealKm={s.distanciaLinealKm}
                  volumenM3={s.carga.volumenTotalM3}
                  ayudantesRequeridos={s.ayudantesRequeridos}
                  conflictos={s.conflictos}
                />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
