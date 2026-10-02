import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Estrellas } from "@/components/shared/estrellas";
import { TimelineEtapas } from "@/components/shared/timeline/timeline-etapas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ACTOR_DE_FASE, esEtapaActiva, FASE_DE_ETAPA } from "@/domain/ciclo-flete";
import { AccionEtapa } from "@/features/fletes/components/accion-etapa";
import { CancelarFlete } from "@/features/fletes/components/cancelar-flete";
import { FleteEnVivo } from "@/features/fletes/components/flete-en-vivo";
import { InventarioControl } from "@/features/fletes/components/inventario-control";
import { InventarioLectura, ResumenInventarioTiles } from "@/features/fletes/components/inventario-lectura";
import {
  BotonChat,
  CabeceraFlete,
  DatosFlete,
  FirmasYComprobante,
} from "@/features/fletes/components/secciones";
import { pasosTimeline } from "@/features/fletes/presentacion";
import { getFleteDetalle } from "@/features/fletes/queries";
import { fotosHabilitadas } from "@/features/uploads/storage";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Flete" };

export default async function FletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { usuario } = await requireFletero();
  const f = await getFleteDetalle(id, usuario);
  if (!f) notFound();

  const fase = FASE_DE_ETAPA[f.etapa];
  // En carga y descarga el inventario es lo primero: es lo que el fletero está haciendo.
  const controlando = fase && ACTOR_DE_FASE[fase] === "FLETERO" ? fase : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <FleteEnVivo fleteId={f.id} activo={esEtapaActiva(f.etapa)} />
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/fletero/agenda">
          <ArrowLeft aria-hidden="true" />
          Agenda
        </Link>
      </Button>

      <CabeceraFlete f={f} />

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

      <DatosFlete f={f} conNavegacion={esEtapaActiva(f.etapa)} />
      <BotonChat f={f} />

      {!controlando && f.resumen.cargados + f.resumen.noCargados > 0 ? (
        <section aria-label="Resumen del inventario" className="grid gap-3">
          <ResumenInventarioTiles resumen={f.resumen} />
        </section>
      ) : null}
      {!controlando ? <InventarioLectura items={f.items} /> : null}

      <FirmasYComprobante f={f} />

      {f.calificacion ? (
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-bold">Calificación del cliente</h2>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Estrellas puntaje={f.calificacion.puntaje} className="text-xl" />
            {f.calificacion.comentario ? <p>“{f.calificacion.comentario}”</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="titulo-historial" className="grid gap-3">
        <h2 id="titulo-historial" className="text-lg font-bold">
          Seguimiento
        </h2>
        <TimelineEtapas pasos={pasosTimeline(f.pasos, f.cancelacion)} etiqueta="Etapas del flete" />
      </section>

      <CancelarFlete fleteId={f.id} etapa={f.etapa} rol="FLETERO" resumen={f.resumen} />
      <AccionEtapa fleteId={f.id} etapa={f.etapa} rol="FLETERO" resumen={f.resumen} />
    </div>
  );
}
