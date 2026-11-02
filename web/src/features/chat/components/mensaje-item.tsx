"use client";

import { AlertCircle, CalendarClock, Check, CheckCheck, Clock3, Info, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FRANJA } from "@/domain/catalogos";
import { estaLeido, segmentarTexto } from "@/domain/chat";
import { formatearDiaAbsoluto, formatearHora } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { RolChat } from "../dto";
import type { MensajeVista } from "../hilo";

/** Texto plano con los links http(s) como enlaces seguros. React escapa todo lo demás. */
function TextoConLinks({ texto }: { texto: string }) {
  return (
    <>
      {segmentarTexto(texto).map((s, i) =>
        s.tipo === "link" ? (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="nofollow noopener noreferrer ugc"
            className="underline underline-offset-2"
          >
            {s.valor}
          </a>
        ) : (
          <span key={i}>{s.valor}</span>
        ),
      )}
    </>
  );
}

function EstadoEnvio({ mensaje, leidoHastaOtro }: { mensaje: MensajeVista; leidoHastaOtro: string | null }) {
  if (mensaje.envio === "enviando") {
    return (
      <span title="Enviando" className="inline-flex">
        <Clock3 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Enviando</span>
      </span>
    );
  }
  if (mensaje.envio === "error") {
    return (
      <span className="inline-flex text-destructive">
        <AlertCircle className="size-3.5" aria-hidden="true" />
        <span className="sr-only">No se envió</span>
      </span>
    );
  }
  const leido = estaLeido(new Date(mensaje.creadoEn), leidoHastaOtro ? new Date(leidoHastaOtro) : null);
  return leido ? (
    <span title="Leído" className="inline-flex text-accent">
      <CheckCheck className="size-4" aria-hidden="true" />
      <span className="sr-only">Leído</span>
    </span>
  ) : (
    <span title="Enviado" className="inline-flex">
      <Check className="size-4" aria-hidden="true" />
      <span className="sr-only">Enviado</span>
    </span>
  );
}

export function MensajeSistema({ mensaje }: { mensaje: MensajeVista }) {
  return (
    <li className="flex justify-center px-2 py-1">
      <p className="flex max-w-md items-start gap-2 rounded-lg bg-secondary/10 px-3 py-2 text-center text-sm text-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
        <span>
          {mensaje.texto}
          <span className="ml-2 text-xs text-foreground/70">{formatearHora(new Date(mensaje.creadoEn))}</span>
        </span>
      </p>
    </li>
  );
}

interface BurbujaProps {
  mensaje: MensajeVista;
  miRol: RolChat;
  leidoHastaOtro: string | null;
  onReintentar: (mensaje: MensajeVista) => void;
  children?: React.ReactNode;
}

export function Burbuja({ mensaje, miRol, leidoHastaOtro, onReintentar, children }: BurbujaProps) {
  const propio = mensaje.autorRol === miRol;
  const hora = formatearHora(new Date(mensaje.creadoEn));
  return (
    <li className={cn("flex px-2 py-0.5", propio ? "justify-end" : "justify-start")}>
      <div className={cn("grid max-w-[85%] gap-1 sm:max-w-[70%]", propio && "justify-items-end")}>
        <div
          className={cn(
            "overflow-hidden rounded-2xl px-3 py-2 shadow-sm",
            propio ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card",
            mensaje.envio === "enviando" && "opacity-80",
          )}
        >
          {children}
          {mensaje.texto ? (
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              <TextoConLinks texto={mensaje.texto} />
            </p>
          ) : null}
          <p
            className={cn(
              "mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums",
              propio ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            <time dateTime={mensaje.creadoEn}>{hora}</time>
            {propio ? <EstadoEnvio mensaje={mensaje} leidoHastaOtro={leidoHastaOtro} /> : null}
          </p>
        </div>
        {mensaje.envio === "error" ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto px-1 text-destructive"
            onClick={() => onReintentar(mensaje)}
          >
            <RotateCcw aria-hidden="true" />
            No se envió. Reintentar
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function FotosMensaje({ mensaje }: { mensaje: MensajeVista }) {
  const fuentes = mensaje.previewLocal
    ? [{ id: "local", url: mensaje.previewLocal, ancho: null, alto: null }]
    : mensaje.fotos;
  if (fuentes.length === 0) return null;
  return (
    <div className="-mx-3 -mt-2 mb-1">
      {fuentes.map((f) => (
        <a
          key={f.id}
          href={f.url}
          target="_blank"
          rel="noreferrer"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* URLs firmadas que vencen: <img> simple, sin el optimizador de imágenes. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.url}
            alt={mensaje.texto ? `Foto: ${mensaje.texto}` : "Foto enviada en el chat"}
            width={f.ancho ?? undefined}
            height={f.alto ?? undefined}
            loading="lazy"
            className="max-h-80 w-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}

const ESTADO_PROPUESTA = {
  PENDIENTE: { texto: "Esperando respuesta", variante: "warning" },
  ACEPTADA: { texto: "Aceptada", variante: "success" },
  RECHAZADA: { texto: "No aceptada", variante: "muted" },
  ANULADA: { texto: "Reemplazada", variante: "muted" },
} as const;

interface TarjetaPropuestaProps {
  mensaje: MensajeVista;
  miRol: RolChat;
  puedeResponder: boolean;
  conflictos: string[] | undefined;
  onResponder: (propuestaId: string, aceptar: boolean) => void;
}

export function TarjetaPropuesta({
  mensaje,
  miRol,
  puedeResponder,
  conflictos,
  onResponder,
}: TarjetaPropuestaProps) {
  const p = mensaje.propuesta;
  if (!p) return null;
  const propia = p.propuestaPorRol === miRol;
  const estado = ESTADO_PROPUESTA[p.estado];
  const respondible = !propia && p.estado === "PENDIENTE" && puedeResponder && !mensaje.envio;
  return (
    <li className={cn("flex px-2 py-1", propia ? "justify-end" : "justify-start")}>
      <div className="grid w-full max-w-xs gap-3 rounded-2xl border-2 border-accent/60 bg-card p-3 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <CalendarClock className="size-4 text-accent-foreground" aria-hidden="true" />
          {propia ? "Propusiste otra fecha" : "Te propone otra fecha"}
        </p>
        <p className="font-heading text-lg font-extrabold leading-tight">
          {formatearDiaAbsoluto(p.fecha)}
          <span className="block text-base font-semibold">{FRANJA[p.franja].etiqueta}</span>
        </p>
        {conflictos && conflictos.length > 0 && !propia ? (
          <p className="flex items-start gap-1.5 text-sm font-medium text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Ese día ya tenés: {conflictos.join(", ")}
          </p>
        ) : null}
        {respondible ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onResponder(p.id, false)}>
              Rechazar
            </Button>
            <Button onClick={() => onResponder(p.id, true)}>Aceptar</Button>
          </div>
        ) : (
          <Badge variant={estado.variante} className="justify-self-start">
            {estado.texto}
          </Badge>
        )}
        <time dateTime={mensaje.creadoEn} className="justify-self-end text-[11px] text-muted-foreground">
          {formatearHora(new Date(mensaje.creadoEn))}
        </time>
      </div>
    </li>
  );
}
