// Formatos para mostrar (es-AR). Sin dependencias de servidor: se usa en componentes cliente.

import { diaDesdeIso, fechaIsoAr, sumarDias } from "@/domain/fechas";

const ZONA = "America/Argentina/Tucuman";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const decimal1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const decimal2 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const diaCorto = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const diaLargo = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
// En Argentina se usa el reloj de 24 h; el ICU de es-AR, según la versión, usa "p. m.".
const fechaHora = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZONA,
});
const fechaCorta = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONA,
});
const mesAnio = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });

export const formatearPesos = (monto: number) => pesos.format(monto);
export const formatearKg = (kg: number) => `${entero.format(kg)} kg`;
export const formatearM3 = (m3: number) => `${decimal2.format(m3)} m³`;
export const formatearPorcentaje = (fraccion: number) => `${entero.format(fraccion * 100)} %`;
export const formatearRating = (rating: number) => decimal1.format(rating);

export function formatearKm(km: number): string {
  return km < 1 ? `${entero.format(Math.round(km * 1000))} m` : `${decimal1.format(km)} km`;
}

/** "Hoy", "Mañana", "Ayer" o "jue, 2 oct" para una fecha ISO de calendario. */
export function formatearDia(fechaIso: string, { largo = false, hoy = fechaIsoAr() } = {}): string {
  if (fechaIso === hoy) return "Hoy";
  if (fechaIso === sumarDias(hoy, 1)) return "Mañana";
  if (fechaIso === sumarDias(hoy, -1)) return "Ayer";
  const texto = (largo ? diaLargo : diaCorto).format(diaDesdeIso(fechaIso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const formatearFechaHora = (instante: Date) => fechaHora.format(instante);
export const formatearFecha = (instante: Date) => fechaCorta.format(instante);

/** "oct" para una clave YYYY-MM. */
export const formatearMes = (mes: string) => mesAnio.format(new Date(`${mes}-01T00:00:00Z`)).replace(".", "");

/** "Ana P.": nombre e inicial, para mostrar a la otra parte sin exponer el apellido completo. */
export function nombrePublico(nombre: string, apellido: string): string {
  return apellido ? `${nombre} ${apellido.charAt(0)}.` : nombre;
}

/** "jue 9 oct": fecha absoluta, para textos que quedan guardados (no envejece como "Mañana"). */
export function formatearDiaAbsoluto(fechaIso: string): string {
  return diaCorto.format(diaDesdeIso(fechaIso)).replace(/\./g, "");
}

const hora = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZONA,
});
export const formatearHora = (instante: Date) => hora.format(instante);
