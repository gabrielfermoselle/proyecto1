// Catálogo de eventos que generan mensajes de sistema en el chat. En la base se guarda el
// código y los datos; el texto se arma al mostrarlo, así los mensajes viejos se siguen viendo
// bien aunque cambie la redacción.

import { z } from "zod";
import { FRANJA, FRANJAS_HORARIAS } from "@/domain/catalogos";
import { formatearDiaAbsoluto, formatearFechaHora, formatearPesos } from "@/lib/formato";

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const franja = z.enum(FRANJAS_HORARIAS);
const vacio = z.object({});

export const ESQUEMAS_EVENTO = {
  PRESUPUESTO_ENVIADO: z.object({ monto: z.number().positive(), validoHasta: z.string().datetime() }),
  PRESUPUESTO_RETIRADO: vacio,
  PRESUPUESTO_NO_ELEGIDO: vacio,
  FLETE_CONFIRMADO: z.object({ monto: z.number().positive(), fecha: fechaIso, franja }),
  CARGA_REGISTRADA: vacio,
  EN_VIAJE: vacio,
  DESCARGA_REGISTRADA: vacio,
  RECEPCION_CONFIRMADA: vacio,
  FLETE_CANCELADO: z.object({ motivo: z.string().max(300), por: z.enum(["CLIENTE", "FLETERO"]) }),
  FECHA_ACORDADA: z.object({ fecha: fechaIso, franja, aplicada: z.boolean() }),
  SOLICITUD_CANCELADA: vacio,
} as const;

export type EventoChat = keyof typeof ESQUEMAS_EVENTO;
export type DatosEvento<E extends EventoChat> = z.infer<(typeof ESQUEMAS_EVENTO)[E]>;

const cuando = (fecha: string, f: z.infer<typeof franja>) =>
  `${formatearDiaAbsoluto(fecha)}, ${FRANJA[f].etiqueta.toLowerCase()}`;

const TEXTOS: { [E in EventoChat]: (d: DatosEvento<E>) => string } = {
  PRESUPUESTO_ENVIADO: (d) =>
    `Presupuesto enviado: ${formatearPesos(d.monto)} · vale hasta el ${formatearFechaHora(new Date(d.validoHasta))}`,
  PRESUPUESTO_RETIRADO: () => "El fletero retiró su presupuesto.",
  PRESUPUESTO_NO_ELEGIDO: () => "El cliente eligió otro presupuesto. La conversación quedó cerrada.",
  FLETE_CONFIRMADO: (d) =>
    `Flete confirmado por ${formatearPesos(d.monto)} para el ${cuando(d.fecha, d.franja)}.`,
  CARGA_REGISTRADA: () => "Carga registrada: el fletero cargó todo lo de la lista.",
  EN_VIAJE: () => "El fletero salió hacia el destino.",
  DESCARGA_REGISTRADA: () => "Descarga registrada. Falta que el cliente confirme la recepción.",
  RECEPCION_CONFIRMADA: () => "El cliente confirmó la recepción. ¡Flete completado!",
  FLETE_CANCELADO: (d) =>
    `Flete cancelado por ${d.por === "CLIENTE" ? "el cliente" : "el fletero"}: «${d.motivo}». El chat quedó bloqueado.`,
  FECHA_ACORDADA: (d) =>
    d.aplicada
      ? `Nueva fecha acordada: ${cuando(d.fecha, d.franja)}.`
      : `Fecha acordada: ${cuando(d.fecha, d.franja)}. Se aplica si el cliente elige este presupuesto.`,
  SOLICITUD_CANCELADA: () => "El cliente canceló la solicitud.",
};

export function esEventoChat(valor: string): valor is EventoChat {
  return valor in ESQUEMAS_EVENTO;
}

/** Texto del mensaje de sistema. Si el evento o los datos no son válidos, un texto genérico. */
export function textoEvento(evento: string | null, datos: unknown): string {
  if (!evento || !esEventoChat(evento)) return "Actualización del flete.";
  const parsed = ESQUEMAS_EVENTO[evento].safeParse(datos ?? {});
  if (!parsed.success) return "Actualización del flete.";
  return (TEXTOS[evento] as (d: unknown) => string)(parsed.data);
}
