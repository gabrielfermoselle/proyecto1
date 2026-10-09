import "server-only";
import type { EtapaFlete, FranjaHoraria } from "@/domain/catalogos";
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
import { consulta, db, fallar, numero } from "@/lib/db";
import { nombrePublico } from "@/lib/formato";
import type { UsuarioActual } from "@/lib/session";
import { getContextoChat, hrefConversacion, perfilChat, type ContextoChat } from "./acceso";
import { consultaBandeja, consultaTotalNoLeidos, type FilaBandeja } from "./consultas-sql";
import type { Cursor } from "./cursor";
import { aMensajeDto, rutasDeFotos, type MensajeDto, type RolChat } from "./dto";
import { textoEvento } from "./eventos-catalogo";
import { listarMensajes } from "./mensaje-fila";

export const MENSAJES_POR_PAGINA = 30;
const MAXIMO_NUEVOS = 100;

function comoFecha(valor: unknown): Date {
  if (valor instanceof Date) return valor;
  const texto = String(valor);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00.000Z` : texto);
}

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

interface FilaBandejaJson extends Omit<FilaBandeja, "ultimaActividadEn" | "presupuestoValidoHasta" | "noLeidos"> {
  ultimaActividadEn: string;
  presupuestoValidoHasta: string | null;
  noLeidos: number | string;
}

function normalizarFila(f: FilaBandejaJson): FilaBandeja {
  return {
    ...f,
    noLeidos: numero(f.noLeidos),
    ultimaActividadEn: comoFecha(f.ultimaActividadEn),
    presupuestoValidoHasta: f.presupuestoValidoHasta ? comoFecha(f.presupuestoValidoHasta) : null,
  };
}

export async function getBandeja(usuario: UsuarioActual, limite = 50) {
  const perfil = perfilChat(usuario);
  if (!perfil) return { conversaciones: [], noLeidosTotal: 0 };
  const consultaSql = consultaBandeja({
    lado: perfil.rol,
    perfilId: perfil.perfilId,
    userId: usuario.id,
    limite,
  });
  const filas = (await consulta<FilaBandejaJson>(consultaSql.sql, consultaSql.params)).map(normalizarFila);
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
  const consultaSql = consultaTotalNoLeidos({
    lado: perfil.rol,
    perfilId: perfil.perfilId,
    userId: usuario.id,
  });
  const [fila] = await consulta<{ total: number | string }>(consultaSql.sql, consultaSql.params);
  return fila ? numero(fila.total) : 0;
}

// ---------------------------------------------------------------------------
// Mensajes de una conversación (paginación por cursor)
// ---------------------------------------------------------------------------

const filtroCursor = (sentido: "despues" | "antes", c: Cursor) => {
  const cmp = sentido === "despues" ? "gt" : "lt";
  const iso = c.createdAt.toISOString();
  return `createdAt.${cmp}."${iso}",and(createdAt.eq."${iso}",id.${cmp}."${c.id}")`;
};

/**
 * Sin cursores: la última página. Con `antes`: la página anterior (scroll hacia arriba).
 * Con `despues`: lo nuevo desde el último mensaje conocido (reconexión o consulta periódica).
 * Siempre en orden cronológico.
 */
export async function getMensajes(
  ctx: ContextoChat,
  cursores: { antes?: Cursor | null; despues?: Cursor | null } = {},
): Promise<{ mensajes: MensajeDto[]; hayMasAnteriores: boolean }> {
  let crudos;
  let hayMasAnteriores = false;
  if (cursores.despues) {
    crudos = await listarMensajes(db(), ctx.conversacionId, {
      filtro: filtroCursor("despues", cursores.despues),
      ascendente: true,
      limite: MAXIMO_NUEVOS,
    });
  } else {
    const pagina = await listarMensajes(db(), ctx.conversacionId, {
      ...(cursores.antes ? { filtro: filtroCursor("antes", cursores.antes) } : {}),
      ascendente: false,
      limite: MENSAJES_POR_PAGINA + 1,
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

async function idsDeMensajes(conversacionId: string): Promise<string[]> {
  const { data, error } = await db().from("mensajes").select("id").eq("conversacionId", conversacionId);
  fallar(error);
  return (data ?? []).map((m) => m.id as string);
}

export async function getMetaConversacion(ctx: ContextoChat): Promise<MetaConversacion> {
  const ids = ctx.estado === "NEGOCIACION" || ctx.miRol === "FLETERO" ? await idsDeMensajes(ctx.conversacionId) : [];
  let acordada: { fecha: string; franja: FranjaHoraria } | null = null;
  if (ctx.estado === "NEGOCIACION" && ids.length > 0) {
    const { data, error } = await db()
      .from("propuestas_horario")
      .select("fecha, franja")
      .in("mensajeId", ids)
      .eq("estado", "ACEPTADA")
      .is("aplicadaEn", null)
      .order("respondidaEn", { ascending: false })
      .limit(1)
      .maybeSingle();
    fallar(error);
    acordada = data ? { fecha: fechaIsoDeDia(comoFecha(data.fecha)), franja: data.franja as FranjaHoraria } : null;
  }
  let conflictos: Record<string, string[]> = {};
  if (ctx.miRol === "FLETERO") {
    const [pendientes, turnos] = await Promise.all([
      ids.length === 0
        ? Promise.resolve([] as { id: string; fecha: string; franja: FranjaHoraria }[])
        : db()
            .from("propuestas_horario")
            .select("id, fecha, franja")
            .in("mensajeId", ids)
            .eq("estado", "PENDIENTE")
            .then(({ data, error }) => {
              fallar(error);
              return (data ?? []) as { id: string; fecha: string; franja: FranjaHoraria }[];
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
              conflictosCon({ fecha: fechaIsoDeDia(comoFecha(p.fecha)), franja: p.franja }, otros).map((t) => t.titulo),
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
    fechaAcordada: acordada,
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
  const columna = perfil.rol === "CLIENTE" ? "clienteId" : "fleteroId";
  const [conversaciones, fletes] = await Promise.all([
    db()
      .from("conversaciones")
      .select("id")
      .eq(columna, perfil.perfilId)
      .order("ultimaActividadEn", { ascending: false })
      .limit(MAXIMO_CANALES),
    db()
      .from("fletes")
      .select("id")
      .eq(columna, perfil.perfilId)
      .in("etapa", [...ETAPAS_ACTIVAS])
      .limit(MAXIMO_FLETES),
  ]);
  fallar(conversaciones.error);
  fallar(fletes.error);
  return [
    `usuario:${usuario.id}`,
    ...(conversaciones.data ?? []).map((c) => `conversacion:${c.id as string}`),
    ...(fletes.data ?? []).map((f) => topicFlete(f.id as string)),
  ];
}
