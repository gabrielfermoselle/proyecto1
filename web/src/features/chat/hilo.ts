// Lógica pura del hilo de mensajes en el navegador. Los mensajes llegan por cuatro caminos
// (envío optimista, respuesta de la acción, aviso en vivo, consulta periódica): acá se
// concilian sin duplicados y en orden.

import { fechaIsoAr } from "@/domain/fechas";
import type { MensajeDto } from "./dto";

export interface MensajeVista extends MensajeDto {
  /** Solo en mensajes propios todavía no confirmados por el servidor. */
  envio?: "enviando" | "error";
  /** Foto local (object URL) mientras se sube. */
  previewLocal?: string;
  /** Foto original, para reintentar el envío si falló. */
  archivoLocal?: File;
}

const ordenar = (a: MensajeVista, b: MensajeVista) =>
  a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id);

/**
 * Agrega o reemplaza mensajes. Un mensaje del servidor reemplaza a su versión optimista (mismo
 * clientId) y a sí mismo (mismo id). Una propuesta nueva anula a las pendientes anteriores.
 */
export function fusionarMensajes(actuales: MensajeVista[], nuevos: MensajeVista[]): MensajeVista[] {
  if (nuevos.length === 0) return actuales;
  const porId = new Map(actuales.map((m) => [m.id, m]));
  for (const nuevo of nuevos) {
    if (nuevo.clientId) {
      for (const [id, m] of porId) {
        if (m.envio && m.clientId === nuevo.clientId && id !== nuevo.id) porId.delete(id);
      }
    }
    const previo = porId.get(nuevo.id);
    // No pisar una versión confirmada con una optimista que llegó tarde.
    if (previo && !previo.envio && nuevo.envio) continue;
    const { envio: _envio, previewLocal: _preview, ...confirmado } = { ...previo, ...nuevo };
    porId.set(nuevo.id, nuevo.envio ? { ...previo, ...nuevo } : confirmado);
  }
  const resultado = [...porId.values()].sort(ordenar);
  return anularPropuestasReemplazadas(resultado);
}

/** Solo la última propuesta puede quedar pendiente (el servidor ya anuló las anteriores). */
export function anularPropuestasReemplazadas(mensajes: MensajeVista[]): MensajeVista[] {
  let ultimaPropuesta = -1;
  mensajes.forEach((m, i) => {
    if (m.propuesta && !m.envio) ultimaPropuesta = i;
  });
  return mensajes.map((m, i) =>
    m.propuesta?.estado === "PENDIENTE" && i < ultimaPropuesta
      ? { ...m, propuesta: { ...m.propuesta, estado: "ANULADA" } }
      : m,
  );
}

export function actualizarPropuesta(
  mensajes: MensajeVista[],
  propuestaId: string,
  estado: NonNullable<MensajeDto["propuesta"]>["estado"],
): MensajeVista[] {
  return mensajes.map((m) =>
    m.propuesta?.id === propuestaId ? { ...m, propuesta: { ...m.propuesta, estado } } : m,
  );
}

/** Último mensaje confirmado (para pedir "lo nuevo desde acá"). */
export function ultimoConfirmado(mensajes: MensajeVista[]): MensajeVista | undefined {
  return mensajes.findLast((m) => !m.envio);
}

/** Agrupa por día de calendario en Tucumán, para los separadores fijos. */
export function agruparPorDia(mensajes: MensajeVista[]): { dia: string; mensajes: MensajeVista[] }[] {
  const grupos: { dia: string; mensajes: MensajeVista[] }[] = [];
  for (const m of mensajes) {
    const dia = fechaIsoAr(new Date(m.creadoEn));
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.mensajes.push(m);
    else grupos.push({ dia, mensajes: [m] });
  }
  return grupos;
}
