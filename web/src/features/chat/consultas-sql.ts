// Consultas SQL del chat que Prisma no expresa bien (no leídos contra la marca de lectura de cada
// fila, último mensaje con LATERAL). Parametrizadas y sin conexión: el test las corre con PGlite.

import { Prisma, type EtapaFlete } from "@prisma/client";

export type LadoBandeja = "CLIENTE" | "FLETERO";

// Columnas según el lado: fragmentos fijos, nunca input del usuario.
const COLUMNAS: Record<LadoBandeja, { perfil: Prisma.Sql; leidoHasta: Prisma.Sql }> = {
  CLIENTE: { perfil: Prisma.sql`c."clienteId"`, leidoHasta: Prisma.sql`c."leidoHastaCliente"` },
  FLETERO: { perfil: Prisma.sql`c."fleteroId"`, leidoHasta: Prisma.sql`c."leidoHastaFletero"` },
};

export interface FilaBandeja {
  id: string;
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
const noLeidos = (lado: LadoBandeja, userId: string) => Prisma.sql`
  SELECT count(*)::int FROM mensajes m
  WHERE m."conversacionId" = c.id
    AND m."createdAt" > COALESCE(${COLUMNAS[lado].leidoHasta}, '-infinity'::timestamp)
    AND (m."autorId" IS NULL OR m."autorId" <> ${userId})`;

export function consultaBandeja(params: {
  lado: LadoBandeja;
  perfilId: string;
  userId: string;
  limite: number;
}): Prisma.Sql {
  const { lado, perfilId, userId, limite } = params;
  return Prisma.sql`
    SELECT
      c.id, c."ultimaActividadEn", s.titulo, s.estado::text AS "solicitudEstado",
      uc.nombre AS "clienteNombre", uc.apellido AS "clienteApellido",
      uf.nombre AS "fleteroNombre", uf.apellido AS "fleteroApellido",
      p.estado::text AS "presupuestoEstado", p."validoHasta" AS "presupuestoValidoHasta",
      CASE WHEN f."fleteroId" = c."fleteroId" THEN f.etapa::text END AS "fleteEtapa",
      (${noLeidos(lado, userId)}) AS "noLeidos",
      um.tipo::text AS "ultimoTipo", um.contenido AS "ultimoContenido", um.evento AS "ultimoEvento",
      um.datos AS "ultimoDatos", um."autorId" AS "ultimoAutorId"
    FROM conversaciones c
    JOIN solicitudes s ON s.id = c."solicitudId"
    JOIN cliente_profiles cp ON cp.id = c."clienteId"
    JOIN users uc ON uc.id = cp."userId"
    JOIN fletero_profiles fp ON fp.id = c."fleteroId"
    JOIN users uf ON uf.id = fp."userId"
    LEFT JOIN presupuestos p ON p."solicitudId" = c."solicitudId" AND p."fleteroId" = c."fleteroId"
    LEFT JOIN fletes f ON f."solicitudId" = c."solicitudId"
    LEFT JOIN LATERAL (
      SELECT m.tipo, m.contenido, m.evento, m.datos, m."autorId"
      FROM mensajes m WHERE m."conversacionId" = c.id
      ORDER BY m."createdAt" DESC, m.id DESC LIMIT 1
    ) um ON true
    WHERE ${COLUMNAS[lado].perfil} = ${perfilId}
    ORDER BY c."ultimaActividadEn" DESC, c.id DESC
    LIMIT ${limite}`;
}

export function consultaTotalNoLeidos(params: {
  lado: LadoBandeja;
  perfilId: string;
  userId: string;
}): Prisma.Sql {
  const { lado, perfilId, userId } = params;
  return Prisma.sql`
    SELECT COALESCE(sum((${noLeidos(lado, userId)})), 0)::int AS total
    FROM conversaciones c
    WHERE ${COLUMNAS[lado].perfil} = ${perfilId}`;
}
