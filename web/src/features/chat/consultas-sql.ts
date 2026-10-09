// Consultas SQL del chat (no leídos contra la marca de lectura de cada fila, último mensaje
// con LATERAL). Los valores van en `params` ($1, $2…); el texto solo arma columnas fijas.

import type { EtapaFlete } from "@/domain/catalogos";

export type LadoBandeja = "CLIENTE" | "FLETERO";

export interface ConsultaSql {
  sql: string;
  params: unknown[];
}

// Columnas según el lado: identificadores fijos, nunca input del usuario.
const COLUMNAS: Record<LadoBandeja, { perfil: string; leidoHasta: string }> = {
  CLIENTE: { perfil: `c."clienteId"`, leidoHasta: `c."leidoHastaCliente"` },
  FLETERO: { perfil: `c."fleteroId"`, leidoHasta: `c."leidoHastaFletero"` },
};

export interface FilaBandeja {
  id: string;
  solicitudId: string;
  fleteroId: string;
  ultimaActividadEn: Date;
  titulo: string;
  solicitudEstado: "ABIERTA" | "ADJUDICADA" | "CANCELADA" | "VENCIDA";
  clienteNombre: string;
  clienteApellido: string;
  fleteroNombre: string;
  fleteroApellido: string;
  presupuestoEstado: "PENDIENTE" | "ACEPTADO" | "RECHAZADO" | "RETIRADO" | null;
  presupuestoValidoHasta: Date | null;
  /** Etapa del flete de ESTE par (null si no hay o es con otro fletero). */
  fleteEtapa: EtapaFlete | null;
  noLeidos: number;
  ultimoTipo: "TEXTO" | "IMAGEN" | "SISTEMA" | "PROPUESTA" | null;
  ultimoContenido: string | null;
  ultimoEvento: string | null;
  ultimoDatos: unknown;
  ultimoAutorId: string | null;
}

/** No leídos: mensajes posteriores a mi marca de lectura que no escribí yo (los de sistema cuentan). */
const noLeidos = (lado: LadoBandeja, userId: string) => `
  SELECT count(*)::int FROM mensajes m
  WHERE m."conversacionId" = c.id
    AND m."createdAt" > COALESCE(${COLUMNAS[lado].leidoHasta}, '-infinity'::timestamp)
    AND (m."autorId" IS NULL OR m."autorId" <> ${userId})`;

export function consultaBandeja(params: {
  lado: LadoBandeja;
  perfilId: string;
  userId: string;
  limite: number;
}): ConsultaSql {
  const { lado, perfilId, userId, limite } = params;
  return {
    params: [userId, perfilId, limite],
    sql: `
    SELECT
      c.id, c."solicitudId", c."fleteroId", c."ultimaActividadEn", s.titulo, s.estado::text AS "solicitudEstado",
      uc.nombre AS "clienteNombre", uc.apellido AS "clienteApellido",
      uf.nombre AS "fleteroNombre", uf.apellido AS "fleteroApellido",
      p.estado::text AS "presupuestoEstado", p."validoHasta" AS "presupuestoValidoHasta",
      CASE WHEN f."fleteroId" = c."fleteroId" THEN f.etapa::text END AS "fleteEtapa",
      (${noLeidos(lado, "$1")}) AS "noLeidos",
      um.tipo::text AS "ultimoTipo", um.contenido AS "ultimoContenido", um.evento AS "ultimoEvento",
      um.datos AS "ultimoDatos", um."autorId" AS "ultimoAutorId"
    FROM conversaciones c
    JOIN solicitudes s ON s.id = c."solicitudId"
    JOIN perfiles_cliente cp ON cp.id = c."clienteId"
    JOIN usuarios uc ON uc.id = cp."userId"
    JOIN perfiles_fletero fp ON fp.id = c."fleteroId"
    JOIN usuarios uf ON uf.id = fp."userId"
    LEFT JOIN presupuestos p ON p."solicitudId" = c."solicitudId" AND p."fleteroId" = c."fleteroId"
    LEFT JOIN fletes f ON f."solicitudId" = c."solicitudId"
    LEFT JOIN LATERAL (
      SELECT m.tipo, m.contenido, m.evento, m.datos, m."autorId"
      FROM mensajes m WHERE m."conversacionId" = c.id
      ORDER BY m."createdAt" DESC, m.id DESC LIMIT 1
    ) um ON true
    WHERE ${COLUMNAS[lado].perfil} = $2
    ORDER BY c."ultimaActividadEn" DESC, c.id DESC
    LIMIT $3`,
  };
}

export function consultaTotalNoLeidos(params: {
  lado: LadoBandeja;
  perfilId: string;
  userId: string;
}): ConsultaSql {
  const { lado, perfilId, userId } = params;
  return {
    params: [userId, perfilId],
    sql: `
    SELECT COALESCE(sum((${noLeidos(lado, "$1")})), 0)::int AS total
    FROM conversaciones c
    WHERE ${COLUMNAS[lado].perfil} = $2`,
  };
}
