// Reglas del chat entre cliente y fletero. Puro: lo usan las acciones, las queries y la UI.

import type { EstadoPresupuesto, EtapaFlete } from "./catalogos";
import { esEtapaActiva } from "./ciclo-flete";

// ---------------------------------------------------------------------------
// Estado de la conversación
// ---------------------------------------------------------------------------

export type EstadoConversacion =
  /** El fletero presupuestó y la solicitud sigue abierta: se negocia. */
  | "NEGOCIACION"
  /** Hay un flete de este par en curso: la conversación queda fijada arriba. */
  | "ACTIVA"
  /** Terminó la negociación (no fue elegido, retiró, venció) o el flete se completó: solo lectura. */
  | "CERRADA"
  /** El flete se canceló: solo lectura, con aviso explícito. */
  | "BLOQUEADA";

export interface DatosEstadoConversacion {
  solicitudEstado: "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA";
  /** Presupuesto del fletero de esta conversación, si existe. */
  presupuesto: { estado: EstadoPresupuesto; validoHasta: Date } | null;
  /** Flete entre este cliente y este fletero, si existe. */
  fleteEtapa: EtapaFlete | null;
}

export function estadoConversacion(d: DatosEstadoConversacion, ahora: Date = new Date()): EstadoConversacion {
  if (d.fleteEtapa === "CANCELADO") return "BLOQUEADA";
  if (d.fleteEtapa && esEtapaActiva(d.fleteEtapa)) return "ACTIVA";
  if (d.fleteEtapa === "CERRADO") return "CERRADA";
  const negociando =
    d.solicitudEstado === "ABIERTA" &&
    d.presupuesto?.estado === "PENDIENTE" &&
    d.presupuesto.validoHasta.getTime() >= ahora.getTime();
  return negociando ? "NEGOCIACION" : "CERRADA";
}

export function puedeEscribir(estado: EstadoConversacion): boolean {
  return estado === "NEGOCIACION" || estado === "ACTIVA";
}

/** Los datos de contacto se muestran solo cuando hay un flete acordado entre las partes. */
export function contactoVisible(fleteEtapa: EtapaFlete | null): boolean {
  return fleteEtapa !== null && fleteEtapa !== "CANCELADO";
}

/** Las propuestas de fecha solo cambian algo mientras se negocia o antes de cargar. */
export function admitePropuestas(estado: EstadoConversacion, fleteEtapa: EtapaFlete | null): boolean {
  return estado === "NEGOCIACION" || (estado === "ACTIVA" && fleteEtapa === "CONFIRMADO");
}

export function estaLeido(enviadoEn: Date, leidoHastaDelOtro: Date | null): boolean {
  return leidoHastaDelOtro !== null && enviadoEn.getTime() <= leidoHastaDelOtro.getTime();
}

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

export const LARGO_MAXIMO_MENSAJE = 2000;

// Controles (salvo \t y \n), marcas de dirección (permiten disfrazar texto, p. ej. U+202E) y
// caracteres de ancho cero. Se conserva U+200D (ZWJ): lo usan los emojis compuestos.
const INVISIBLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​‌‎‏‪-‮⁠⁦-⁩﻿]/g;

/**
 * Normaliza un mensaje de texto plano. Nunca se interpreta como HTML ni Markdown (React lo
 * escapa al mostrarlo); esto evita textos disfrazados, mensajes en blanco y paredes de saltos.
 */
export function sanitizarTexto(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLES, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const MARCA_CONTACTO_OCULTO = "[contacto oculto]";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/giu;
const WHATSAPP = /\b(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\/\S*/gi;
// Candidato a teléfono: dígitos con separadores habituales. Se confirma contando los dígitos.
const CANDIDATO_TELEFONO = /\+?\(?\d[\d\s().-]{5,}\d/g;
const MINIMO_DIGITOS_TELEFONO = 8;

/**
 * Oculta teléfonos, emails y links de WhatsApp. Se aplica al mostrar (no al guardar) mientras
 * no haya un flete acordado, para que la coordinación quede dentro de la plataforma.
 * Montos ("$30.000"), medidas ("180 x 70") y fechas no tienen 8 dígitos seguidos y no se tocan.
 */
export function ocultarContacto(texto: string): string {
  return texto
    .replace(WHATSAPP, MARCA_CONTACTO_OCULTO)
    .replace(EMAIL, MARCA_CONTACTO_OCULTO)
    .replace(CANDIDATO_TELEFONO, (candidato) =>
      candidato.replace(/\D/g, "").length >= MINIMO_DIGITOS_TELEFONO ? MARCA_CONTACTO_OCULTO : candidato,
    );
}

export type Segmento = { tipo: "texto"; valor: string } | { tipo: "link"; valor: string; href: string };

const LINK = /\bhttps?:\/\/[^\s<>"]+/gi;

/** Divide el texto en partes y links http(s), para mostrar los links como enlaces seguros. */
export function segmentarTexto(texto: string): Segmento[] {
  const segmentos: Segmento[] = [];
  let ultimo = 0;
  for (const coincidencia of texto.matchAll(LINK)) {
    // La puntuación final suele ser de la oración, no del link.
    const link = coincidencia[0].replace(/[.,;:!?)\]]+$/, "");
    const inicio = coincidencia.index;
    if (inicio > ultimo) segmentos.push({ tipo: "texto", valor: texto.slice(ultimo, inicio) });
    segmentos.push({ tipo: "link", valor: link, href: link });
    ultimo = inicio + link.length;
  }
  if (ultimo < texto.length) segmentos.push({ tipo: "texto", valor: texto.slice(ultimo) });
  return segmentos;
}
