import { ArrowLeft, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Estrellas } from "@/components/shared/estrellas";
import { TimelineEtapas } from "@/components/shared/timeline/timeline-etapas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { esEtapaActiva } from "@/domain/ciclo-flete";
import { AccionEtapa } from "@/features/fletes/components/accion-etapa";
import { CancelarFlete } from "@/features/fletes/components/cancelar-flete";
import { FleteEnVivo } from "@/features/fletes/components/flete-en-vivo";
import { FormCalificacion } from "@/features/fletes/components/form-calificacion";
import { InventarioControl } from "@/features/fletes/components/inventario-control";
import { InventarioLectura, ResumenInventarioTiles } from "@/features/fletes/components/inventario-lectura";
import { MapaSeguimiento } from "@/features/fletes/components/mapa-seguimiento";
import {
  BotonChat,
  CabeceraFlete,
  DatosFlete,
  FirmasYComprobante,
} from "@/features/fletes/components/secciones";
import { pasosTimeline } from "@/features/fletes/presentacion";
import { getFleteDetalle } from "@/features/fletes/queries";
import { fotosHabilitadas } from "@/features/uploads/storage";
import { formatearHora } from "@/lib/formato";
import { requireRol } from "@/lib/session";

export const metadata: Metadata = { title: "Seguimiento del flete" };

export default async function SeguimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireRol("CLIENTE");
  const f = await getFleteDetalle(id, usuario);
  if (!f) notFound();

  const recibiendo = f.etapa === "ENTREGADO";
  const conInventarioMovido = f.resumen.cargados + f.resumen.noCargados > 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <FleteEnVivo fleteId={f.id} activo={esEtapaActiva(f.etapa)} />
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/cliente">
          <ArrowLeft aria-hidden="true" />
          Mis fletes
        </Link>
      </Button>

      <CabeceraFlete f={f} />

      {recibiendo ? (
        <Alert>
          <p>
            {f.contraparte} registró la entrega. Revisá cada ítem: confirmalo o abrí un reclamo si algo llegó
            mal. Después firmá la conformidad para cerrar el flete.
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

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-bold">Seguimiento</h2>
          </CardHeader>
          <CardContent>
            <TimelineEtapas pasos={pasosTimeline(f.pasos, f.cancelacion)} etiqueta="Etapas del flete" />
          </CardContent>
        </Card>
        <div className="grid content-start gap-2">
          <MapaSeguimiento origen={f.origen} destino={f.destino} ultimaUbicacion={f.ultimaUbicacion} />
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {f.ultimaUbicacion
              ? `Última ubicación que compartió ${f.contraparte}: a las ${formatearHora(f.ultimaUbicacion.fecha)}, al cambiar de etapa.`
              : "Vas a ver la ubicación del fletero cuando salga, si la comparte al cambiar de etapa."}
          </p>
        </div>
      </div>

      {conInventarioMovido ? <ResumenInventarioTiles resumen={f.resumen} /> : null}

      {recibiendo ? (
        <InventarioControl
          fleteId={f.id}
          fase="RECEPCION"
          items={f.items}
          fotosHabilitadas={fotosHabilitadas()}
        />
      ) : (
        <InventarioLectura
          items={f.items}
          titulo={esEtapaActiva(f.etapa) ? "Inventario en vivo" : "Inventario"}
        />
      )}

      <FirmasYComprobante f={f} />

      {f.etapa === "CERRADO" ? (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-bold">Calificación</h2>
          </CardHeader>
          <CardContent className="grid gap-2">
            {f.calificacion ? (
              <>
                <Estrellas puntaje={f.calificacion.puntaje} className="text-xl" />
                {f.calificacion.comentario ? <p>“{f.calificacion.comentario}”</p> : null}
              </>
            ) : (
              <FormCalificacion fleteId={f.id} fletero={f.contraparte} />
            )}
          </CardContent>
        </Card>
      ) : null}

      <DatosFlete f={f} conNavegacion={false} />
      <BotonChat f={f} />
      <CancelarFlete fleteId={f.id} etapa={f.etapa} rol="CLIENTE" resumen={f.resumen} />
      <AccionEtapa fleteId={f.id} etapa={f.etapa} rol="CLIENTE" resumen={f.resumen} />
    </div>
  );
}
