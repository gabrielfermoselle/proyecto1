import { ArrowLeft, CalendarDays, MessagesSquare, Navigation } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Estrellas } from "@/components/shared/estrellas";
import { EtapasFlete } from "@/components/shared/etapas-flete";
import { UbicacionLinea } from "@/components/shared/ubicacion-linea";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ETIQUETA_ETAPA, FRANJA } from "@/domain/catalogos";
import { GestionFlete } from "@/features/fleteros/fletes/components/gestion-flete";
import { getFleteParaFletero } from "@/features/fleteros/fletes/queries";
import { formatearDia, formatearFechaHora, formatearPesos } from "@/lib/formato";
import { requireFletero } from "@/lib/session";

export const metadata: Metadata = { title: "Flete" };

/** Abre la navegación en Google Maps (en el celular, en la app). */
const comoLlegar = ({ lat, lng }: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default async function FletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { fleteroId } = await requireFletero();
  const f = await getFleteParaFletero(fleteroId, id);
  if (!f) notFound();

  const cancelacion = f.historial.find((h) => h.etapa === "CANCELADO");

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Button asChild variant="ghost" size="sm" className="justify-self-start">
        <Link href="/fletero/agenda">
          <ArrowLeft aria-hidden="true" />
          Agenda
        </Link>
      </Button>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              f.etapa === "CANCELADO" ? "destructive" : f.etapa === "COMPLETADO" ? "success" : "default"
            }
          >
            {ETIQUETA_ETAPA[f.etapa]}
          </Badge>
          <span className="text-sm text-muted-foreground">para {f.cliente}</span>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{f.titulo}</h1>
        <p className="flex items-center gap-2 font-semibold">
          <CalendarDays className="size-5 text-primary" aria-hidden="true" />
          {formatearDia(f.fecha, { largo: true })} · {FRANJA[f.franja].etiqueta}
        </p>
        <EtapasFlete etapa={f.etapa} />
      </header>

      {f.etapa === "ENTREGADO" ? (
        <Alert>
          <p>Entregaste todo. Falta que el cliente confirme la recepción; ahí el flete queda completado.</p>
        </Alert>
      ) : null}
      {cancelacion ? (
        <Alert variant="destructive">
          <p>
            Flete cancelado {cancelacion.porCliente ? "por el cliente" : "por vos"} el{" "}
            {formatearFechaHora(cancelacion.fecha)}
            {cancelacion.nota ? `: “${cancelacion.nota}”` : "."}
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <UbicacionLinea etiqueta="Retirar en" colorPunto="bg-primary" {...f.origen} />
              <Button asChild variant="outline" size="sm" className="justify-self-start">
                <a href={comoLlegar(f.origen)} target="_blank" rel="noreferrer">
                  <Navigation aria-hidden="true" />
                  Cómo llegar
                </a>
              </Button>
            </div>
            <div className="grid gap-2">
              <UbicacionLinea etiqueta="Entregar en" colorPunto="bg-accent" {...f.destino} />
              <Button asChild variant="outline" size="sm" className="justify-self-start">
                <a href={comoLlegar(f.destino)} target="_blank" rel="noreferrer">
                  <Navigation aria-hidden="true" />
                  Cómo llegar
                </a>
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Precio acordado</dt>
              <dd className="font-heading text-lg font-extrabold">{formatearPesos(f.precioAcordado)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vehículo</dt>
              <dd className="font-semibold">
                {f.vehiculo.marca} {f.vehiculo.modelo}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ayudantes</dt>
              <dd className="font-semibold">{f.ayudantes}</dd>
            </div>
          </dl>
          {f.descripcion ? (
            <p className="whitespace-pre-line border-t pt-4 text-sm">{f.descripcion}</p>
          ) : null}
        </CardContent>
      </Card>

      {f.conversacionId ? (
        <Button asChild variant="secondary" className="justify-self-start">
          <Link href={`/fletero/mensajes/${f.conversacionId}`}>
            <MessagesSquare aria-hidden="true" />
            Chat con {f.cliente}
          </Link>
        </Button>
      ) : null}

      <GestionFlete fleteId={f.id} etapa={f.etapa} items={f.items} />

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
          Historial
        </h2>
        <ol className="grid gap-3 border-l-2 pl-4">
          {f.historial.map((h) => (
            <li key={h.id} className="relative">
              <span
                className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              <p className="font-semibold">{ETIQUETA_ETAPA[h.etapa]}</p>
              <p className="text-sm text-muted-foreground">
                {formatearFechaHora(h.fecha)} · {h.porCliente ? "cliente" : "vos"}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
