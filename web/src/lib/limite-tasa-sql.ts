// Limitador por ventana fija en Postgres: un upsert atómico por (clave, ventana). Sin Redis, y
// correcto con varias instancias serverless porque la base serializa el incremento de la fila.

import { db, fallar } from "./db";

/** Comienzo de la ventana que contiene a `ahora` (alineada a múltiplos de `segundos`). */
export function inicioVentana(ahora: Date, segundos: number): Date {
  const ms = segundos * 1000;
  return new Date(Math.floor(ahora.getTime() / ms) * ms);
}

/** Suma 1 al contador de la ventana y devuelve el total (incluido este intento). */
export async function consumirVentana(clave: string, ventana: Date): Promise<number> {
  const { data, error } = await db().rpc("consumir_limite", {
    p_clave: clave,
    p_ventana: ventana.toISOString(),
  });
  fallar(error);
  return Number(data ?? 0);
}

export async function limpiarVentanasViejas(antesDe: Date): Promise<void> {
  const { error } = await db().from("limites_tasa").delete().lt("ventana", antesDe.toISOString());
  fallar(error);
}
