// Consulta SQL del buscador de fleteros del cliente. Se arma con `Prisma.sql` (parametrizada, sin
// concatenar input) y no depende de la conexión: el test de integración la corre contra PGlite +
// PostGIS y la app con `prisma.$queryRaw`.

import { Prisma } from "@prisma/client";
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

/**
 * Precio estimado en SQL, solo para ORDENAR: la misma fórmula que `domain/precio` sin el
 * redondeo a $100. El monto que se muestra se calcula con el dominio.
 */
function precioEstimado(c: CargaReferencia, factorRuta: number): Prisma.Sql {
  return Prisma.sql`(GREATEST(f."precioMinimo",
      ${c.distanciaKm}::float8 * ${factorRuta}::float8 * f."precioPorKm" + ${c.volumenTotalM3}::float8 * f."precioPorM3")
    + ${c.ayudantes}::int * f."precioPorAyudante")`;
}

// El ORDER BY no admite parámetros: se elige entre fragmentos fijos (y el precio con parámetros
// tipados), nunca input del usuario. El id al final hace el orden estable.
function ordenar(p: ParametrosBuscador): Prisma.Sql {
  const desempate = Prisma.sql`f.id ASC`;
  const calificacion = Prisma.sql`f."ratingPromedio" DESC, f."cantidadCalificaciones" DESC`;
  switch (p.orden) {
    case "distancia":
      return p.punto
        ? Prisma.sql`"distanciaKm" ASC, ${calificacion}, ${desempate}`
        : Prisma.sql`${calificacion}, ${desempate}`;
    case "precio":
      return p.carga
        ? Prisma.sql`${precioEstimado(p.carga, p.factorRuta)} ASC, ${calificacion}, ${desempate}`
        : Prisma.sql`f."precioMinimo" ASC, ${calificacion}, ${desempate}`;
    case "experiencia":
      return Prisma.sql`f."cantidadCalificaciones" DESC, f."ratingPromedio" DESC, ${desempate}`;
    case "calificacion":
      return Prisma.sql`${calificacion}, ${desempate}`;
  }
}

/**
 * Fleteros visibles para el cliente: onboarding completo y cuenta activa, con al menos un
 * vehículo activo que cumpla el tipo pedido y, si hay solicitud de referencia, en el que entre
 * la carga (mismo criterio que `domain/compatibilidad` y el feed del fletero).
 * La cercanía usa ST_DWithin sobre el índice GIST de "baseGeo".
 */
export function consultaBuscador(p: ParametrosBuscador): Prisma.Sql {
  const punto = p.punto
    ? Prisma.sql`ST_SetSRID(ST_MakePoint(${p.punto.lng}::float8, ${p.punto.lat}::float8), 4326)::geography`
    : null;

  const condiciones: Prisma.Sql[] = [
    Prisma.sql`f."onboardingCompletadoEn" IS NOT NULL`,
    Prisma.sql`u.activo`,
    Prisma.sql`EXISTS (
      SELECT 1 FROM vehiculos v
      WHERE v."fleteroId" = f.id AND v.activo
        ${p.tipoVehiculo ? Prisma.sql`AND v.tipo::text = ${p.tipoVehiculo}` : Prisma.empty}
        ${
          p.carga
            ? Prisma.sql`AND v."capacidadKg" >= ${p.carga.pesoTotalKg}::float8
                         AND v."volumenM3" >= ${p.carga.volumenTotalM3}::float8`
            : Prisma.empty
        }
    )`,
  ];
  if (p.soloDisponibles) condiciones.push(Prisma.sql`f.disponible`);
  if (p.precioMaximo !== null) condiciones.push(Prisma.sql`f."precioMinimo" <= ${p.precioMaximo}::float8`);
  if (p.ratingMinimo !== null) {
    condiciones.push(
      Prisma.sql`f."cantidadCalificaciones" > 0 AND f."ratingPromedio" >= ${p.ratingMinimo}::float8`,
    );
  }
  if (punto) {
    condiciones.push(Prisma.sql`f."baseGeo" IS NOT NULL`);
    if (p.radio === "zona") {
      condiciones.push(Prisma.sql`ST_DWithin(f."baseGeo", ${punto}, f."radioCoberturaKm" * 1000)`);
    } else if (typeof p.radio === "number") {
      condiciones.push(Prisma.sql`ST_DWithin(f."baseGeo", ${punto}, ${p.radio * 1000}::float8)`);
    }
  }

  return Prisma.sql`
    SELECT
      f.id,
      ${punto ? Prisma.sql`(ST_Distance(f."baseGeo", ${punto}) / 1000)::float8` : Prisma.sql`NULL::float8`} AS "distanciaKm",
      f."radioCoberturaKm",
      f."precioMinimo"::float8 AS "precioMinimo",
      f."precioPorKm"::float8 AS "precioPorKm",
      f."precioPorM3"::float8 AS "precioPorM3",
      f."precioPorAyudante"::float8 AS "precioPorAyudante"
    FROM fletero_profiles f
    JOIN users u ON u.id = f."userId"
    WHERE ${Prisma.join(condiciones, " AND ")}
    ORDER BY ${ordenar(p)}
    LIMIT ${p.limite}`;
}
