// Reglas de la solicitud del cliente y de la comparación de presupuestos. Puro y testeado.

import { sumarDias } from "./fechas";
import { haversineKm, type Coordenadas } from "./geo";

/** Se puede pedir un flete desde hoy hasta dentro de 60 días. */
export const DIAS_MAXIMOS_ANTICIPACION = 60;
/** Origen y destino tienen que estar a más de 50 m: si no, es la misma dirección. */
export const DISTANCIA_MINIMA_KM = 0.05;
export const MAXIMO_ITEMS = 40;
export const MAXIMO_FOTOS_SOLICITUD = 12;

export function fechaPermitida(fechaIso: string, hoy: string): boolean {
  return fechaIso >= hoy && fechaIso <= sumarDias(hoy, DIAS_MAXIMOS_ANTICIPACION);
}

export function trayectoValido(origen: Coordenadas, destino: Coordenadas): boolean {
  return haversineKm(origen, destino) > DISTANCIA_MINIMA_KM;
}

/** Solo una solicitud abierta (sin flete) se puede cancelar o editar sus fotos. */
export const esSolicitudEditable = (estado: string) => estado === "ABIERTA";

// ---------------------------------------------------------------------------
// Comparación de presupuestos
// ---------------------------------------------------------------------------

export interface PresupuestoComparable {
  id: string;
  monto: number;
  validoHasta: Date;
  /** Promedio de calificaciones del fletero (null si todavía no tiene). */
  rating: number | null;
  calificaciones: number;
  fletesCompletados: number;
}

export type CriterioOrden = "precio" | "calificacion" | "vencimiento";

/** Con pocas reseñas el promedio engaña: se pondera hacia 3,5 (promedio bayesiano). */
const PRIOR_RATING = 3.5;
const PESO_PRIOR = 3;

export function ratingPonderado(p: Pick<PresupuestoComparable, "rating" | "calificaciones">): number {
  const suma = (p.rating ?? 0) * p.calificaciones;
  return (suma + PRIOR_RATING * PESO_PRIOR) / (p.calificaciones + PESO_PRIOR);
}

export function ordenarPresupuestos<T extends PresupuestoComparable>(
  lista: readonly T[],
  criterio: CriterioOrden,
): T[] {
  const desempate = (a: T, b: T) => a.monto - b.monto || a.id.localeCompare(b.id);
  const comparar: Record<CriterioOrden, (a: T, b: T) => number> = {
    precio: desempate,
    calificacion: (a, b) => ratingPonderado(b) - ratingPonderado(a) || desempate(a, b),
    vencimiento: (a, b) => a.validoHasta.getTime() - b.validoHasta.getTime() || desempate(a, b),
  };
  return [...lista].sort(comparar[criterio]);
}

/** Qué presupuesto destacar: el más barato y el del fletero mejor calificado (si hay más de uno). */
export function destacados(lista: readonly PresupuestoComparable[]): {
  masBarato: string | null;
  mejorCalificado: string | null;
} {
  if (lista.length < 2) return { masBarato: null, mejorCalificado: null };
  const masBarato = ordenarPresupuestos(lista, "precio")[0]!;
  const conResenas = lista.filter((p) => p.calificaciones > 0);
  const mejor = conResenas.length > 0 ? ordenarPresupuestos(conResenas, "calificacion")[0]! : null;
  return { masBarato: masBarato.id, mejorCalificado: mejor?.id ?? null };
}
