import "server-only";
import type { EtapaFlete, FranjaHoraria, Prisma } from "@prisma/client";
import { conflictosCon } from "@/domain/agenda";
import {
  admitePropuestas,
  contactoVisible,
  estadoConversacion,
  ocultarContacto,
  type EstadoConversacion,
} from "@/domain/chat";
import { ETAPAS_ACTIVAS } from "@/domain/ciclo-flete";
import { fechaIsoDeDia } from "@/domain/fechas";
import { getTurnosActivos } from "@/features/fleteros/fletes/queries";
import { hrefPedido, topicFlete } from "@/features/fletes/rutas";
import { urlsFirmadas } from "@/features/uploads/storage";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import type { UsuarioActual } from "@/lib/session";
import { getContextoChat, hrefConversacion, perfilChat, type ContextoChat } from "./acceso";
import { consultaBandeja, consultaTotalNoLeidos, type FilaBandeja } from "./consultas-sql";
import type { Cursor } from "./cursor";
import { aMensajeDto, rutasDeFotos, SELECT_MENSAJE, type MensajeDto, type RolChat } from "./dto";
import { textoEvento } from "./eventos-catalogo";

export const MENSAJES_POR_PAGINA = 30;
const MAXIMO_NUEVOS = 100;

// ---------------------------------------------------------------------------
// Bandeja
// ---------------------------------------------------------------------------

export interface ConversacionBandeja {
  id: string;
  href: string;
  titulo: string;
  contraparte: string;
  estado: EstadoConversacion;
  /** La conversación con un flete en curso va arriba de todo. */
  fijada: boolean;
  noLeidos: number;
  ultimaActividadEn: string;
  vistaPrevia: string;
}

function vistaPrevia(f: FilaBandeja, userId: string): string {
  if (!f.ultimoTipo) return "Sin mensajes todavía";
  const propio = f.ultimoAutorId === userId ? "Vos: " : "";
  switch (f.ultimoTipo) {
    case "SISTEMA":
      return textoEvento(f.ultimoEvento, f.ultimoDatos);
    case "IMAGEN":
      return `${propio}📷 ${f.ultimoContenido ?? "Foto"}`;
    case "PROPUESTA":
      return `${propio}📅 Propuesta de fecha`;
    case "TEXTO": {
      const texto = f.ultimoContenido ?? "";
      return propio + (contactoVisible(f.fleteEtapa) ? texto : ocultarContacto(texto));
    }
  }
}

export async function getBandeja(usuario: UsuarioActual, limite = 50) {
  const perfil = perfilChat(usuario);
  if (!perfil) return { conversaciones: [], noLeidosTotal: 0 };
  const filas = await prisma.$queryRaw<FilaBandeja[]>(
    consultaBandeja({ lado: perfil.rol, perfilId: perfil.perfilId, userId: usuario.id, limite }),
  );
  const conversaciones: ConversacionBandeja[] = filas.map((f) => {
    const estado = estadoConversacion({
      solicitudEstado: f.solicitudEstado,
      presupuesto:
        f.presupuestoEstado && f.presupuestoValidoHasta
          ? { estado: f.presupuestoEstado, validoHasta: f.presupuestoValidoHasta }
          : null,
      fleteEtapa: f.fleteEtapa,
    });
    return {
      id: f.id,
      href: hrefConversacion(perfil.rol, f.solicitudId, f.fleteroId),
      titulo: f.titulo,
      contraparte:
        perfil.rol === "CLIENTE"
          ? nombrePublico(f.fleteroNombre, f.fleteroApellido)
          : nombrePublico(f.clienteNombre, f.clienteApellido),
      estado,
      fijada: estado === "ACTIVA",
      noLeidos: f.noLeidos,
      ultimaActividadEn: f.ultimaActividadEn.toISOString(),
      vistaPrevia: vistaPrevia(f, usuario.id),
    };
  });
  // Fijadas primero; dentro de cada grupo, por última actividad (ya viene ordenado).
  conversaciones.sort((a, b) => Number(b.fijada) - Number(a.fijada));
  return { conversaciones, noLeidosTotal: conversaciones.reduce((total, c) => total + c.noLeidos, 0) };
}

