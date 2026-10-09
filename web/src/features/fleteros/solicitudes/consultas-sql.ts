// Consultas SQL del feed del fletero. Se arman con `Prisma.sql` (parametrizadas, sin
// concatenar input) y no dependen de la conexión: el test de integración las corre contra
// PGlite + PostGIS y la app con `prisma.$queryRaw`.

import { Prisma } from "@prisma/client";

export type TabFeed = "nuevas" | "presupuestadas";
export type OrdenFeed = "distancia" | "fecha";

/** Filtros opcionales del feed: más cerca que el radio, un rango de días o un tipo. */
export interface FiltrosFeed {
  /** Distancia máxima del origen a la base (dentro del radio de cobertura). */
  maxKm?: number | null;
  /** Rango de fechas ISO, inclusive. */
  desde?: string | null;
  hasta?: string | null;
  tipo?: string | null;
}

export interface ParametrosFeed {
  fleteroId: string;
  /** Fecha ISO de hoy en Tucumán: no se muestran solicitudes de días pasados. */
  hoy: string;
  tab: TabFeed;
  orden: OrdenFeed;
  limite: number;
  filtros?: FiltrosFeed;
}

/** Condiciones de los filtros: cada una es un fragmento parametrizado o nada. */
function condicionFiltros(f: FiltrosFeed = {}): Prisma.Sql {
  return Prisma.sql`
    ${f.maxKm ? Prisma.sql`AND ST_DWithin(s."origenGeo", f."baseGeo", ${f.maxKm * 1000})` : Prisma.empty}
    ${f.desde ? Prisma.sql`AND s.fecha >= ${f.desde}::date` : Prisma.empty}
    ${f.hasta ? Prisma.sql`AND s.fecha <= ${f.hasta}::date` : Prisma.empty}
    ${f.tipo ? Prisma.sql`AND s."tipoFlete"::text = ${f.tipo}` : Prisma.empty}`;
}

export interface FilaFeed {
  id: string;
  titulo: string;
  tipoFlete: string;
  fecha: string;
  franja: string;
  origenDireccion: string;
  origenLat: number;
  origenLng: number;
  destinoDireccion: string;
  distanciaKm: number;
  pesoTotalKg: number;
  volumenTotalM3: number;
  itemsSinMedidas: number;
  ayudantesRequeridos: number;
  requiereEmbalaje: boolean;
  distanciaBaseKm: number;
  cantidadItems: number;
  itemsFragiles: number;
  presupuestosRecibidos: number;
  miMonto: number | null;
}

// El ORDER BY no admite parámetros: se elige entre fragmentos fijos, nunca input del usuario.
const ORDEN: Record<OrdenFeed, Prisma.Sql> = {
  distancia: Prisma.sql`"distanciaBaseKm" ASC, s.fecha ASC, s.id ASC`,
  fecha: Prisma.sql`s.fecha ASC, "distanciaBaseKm" ASC, s.id ASC`,
};

/**
 * Condición del feed para las solicitudes nuevas:
 *  - ABIERTA y con fecha de hoy en adelante,
 *  - origen dentro del radio de cobertura (ST_DWithin sobre el índice GIST),
 *  - la carga entra en al menos un vehículo activo del fletero (mismo criterio que `domain/compatibilidad`),
 *  - el fletero todavía no la presupuestó.
 * En "presupuestadas" se muestran las que ya presupuestó, aunque después haya cambiado su zona o sus vehículos.
 */
function condicionTab(tab: TabFeed): Prisma.Sql {
  if (tab === "presupuestadas") return Prisma.sql`mp.id IS NOT NULL`;
  return Prisma.sql`
    mp.id IS NULL
    AND ST_DWithin(s."origenGeo", f."baseGeo", f."radioCoberturaKm" * 1000)
    AND EXISTS (
      SELECT 1 FROM vehiculos v
      WHERE v."fleteroId" = f.id AND v.activo
        AND v."capacidadKg" >= s."pesoTotalKg" AND v."volumenM3" >= s."volumenTotalM3"
    )`;
}

