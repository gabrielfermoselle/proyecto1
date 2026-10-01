// Precio sugerido de un flete a partir de las tarifas del fletero. Es una sugerencia:
// el fletero la puede editar antes de enviar el presupuesto.

import { FACTOR_RUTA_URBANA } from "./geo";

export interface Tarifas {
  precioMinimo: number;
  precioPorKm: number;
  precioPorM3: number;
  precioPorAyudante: number;
}

export interface Trayecto {
  /** Distancia en línea recta origen → destino (la que se guarda en la solicitud). */
  distanciaLinealKm: number;
  volumenM3: number;
  ayudantes: number;
}

/** Los precios se redondean a $100 para que sean presupuestos "de persona", no de calculadora. */
export const REDONDEO_PESOS = 100;

const redondearPesos = (monto: number) => Math.round(monto / REDONDEO_PESOS) * REDONDEO_PESOS;

/**
 * max(mínimo, km de ruta × $/km + m³ × $/m³) + ayudantes × $/ayudante.
 * El mínimo cubre la salida del fletero; los ayudantes se suman siempre aparte.
 */
export function precioSugerido(trayecto: Trayecto, tarifas: Tarifas): number {
  const { distanciaLinealKm, volumenM3, ayudantes } = trayecto;
  if (distanciaLinealKm < 0 || volumenM3 < 0 || !Number.isInteger(ayudantes) || ayudantes < 0) {
    throw new RangeError("Trayecto inválido");
  }
  if (Object.values(tarifas).some((valor) => !Number.isFinite(valor) || valor < 0)) {
    throw new RangeError("Tarifas inválidas");
  }

  const kmRuta = distanciaLinealKm * FACTOR_RUTA_URBANA;
  const porRecorrido = kmRuta * tarifas.precioPorKm + volumenM3 * tarifas.precioPorM3;
  const base = Math.max(tarifas.precioMinimo, porRecorrido);
  return redondearPesos(base + ayudantes * tarifas.precioPorAyudante);
}
