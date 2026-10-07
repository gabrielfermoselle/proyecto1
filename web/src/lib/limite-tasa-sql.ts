// Limitador por ventana fija en Postgres: un upsert atómico por (clave, ventana). Sin Redis, y
// correcto con varias instancias serverless porque la base serializa el incremento de la fila.

import { Prisma } from "@prisma/client";

/** Comienzo de la ventana que contiene a `ahora` (alineada a múltiplos de `segundos`). */
export function inicioVentana(ahora: Date, segundos: number): Date {
  const ms = segundos * 1000;
  return new Date(Math.floor(ahora.getTime() / ms) * ms);
}

/** Suma 1 al contador de la ventana y devuelve el total (incluido este intento). */
export function consultaConsumir(clave: string, ventana: Date): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO limites_tasa (clave, ventana, cantidad)
    VALUES (${clave}, ${ventana.toISOString()}::timestamp, 1)
    ON CONFLICT (clave, ventana) DO UPDATE SET cantidad = limites_tasa.cantidad + 1
    RETURNING cantidad`;
}

export function consultaLimpiar(antesDe: Date): Prisma.Sql {
  return Prisma.sql`DELETE FROM limites_tasa WHERE ventana < ${antesDe.toISOString()}::timestamp`;
}
