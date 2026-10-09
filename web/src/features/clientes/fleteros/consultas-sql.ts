// Consulta SQL del buscador de fleteros del cliente. Los valores van en `params` ($1, $2, …)
// y no se concatenan al texto. ORDER BY es un fragmento fijo elegido por `orden`.

import type { Coordenadas } from "@/domain/geo";

export type OrdenBuscador = "distancia" | "calificacion" | "experiencia" | "precio";

/** "zona": solo los fleteros cuyo radio de cobertura llega al punto. Un número: km desde el punto. */
export type RadioBuscador = "zona" | number | null;

/** Carga de una solicitud de referencia: habilita el precio estimado y la compatibilidad. */
export interface CargaReferencia {
  distanciaKm: number;
  pesoTotalKg: number;
  volumenTotalM3: number;
  ayudantes: number;
}

export interface ParametrosBuscador {
  punto: Coordenadas | null;
  radio: RadioBuscador;
  tipoVehiculo: string | null;
  soloDisponibles: boolean;
  /** Tope para el precio mínimo (la "bajada de bandera") del fletero. */
  precioMaximo: number | null;
  ratingMinimo: number | null;
  carga: CargaReferencia | null;
  orden: OrdenBuscador;
  /** Multiplicador de línea recta a recorrido (domain/geo FACTOR_RUTA_URBANA). */
  factorRuta: number;
  limite: number;
}

export interface FilaBuscador {
  id: string;
  distanciaKm: number | null;
  radioCoberturaKm: number;
  precioMinimo: number;
  precioPorKm: number;
  precioPorM3: number;
  precioPorAyudante: number;
}

interface Fragmento {
  sql: string;
  params: unknown[];
}

function frag(sql: string, ...params: unknown[]): Fragmento {
  return { sql, params };
}

/** Une texto fijo y fragmentos. Los `$n` de cada fragmento se renumeran según el orden. */
function pegar(piezas: readonly (string | Fragmento)[]): Fragmento {
  let sql = "";
  const params: unknown[] = [];
  for (const pieza of piezas) {
    if (typeof pieza === "string") {
      sql += pieza;
      continue;
    }
    const base = params.length;
    sql += pieza.sql.replace(/\$(\d+)/g, (_, n: string) => `$${base + Number(n)}`);
    params.push(...pieza.params);
  }
  return { sql, params };
}

function y(condiciones: Fragmento[]): Fragmento {
  return pegar(condiciones.flatMap((condicion, i) => (i === 0 ? [condicion] : [" AND ", condicion])));
}

/**
 * Precio estimado en SQL, solo para ORDENAR: la misma fórmula que `domain/precio` sin el
 * redondeo a $100. El monto que se muestra se calcula con el dominio.
 */
function precioEstimado(c: CargaReferencia, factorRuta: number): Fragmento {
  return frag(
    `(GREATEST(f."precioMinimo",
      $1::float8 * $2::float8 * f."precioPorKm" + $3::float8 * f."precioPorM3")
    + $4::int * f."precioPorAyudante")`,
    c.distanciaKm,
    factorRuta,
    c.volumenTotalM3,
    c.ayudantes,
  );
}

// El ORDER BY no admite parámetros de orden: se elige entre fragmentos fijos (el precio lleva
// sus números como $n). El id al final hace el orden estable.
function ordenar(p: ParametrosBuscador): Fragmento {
  const desempate = frag(`f.id ASC`);
  const calificacion = frag(`f."ratingPromedio" DESC, f."cantidadCalificaciones" DESC`);
  const lista = (...partes: Fragmento[]) =>
    pegar(partes.flatMap((parte, i) => (i === 0 ? [parte] : [", ", parte])));
  switch (p.orden) {
    case "distancia":
      return p.punto
        ? lista(frag(`"distanciaKm" ASC`), calificacion, desempate)
        : lista(calificacion, desempate);
    case "precio":
      return p.carga
        ? lista(precioEstimado(p.carga, p.factorRuta), calificacion, desempate)
        : lista(frag(`f."precioMinimo" ASC`), calificacion, desempate);
    case "experiencia":
      return frag(`f."cantidadCalificaciones" DESC, f."ratingPromedio" DESC, f.id ASC`);
    case "calificacion":
      return lista(calificacion, desempate);
  }
}

function puntoGeo(punto: Coordenadas): Fragmento {
  return frag(`ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography`, punto.lng, punto.lat);
}

function existeVehiculo(p: ParametrosBuscador): Fragmento {
  const piezas: (string | Fragmento)[] = [
    `EXISTS (
      SELECT 1 FROM vehiculos v
      WHERE v."fleteroId" = f.id AND v.activo`,
  ];
  if (p.tipoVehiculo) piezas.push(frag(` AND v.tipo::text = $1`, p.tipoVehiculo));
  if (p.carga) {
    piezas.push(
      frag(
        ` AND v."capacidadKg" >= $1::float8 AND v."volumenM3" >= $2::float8`,
        p.carga.pesoTotalKg,
        p.carga.volumenTotalM3,
      ),
    );
  }
  piezas.push(`)`);
  return pegar(piezas);
}

/**
 * Fleteros visibles para el cliente: onboarding completo y cuenta activa, con al menos un
 * vehículo activo que cumpla el tipo pedido y, si hay solicitud de referencia, en el que entre
 * la carga (mismo criterio que `domain/compatibilidad` y el feed del fletero).
 * La cercanía usa ST_DWithin sobre el índice GIST de "baseGeo".
 */
export function consultaBuscador(p: ParametrosBuscador): { sql: string; params: unknown[] } {
  const punto = p.punto ? puntoGeo(p.punto) : null;

  const condiciones: Fragmento[] = [
    frag(`f."onboardingCompletadoEn" IS NOT NULL`),
    frag(`u.activo`),
    existeVehiculo(p),
  ];
  if (p.soloDisponibles) condiciones.push(frag(`f.disponible`));
  if (p.precioMaximo !== null) condiciones.push(frag(`f."precioMinimo" <= $1::float8`, p.precioMaximo));
  if (p.ratingMinimo !== null) {
    condiciones.push(
      frag(`f."cantidadCalificaciones" > 0 AND f."ratingPromedio" >= $1::float8`, p.ratingMinimo),
    );
  }
  if (punto) {
    condiciones.push(frag(`f."baseGeo" IS NOT NULL`));
    if (p.radio === "zona") {
      condiciones.push(pegar([`ST_DWithin(f."baseGeo", `, punto, `, f."radioCoberturaKm" * 1000)`]));
    } else if (typeof p.radio === "number") {
      condiciones.push(
        pegar([`ST_DWithin(f."baseGeo", `, punto, `, `, frag(`$1::float8`, p.radio * 1000), `)`]),
      );
    }
  }

  const distancia = punto
    ? pegar([`(ST_Distance(f."baseGeo", `, punto, `) / 1000)::float8`])
    : frag(`NULL::float8`);

  return pegar([
    `
    SELECT
      f.id,
      `,
    distancia,
    ` AS "distanciaKm",
      f."radioCoberturaKm",
      f."precioMinimo"::float8 AS "precioMinimo",
      f."precioPorKm"::float8 AS "precioPorKm",
      f."precioPorM3"::float8 AS "precioPorM3",
      f."precioPorAyudante"::float8 AS "precioPorAyudante"
    FROM perfiles_fletero f
    JOIN usuarios u ON u.id = f."userId"
    WHERE `,
    y(condiciones),
    `
    ORDER BY `,
    ordenar(p),
    `
    LIMIT `,
    frag(`$1`, p.limite),
  ]);
}