export async function contarNoLeidos(usuario: UsuarioActual): Promise<number> {
  const perfil = perfilChat(usuario);
  if (!perfil) return 0;
  const [fila] = await prisma.$queryRaw<{ total: number }[]>(
    consultaTotalNoLeidos({ lado: perfil.rol, perfilId: perfil.perfilId, userId: usuario.id }),
  );
  return fila?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Mensajes de una conversación (paginación por cursor)
// ---------------------------------------------------------------------------

const despuesDe = (c: Cursor): Prisma.MensajeWhereInput => ({
  OR: [{ createdAt: { gt: c.createdAt } }, { createdAt: c.createdAt, id: { gt: c.id } }],
});
const antesDe = (c: Cursor): Prisma.MensajeWhereInput => ({
  OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
});

/**
 * Sin cursores: la última página. Con `antes`: la página anterior (scroll hacia arriba).
 * Con `despues`: lo nuevo desde el último mensaje conocido (reconexión o consulta periódica).
 * Siempre en orden cronológico.
 */
export async function getMensajes(
  ctx: ContextoChat,
  cursores: { antes?: Cursor | null; despues?: Cursor | null } = {},
): Promise<{ mensajes: MensajeDto[]; hayMasAnteriores: boolean }> {
  const base: Prisma.MensajeWhereInput = { conversacionId: ctx.conversacionId };
  let crudos;
  let hayMasAnteriores = false;
  if (cursores.despues) {
    crudos = await prisma.mensaje.findMany({
      where: { ...base, ...despuesDe(cursores.despues) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: MAXIMO_NUEVOS,
      select: SELECT_MENSAJE,
    });
  } else {
    const pagina = await prisma.mensaje.findMany({
      where: { ...base, ...(cursores.antes ? antesDe(cursores.antes) : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MENSAJES_POR_PAGINA + 1,
      select: SELECT_MENSAJE,
    });
    hayMasAnteriores = pagina.length > MENSAJES_POR_PAGINA;
    crudos = pagina.slice(0, MENSAJES_POR_PAGINA).reverse();
  }
  const urls = await urlsFirmadas(rutasDeFotos(crudos));
  return { mensajes: crudos.map((m) => aMensajeDto(m, ctx.contactoVisible, urls)), hayMasAnteriores };
}

// ---------------------------------------------------------------------------
// Vista de una conversación
// ---------------------------------------------------------------------------

export interface MetaConversacion {
  id: string;
  titulo: string;
  miRol: RolChat;
  contraparte: string;
  estado: EstadoConversacion;
  puedeProponer: boolean;
  contactoVisible: boolean;
  leidoHastaOtro: string | null;
  fechaActual: { fecha: string; franja: FranjaHoraria };
  presupuesto: { id: string; monto: number; estado: string } | null;
  /** Flete de este par (si el cliente aceptó el presupuesto). */
  flete: { id: string; etapa: EtapaFlete } | null;
  /** En negociación: fecha aceptada en el chat, que se aplica si el cliente elige este presupuesto. */
  fechaAcordada: { fecha: string; franja: FranjaHoraria } | null;
  /** La página del pedido de cada parte (presupuestos o seguimiento del flete). */
  hrefDetalle: string;
  /** Para el fletero: propuestas pendientes que chocan con otro flete suyo (id → títulos). */
  conflictos: Record<string, string[]>;
}

export async function getMetaConversacion(ctx: ContextoChat): Promise<MetaConversacion> {
  const acordada =
    ctx.estado === "NEGOCIACION"
      ? await prisma.propuestaHorario.findFirst({
          where: { estado: "ACEPTADA", aplicadaEn: null, mensaje: { conversacionId: ctx.conversacionId } },
          orderBy: { respondidaEn: "desc" },
          select: { fecha: true, franja: true },
        })
      : null;
  let conflictos: Record<string, string[]> = {};
  if (ctx.miRol === "FLETERO") {
    const [pendientes, turnos] = await Promise.all([
      prisma.propuestaHorario.findMany({
        where: { estado: "PENDIENTE", mensaje: { conversacionId: ctx.conversacionId } },
        select: { id: true, fecha: true, franja: true },
      }),
      getTurnosActivos(ctx.fleteroId),
    ]);
    const otros = turnos.filter((t) => t.solicitudId !== ctx.solicitudId);
    conflictos = Object.fromEntries(
      pendientes
        .map(
          (p) =>
            [
              p.id,
              conflictosCon({ fecha: fechaIsoDeDia(p.fecha), franja: p.franja }, otros).map((t) => t.titulo),
            ] as const,
        )
        .filter(([, titulos]) => titulos.length > 0),
    );
  }
  return {
    id: ctx.conversacionId,
    titulo: ctx.titulo,
    miRol: ctx.miRol,
    contraparte: ctx.otro.nombre,
    estado: ctx.estado,
    puedeProponer: admitePropuestas(ctx.estado, ctx.fleteEtapa),
    contactoVisible: ctx.contactoVisible,
    leidoHastaOtro: ctx.leidoHastaOtro?.toISOString() ?? null,
    fechaActual: { fecha: ctx.solicitud.fecha, franja: ctx.solicitud.franja },
    presupuesto: ctx.presupuesto
      ? { id: ctx.presupuesto.id, monto: ctx.presupuesto.monto, estado: ctx.presupuesto.estado }
      : null,
    flete: ctx.fleteId && ctx.fleteEtapa ? { id: ctx.fleteId, etapa: ctx.fleteEtapa } : null,
    fechaAcordada: acordada ? { fecha: fechaIsoDeDia(acordada.fecha), franja: acordada.franja } : null,
    hrefDetalle: hrefPedido(ctx.miRol, ctx.solicitudId),
    conflictos,
  };
}

export async function getVistaConversacion(conversacionId: string, usuario: UsuarioActual) {
  const ctx = await getContextoChat(conversacionId, usuario);
  if (!ctx) return null;
  const [meta, pagina] = await Promise.all([getMetaConversacion(ctx), getMensajes(ctx)]);
  return { meta, ...pagina };
}

// ---------------------------------------------------------------------------
// Canales de Realtime autorizados
// ---------------------------------------------------------------------------

const MAXIMO_CANALES = 80;
const MAXIMO_FLETES = 20;

/** Canal personal, conversaciones recientes y fletes en curso (el token de Realtime lleva esta lista). */
export async function topicsRealtime(usuario: UsuarioActual): Promise<string[]> {
  const perfil = perfilChat(usuario);
  if (!perfil) return [];
  const delUsuario =
    perfil.rol === "CLIENTE" ? { clienteId: perfil.perfilId } : { fleteroId: perfil.perfilId };
  const [conversaciones, fletes] = await Promise.all([
    prisma.conversacion.findMany({
      where: delUsuario,
      orderBy: { ultimaActividadEn: "desc" },
      take: MAXIMO_CANALES,
      select: { id: true },
    }),
    // Seguimiento en vivo: solo los fletes en curso.
    prisma.flete.findMany({
      where: { ...delUsuario, etapa: { in: [...ETAPAS_ACTIVAS] } },
      take: MAXIMO_FLETES,
      select: { id: true },
    }),
  ]);
  return [
    `usuario:${usuario.id}`,
    ...conversaciones.map((c) => `conversacion:${c.id}`),
    ...fletes.map((f) => topicFlete(f.id)),
  ];
}
