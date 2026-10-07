// Catálogo de eventos que generan mensajes de sistema en el chat. En la base se guarda el
// código y los datos; el texto se arma al mostrarlo, así los mensajes viejos se siguen viendo
// bien aunque cambie la redacción.

import { z } from "zod";
import { FRANJA, FRANJAS_HORARIAS } from "@/domain/catalogos";
import { formatearDiaAbsoluto, formatearFechaHora, formatearPesos } from "@/lib/formato";

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const franja = z.enum(FRANJAS_HORARIAS);
const vacio = z.object({});
const cantidad = z.number().int().min(0);

export const ESQUEMAS_EVENTO = {
  PRESUPUESTO_ENVIADO: z.object({ monto: z.number().positive(), validoHasta: z.string().datetime() }),
  PRESUPUESTO_RETIRADO: vacio,
  PRESUPUESTO_NO_ELEGIDO: vacio,
  FLETE_CONFIRMADO: z.object({ monto: z.number().positive(), fecha: fechaIso, franja }),
  EN_CAMINO_A_ORIGEN: vacio,
  LLEGADA_ORIGEN: vacio,
  // Los conteos son opcionales: los mensajes anteriores al inventario digital no los tienen.
  CARGA_REGISTRADA: z.object({
    cargados: cantidad.optional(),
    noCargados: cantidad.optional(),
    conObservacion: cantidad.optional(),
  }),
  LLEGADA_DESTINO: vacio,
  DESCARGA_REGISTRADA: z.object({
    entregados: cantidad.optional(),
    conDano: cantidad.optional(),
    faltantes: cantidad.optional(),
  }),
  RECLAMO_ABIERTO: z.object({ item: z.string().max(80) }),
  FLETE_CERRADO: z.object({ reclamos: cantidad }),
  /** Anteriores al inventario digital: se siguen mostrando. */
  EN_VIAJE: vacio,
  RECEPCION_CONFIRMADA: vacio,
  FLETE_CANCELADO: z.object({ motivo: z.string().max(300), por: z.enum(["CLIENTE", "FLETERO"]) }),
  FECHA_ACORDADA: z.object({ fecha: fechaIso, franja, aplicada: z.boolean() }),
  SOLICITUD_CANCELADA: vacio,
} as const;

export type EventoChat = keyof typeof ESQUEMAS_EVENTO;
export type DatosEvento<E extends EventoChat> = z.infer<(typeof ESQUEMAS_EVENTO)[E]>;

const cuando = (fecha: string, f: z.infer<typeof franja>) =>
  `${formatearDiaAbsoluto(fecha)}, ${FRANJA[f].etiqueta.toLowerCase()}`;

/** "1 ítem" / "3 ítems", con el adjetivo concordado ("1 ítem faltante", "2 ítems faltantes"). */
const items = (n: number, adjetivo = "", adjetivoPlural = adjetivo) =>
  `${n} ${n === 1 ? "ítem" : "ítems"}${adjetivo ? ` ${n === 1 ? adjetivo : adjetivoPlural}` : ""}`;
const seVerbo = (n: number, singular: string, plural: string) =>
  `se ${n === 1 ? singular : plural} ${items(n)}`;

const TEXTOS: { [E in EventoChat]: (d: DatosEvento<E>) => string } = {
  PRESUPUESTO_ENVIADO: (d) =>
    `Presupuesto enviado: ${formatearPesos(d.monto)} · vale hasta el ${formatearFechaHora(new Date(d.validoHasta))}`,
  PRESUPUESTO_RETIRADO: () => "El fletero retiró su presupuesto.",
  PRESUPUESTO_NO_ELEGIDO: () => "El cliente eligió otro presupuesto. La conversación quedó cerrada.",
  FLETE_CONFIRMADO: (d) =>
    `Flete confirmado por ${formatearPesos(d.monto)} para el ${cuando(d.fecha, d.franja)}.`,
  EN_CAMINO_A_ORIGEN: () => "El fletero salió a buscar la carga.",
  LLEGADA_ORIGEN: () => "El fletero llegó al origen y empezó a cargar.",
  CARGA_REGISTRADA: (d) => {
    if (d.cargados === undefined) return "Carga registrada: el fletero cargó todo lo de la lista.";
    const detalles = [
      d.noCargados ? items(d.noCargados, "sin cargar") : null,
      d.conObservacion ? items(d.conObservacion, "con observaciones") : null,
    ].filter(Boolean);
    return `Carga registrada: ${seVerbo(d.cargados, "cargó", "cargaron")}${detalles.length ? ` (${detalles.join(", ")})` : ""}. El fletero salió hacia el destino.`;
  },
  LLEGADA_DESTINO: () => "El fletero llegó al destino y empezó a descargar.",
  DESCARGA_REGISTRADA: (d) => {
    if (d.entregados === undefined) return "Descarga registrada. Falta que el cliente confirme la recepción.";
    const problemas = [
      d.conDano ? items(d.conDano, "con daño") : null,
      d.faltantes ? items(d.faltantes, "faltante", "faltantes") : null,
    ].filter(Boolean);
    return `Descarga registrada: ${seVerbo(d.entregados, "entregó", "entregaron")}${problemas.length ? `, ${problemas.join(" y ")}` : ""}. Falta que el cliente revise y confirme la recepción.`;
  },
  RECLAMO_ABIERTO: (d) => `El cliente abrió un reclamo por «${d.item}».`,
  FLETE_CERRADO: (d) =>
    `El cliente confirmó la recepción y cerró el flete.${d.reclamos ? ` Quedó registrado ${d.reclamos === 1 ? "1 reclamo" : `${d.reclamos} reclamos`}.` : ""}`,
  EN_VIAJE: () => "El fletero salió hacia el destino.",
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
