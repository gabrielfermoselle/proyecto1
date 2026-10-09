// Reglas del presupuesto que envía el fletero.

import { finDelDiaAr } from "./fechas";

export const VALIDECES = ["24h", "48h", "7d"] as const;
export type Validez = (typeof VALIDECES)[number];

const HORAS: Record<Validez, number> = { "24h": 24, "48h": 48, "7d": 168 };

export const ETIQUETA_VALIDEZ: Record<Validez, string> = {
  "24h": "24 horas",
  "48h": "48 horas",
  "7d": "7 días",
};

/** Vence a las `validez` horas, pero nunca después del día del flete. */
export function calcularValidoHasta(validez: Validez, fechaFlete: string, ahora: Date = new Date()): Date {
  const porPlazo = ahora.getTime() + HORAS[validez] * 60 * 60 * 1000;
  return new Date(Math.min(porPlazo, finDelDiaAr(fechaFlete).getTime()));
}

/** Por debajo del 60 % del sugerido se avisa: suele ser un error de tipeo (un cero de menos). */
export const UMBRAL_PRECIO_BAJO = 0.6;

export function esPrecioMuyBajo(monto: number, sugerido: number): boolean {
  return sugerido > 0 && monto < sugerido * UMBRAL_PRECIO_BAJO;
}

export function estaVencido(validoHasta: Date, ahora: Date = new Date()): boolean {
  return validoHasta.getTime() < ahora.getTime();
}

/** "HH:MM" de 00:00 a 23:59. */
export const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** La hora de llegada tiene que caer dentro de la franja que pidió el cliente (bordes incluidos). */
export function horaEnFranja(hora: string, franja: { desde: number; hasta: number }): boolean {
  if (!FORMATO_HORA.test(hora)) return false;
  const [h, m] = hora.split(":").map(Number) as [number, number];
  const minutos = h * 60 + m;
  return minutos >= franja.desde * 60 && minutos <= franja.hasta * 60;
}
