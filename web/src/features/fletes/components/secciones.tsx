import { CalendarDays, FileDown, MessagesSquare, Navigation, PenLine } from "lucide-react";
import Link from "next/link";
import { ProgresoEtapas } from "@/components/shared/timeline/progreso-etapas";
import { UbicacionLinea } from "@/components/shared/ubicacion-linea";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ETIQUETA_ETAPA, FRANJA, type EtapaFlete } from "@/domain/catalogos";
import { formatearDia, formatearFechaHora, formatearPesos } from "@/lib/formato";
import { pasosDelFlete } from "../presentacion";
import type { FleteDetalle } from "../queries";
import { hrefComprobante } from "../rutas";

const VARIANTE_ETAPA: Partial<Record<EtapaFlete, BadgeVariant>> = {
  CANCELADO: "destructive",
  CERRADO: "success",
  CONFIRMADO: "outline",
};

/** Abre la navegación en Google Maps (en el celular, en la app). */
const comoLlegar = ({ lat, lng }: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export function CabeceraFlete({ f }: { f: FleteDetalle }) {
  return (
    <header className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VARIANTE_ETAPA[f.etapa] ?? "default"}>{ETIQUETA_ETAPA[f.etapa]}</Badge>
        <span className="text-sm text-muted-foreground">
          {f.miRol === "FLETERO" ? "para" : "con"} {f.contraparte}
        </span>
      </div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{f.titulo}</h1>
      <p className="flex items-center gap-2 font-semibold">
        <CalendarDays className="size-5 text-primary" aria-hidden="true" />
        {formatearDia(f.fecha, { largo: true })} · {FRANJA[f.franja].etiqueta}
      </p>
      {f.etapa !== "CANCELADO" ? (
        <ProgresoEtapas pasos={pasosDelFlete(f.pasos)} etiqueta="Etapas del flete" />
      ) : null}
    </header>
  );
}

/** Origen y destino (con "Cómo llegar" para el fletero), precio, vehículo y ayudantes. */
export function DatosFlete({ f, conNavegacion }: { f: FleteDetalle; conNavegacion: boolean }) {
  return (
    <Card>
      <CardContent className="grid gap-4 pt-5 sm:pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Retirar en", "bg-primary", f.origen],
              ["Entregar en", "bg-accent", f.destino],
            ] as const
          ).map(([etiqueta, color, lugar]) => (
            <div key={etiqueta} className="grid gap-2">
              <UbicacionLinea etiqueta={etiqueta} colorPunto={color} {...lugar} />
              {conNavegacion ? (
                <Button asChild variant="outline" size="sm" className="justify-self-start">
                  <a href={comoLlegar(lugar)} target="_blank" rel="noreferrer">
                    <Navigation aria-hidden="true" />
                    Cómo llegar
                  </a>
                </Button>
              ) : null}
            </div>
          ))}
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
        {f.descripcion ? <p className="whitespace-pre-line border-t pt-4 text-sm">{f.descripcion}</p> : null}
      </CardContent>
    </Card>
  );
}

export function BotonChat({ f }: { f: FleteDetalle }) {
  if (!f.conversacionId) return null;
  return (
    <Button asChild variant="secondary" className="justify-self-start">
      <Link href={`/${f.miRol === "CLIENTE" ? "cliente" : "fletero"}/mensajes/${f.conversacionId}`}>
        <MessagesSquare aria-hidden="true" />
        Chat con {f.contraparte}
      </Link>
    </Button>
  );
}

/** Firmas de conformidad y comprobante PDF (disponible desde la entrega). */
export function FirmasYComprobante({ f }: { f: FleteDetalle }) {
  const conComprobante = f.etapa === "ENTREGADO" || f.etapa === "CERRADO";
  if (f.conformidades.length === 0 && !conComprobante) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-lg font-bold">Conformidad</h2>
      </CardHeader>
      <CardContent className="grid gap-4">
        {f.conformidades.length > 0 ? (
          <ul className="grid gap-3">
            {f.conformidades.map((c) => (
              <li key={c.rol} className="grid gap-1 rounded-md border bg-muted/30 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <PenLine className="size-4 text-success" aria-hidden="true" />
                  {c.rol === "FLETERO" ? "Fletero" : "Cliente"}: {c.nombre}
                  <time dateTime={c.aceptadaEn.toISOString()} className="font-normal text-muted-foreground">
                    {formatearFechaHora(c.aceptadaEn)}
                  </time>
                </p>
                <p>{c.texto}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {conComprobante ? (
          <Button asChild variant="outline" className="justify-self-start">
            <a href={hrefComprobante(f.id)} download>
              <FileDown aria-hidden="true" />
              Descargar comprobante{f.etapa === "CERRADO" ? "" : " provisorio"} (PDF)
            </a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
