import { FileDown, MessagesSquare, Navigation, PenLine } from "lucide-react";
import Link from "next/link";
import { BloquePedido } from "@/components/shared/cabecera-pedido";
import { ContactoDirecto } from "@/components/shared/contacto-directo";
import { UbicacionLinea } from "@/components/shared/ubicacion-linea";
import { Button } from "@/components/ui/button";
import { hrefConversacion } from "@/features/chat/acceso-rutas";
import { formatearFechaHora, formatearPesos } from "@/lib/formato";
import type { FleteDetalle } from "../queries";
import { hrefComprobante } from "../rutas";

/** Abre la navegación en Google Maps (en el celular, en la app). */
const comoLlegar = ({ lat, lng }: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/**
 * La otra parte del flete: quién es, con qué vehículo y por cuánto, y cómo hablarle (WhatsApp o
 * teléfono con el flete confirmado, además del chat).
 */
export function TarjetaContraparte({ f }: { f: FleteDetalle }) {
  const esCliente = f.miRol === "CLIENTE";
  return (
    <section
      aria-label={esCliente ? "Tu fletero" : "El cliente"}
      className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-heading text-xl font-extrabold text-secondary-foreground"
        >
          {f.contraparte.charAt(0)}
        </span>
        <div className="grid min-w-0">
          <p className="text-sm text-muted-foreground">{esCliente ? "Tu fletero" : "Cliente"}</p>
          <p className="truncate text-lg font-bold">{f.contraparte}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-y py-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Precio acordado</dt>
          <dd className="font-heading text-xl font-extrabold tabular-nums">
            {formatearPesos(f.precioAcordado)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ayudantes</dt>
          <dd className="font-semibold">{f.ayudantes}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Vehículo</dt>
          <dd className="font-semibold">
            {f.vehiculo.marca} {f.vehiculo.modelo}
            <span className="font-normal text-muted-foreground"> · {f.vehiculo.patente}</span>
          </dd>
        </div>
      </dl>
      {f.etapa !== "CANCELADO" ? (
        <ContactoDirecto
          nombre={f.contraparte}
          telefono={f.telefonoContraparte}
          mensaje={`Hola, te escribo por el flete «${f.titulo}» de Fletes Tucumán.`}
        />
      ) : null}
      {f.conversacionId ? (
        <Button asChild variant="ghost" className="justify-self-start px-0 text-primary hover:bg-transparent">
          <Link href={hrefConversacion(f.miRol, f.solicitudId, f.fleteroId)}>
            <MessagesSquare aria-hidden="true" />
            Ver el chat del pedido
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

interface Lugar {
  direccion: string;
  piso: number | null;
  ascensor: boolean;
  lat: number;
  lng: number;
}

/** Origen y destino, con "Cómo llegar" para el fletero mientras el flete está en curso. */
export function RecorridoFlete({
  origen,
  destino,
  conNavegacion = false,
  children,
}: {
  origen: Lugar;
  destino: Lugar;
  conNavegacion?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section aria-label="Recorrido" className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm">
      {(
        [
          ["Retiro", "bg-primary", origen],
          ["Entrega", "bg-accent", destino],
        ] as const
      ).map(([etiqueta, color, lugar]) => (
        <div key={etiqueta} className="grid gap-2">
          <UbicacionLinea
            etiqueta={etiqueta}
            colorPunto={color}
            direccion={lugar.direccion}
            piso={lugar.piso}
            ascensor={lugar.ascensor}
          />
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
      {children}
    </section>
  );
}

/** Firmas de conformidad y comprobante PDF (disponible desde la entrega). */
export function FirmasYComprobante({ f }: { f: FleteDetalle }) {
  const conComprobante = f.etapa === "ENTREGADO" || f.etapa === "CERRADO";
  if (f.conformidades.length === 0 && !conComprobante) return null;
  return (
    <BloquePedido titulo="Conformidad">
      {f.conformidades.length > 0 ? (
        <ul className="grid gap-3">
          {f.conformidades.map((c) => (
            <li key={c.rol} className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
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
    </BloquePedido>
  );
}