export function consultaFeed({ fleteroId, hoy, tab, orden, limite, filtros }: ParametrosFeed): Prisma.Sql {
  return Prisma.sql`
    SELECT
      s.id, s.titulo, s."tipoFlete"::text AS "tipoFlete",
      to_char(s.fecha, 'YYYY-MM-DD') AS fecha, s.franja::text AS franja,
      s."origenDireccion", s."origenLat", s."origenLng", s."destinoDireccion",
      s."distanciaKm"::float8 AS "distanciaKm",
      s."pesoTotalKg"::float8 AS "pesoTotalKg",
      s."volumenTotalM3"::float8 AS "volumenTotalM3",
      s."itemsSinMedidas", s."ayudantesRequeridos", s."requiereEmbalaje",
      (ST_Distance(s."origenGeo", f."baseGeo") / 1000)::float8 AS "distanciaBaseKm",
      (SELECT count(*)::int FROM items_inventario i WHERE i."solicitudId" = s.id) AS "cantidadItems",
      (SELECT count(*)::int FROM items_inventario i WHERE i."solicitudId" = s.id AND i.fragil) AS "itemsFragiles",
      (SELECT count(*)::int FROM presupuestos p WHERE p."solicitudId" = s.id AND p.estado = 'PENDIENTE') AS "presupuestosRecibidos",
      mp.monto::float8 AS "miMonto"
    FROM solicitudes s
    JOIN fletero_profiles f ON f.id = ${fleteroId}
    LEFT JOIN presupuestos mp ON mp."solicitudId" = s.id AND mp."fleteroId" = f.id
    WHERE s.estado = 'ABIERTA'
      AND s.fecha >= ${hoy}::date
      AND ${condicionTab(tab)}
      ${condicionFiltros(filtros)}
    ORDER BY ${ORDEN[orden]}
    LIMIT ${limite}`;
}

export function consultaConteosFeed({
  fleteroId,
  hoy,
}: Pick<ParametrosFeed, "fleteroId" | "hoy">): Prisma.Sql {
  return Prisma.sql`
    SELECT
      count(*) FILTER (WHERE ${condicionTab("nuevas")})::int AS nuevas,
      count(*) FILTER (WHERE ${condicionTab("presupuestadas")})::int AS presupuestadas
    FROM solicitudes s
    JOIN fletero_profiles f ON f.id = ${fleteroId}
    LEFT JOIN presupuestos mp ON mp."solicitudId" = s.id AND mp."fleteroId" = f.id
    WHERE s.estado = 'ABIERTA' AND s.fecha >= ${hoy}::date`;
}

/**
 * ¿Puede el fletero ver el detalle de esta solicitud? Sí si está en su feed (abierta, vigente
 * y dentro de su radio) o si ya tiene relación con ella (la presupuestó o es su flete).
 * La compatibilidad de carga no se exige acá: el detalle explica por qué no entra.
 */
export function consultaAccesoSolicitud(fleteroId: string, solicitudId: string, hoy: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      (ST_Distance(s."origenGeo", f."baseGeo") / 1000)::float8 AS "distanciaBaseKm",
      (
        (s.estado = 'ABIERTA' AND s.fecha >= ${hoy}::date
          AND ST_DWithin(s."origenGeo", f."baseGeo", f."radioCoberturaKm" * 1000))
        OR EXISTS (SELECT 1 FROM presupuestos p WHERE p."solicitudId" = s.id AND p."fleteroId" = f.id)
        OR EXISTS (SELECT 1 FROM fletes fl WHERE fl."solicitudId" = s.id AND fl."fleteroId" = f.id)
      ) AS permitido
    FROM solicitudes s
    JOIN fletero_profiles f ON f.id = ${fleteroId}
    WHERE s.id = ${solicitudId}`;
}
