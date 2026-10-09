// Limitador por ventana fija en Postgres: un upsert atómico por (clave, ventana). Sin Redis, y
// correcto con varias instancias serverless porque la base serializa el incremento de la fila.
// La app lo llama por RPC. Los tests de SQL corren estas sentencias directo contra Postgres.

export interface ConsultaSql {
  sql: string;
  params: unknown[];
}

/** Comienzo de la ventana que contiene a `ahora` (alineada a múltiplos de `segundos`). */
export function inicioVentana(ahora: Date, segundos: number): Date {
  const ms = segundos * 1000;
  return new Date(Math.floor(ahora.getTime() / ms) * ms);
}

/** Suma 1 al contador de la ventana y devuelve el total (incluido este intento). */
export function consultaConsumir(clave: string, ventana: Date): ConsultaSql {
  return {
    sql: `INSERT INTO limites_tasa (clave, ventana, cantidad)
      VALUES ($1, $2::timestamp, 1)
      ON CONFLICT (clave, ventana) DO UPDATE SET cantidad = limites_tasa.cantidad + 1
      RETURNING cantidad`,
    params: [clave, ventana.toISOString()],
  };
}

export function consultaLimpiar(antesDe: Date): ConsultaSql {
  return {
    sql: `DELETE FROM limites_tasa WHERE ventana < $1::timestamp`,
    params: [antesDe.toISOString()],
  };
}

/** Suma 1 al contador de la ventana y devuelve el total (incluido este intento). */
export async function consumirVentana(clave: string, ventana: Date): Promise<number> {
  const { db, fallar } = await import("./db");
  const { data, error } = await db().rpc("consumir_limite", {
    p_clave: clave,
    p_ventana: ventana.toISOString(),
  });
  fallar(error);
  return Number(data ?? 0);
}

export async function limpiarVentanasViejas(antesDe: Date): Promise<void> {
  const { db, fallar } = await import("./db");
  const { error } = await db().from("limites_tasa").delete().lt("ventana", antesDe.toISOString());
  fallar(error);
}
