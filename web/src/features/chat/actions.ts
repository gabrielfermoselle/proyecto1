"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admitePropuestas, puedeEscribir, type EstadoConversacion } from "@/domain/chat";
import { diaDesdeIso } from "@/domain/fechas";
import { notificar } from "@/features/notificaciones/servidor";
import { BUCKET_PRIVADO, prepararSubida, rutaSubidaValida, urlsFirmadas } from "@/features/uploads/storage";
import { ActionError, createAction, esViolacionUnica } from "@/lib/action";
import { ahoraIso, db, fallar } from "@/lib/db";
import { nombrePublico } from "@/lib/formato";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import type { UsuarioActual } from "@/lib/session";
import { configPublicaSupabase, firmarTokenRealtime, publicar } from "@/lib/supabase";
import { getContextoChat, hrefConversacion, type ContextoChat } from "./acceso";
import { aMensajeDto, type MensajeDto } from "./dto";
import { conEventos } from "./eventos";
import { buscarMensaje } from "./mensaje-fila";
import { emisorDesdeContexto, insertarMensaje, type ContenidoMensaje } from "./mensajes";
import { topicsRealtime } from "./queries";
import {
  enviarFotoSchema,
  enviarMensajeSchema,
  marcarLeidoSchema,
  prepararFotoSchema,
  proponerHorarioSchema,
  responderPropuestaSchema,
} from "./schemas";

const ROLES_CHAT = ["CLIENTE", "FLETERO"] as const;
const NO_ENCONTRADA = "No encontramos esa conversación.";

const MOTIVO_NO_ESCRIBIBLE: Record<Exclude<EstadoConversacion, "NEGOCIACION" | "ACTIVA">, string> = {
  CERRADA: "Esta conversación está cerrada: ya no se pueden enviar mensajes.",
  BLOQUEADA: "El flete se canceló y el chat quedó bloqueado.",
};

async function contexto(conversacionId: string, usuario: UsuarioActual): Promise<ContextoChat> {
  const ctx = await getContextoChat(conversacionId, usuario);
  if (!ctx) throw new ActionError(NO_ENCONTRADA);
  return ctx;
}

/** Participante + conversación abierta a nuevos mensajes. Se vuelve a verificar en cada envío. */
async function contextoEscribible(conversacionId: string, usuario: UsuarioActual): Promise<ContextoChat> {
  const ctx = await contexto(conversacionId, usuario);
  if (!puedeEscribir(ctx.estado)) {
    throw new ActionError(MOTIVO_NO_ESCRIBIBLE[ctx.estado as keyof typeof MOTIVO_NO_ESCRIBIBLE]);
  }
  return ctx;
}

/**
 * Inserta y publica. Si el navegador reintenta con el mismo clientId (red lenta, doble envío),
 * devuelve el mensaje ya guardado en lugar de duplicarlo.
 */
async function enviar(
  ctx: ContextoChat,
  usuario: UsuarioActual,
  contenido: ContenidoMensaje,
  urlsFotos?: Map<string, string>,
): Promise<MensajeDto> {
  try {
    const { mensaje, publicaciones } = await insertarMensaje(
      db(),
      emisorDesdeContexto(ctx, usuario),
      contenido,
      urlsFotos,
    );
    await publicar(publicaciones);
    return mensaje;
  } catch (error) {
    if (!esViolacionUnica(error) || !contenido.clientId) throw error;
    const existente = await buscarMensaje(db(), {
      autorId: usuario.id,
      clientId: contenido.clientId,
      conversacionId: ctx.conversacionId,
    });
    if (!existente) throw error;
    return aMensajeDto(existente, ctx.contactoVisible, urlsFotos ?? new Map());
  }
}

export const enviarMensaje = createAction({
  schema: enviarMensajeSchema,
  roles: ROLES_CHAT,
  handler: async ({ conversacionId, clientId, texto }, { usuario }) => {
    const ctx = await contextoEscribible(conversacionId, usuario);
    await consumirLimite(
      LIMITES.mensajesPorConversacion(usuario.id, conversacionId),
      LIMITES.mensajesPorUsuario(usuario.id),
    );
    return enviar(ctx, usuario, { tipo: "TEXTO", texto, clientId });
  },
});

const carpetaFotosChat = (conversacionId: string, userId: string) => `chat/${conversacionId}/${userId}`;

/** Reserva una ruta en el bucket privado; el navegador sube la foto comprimida directo ahí. */
export const prepararFotoChat = createAction({
  schema: prepararFotoSchema,
  roles: ROLES_CHAT,
  handler: async ({ conversacionId }, { usuario }) => {
    await contextoEscribible(conversacionId, usuario);
    await consumirLimite(LIMITES.imagenes(usuario.id));
    const subida = await prepararSubida(BUCKET_PRIVADO, carpetaFotosChat(conversacionId, usuario.id));
    const storage = configPublicaSupabase();
    if (!subida || !storage) throw new ActionError("El envío de fotos todavía no está habilitado.");
    return { subida, storage };
  },
});

export const enviarFotoChat = createAction({
  schema: enviarFotoSchema,
  roles: ROLES_CHAT,
  handler: async ({ conversacionId, clientId, ruta, ancho, alto, texto }, { usuario }) => {
    const ctx = await contextoEscribible(conversacionId, usuario);
    // Solo se acepta una foto que este usuario subió a esta conversación y que existe.
    if (!(await rutaSubidaValida(BUCKET_PRIVADO, ruta, carpetaFotosChat(conversacionId, usuario.id)))) {
      throw new ActionError("No pudimos verificar la foto. Probá de nuevo.");
    }
    await consumirLimite(LIMITES.mensajesPorConversacion(usuario.id, conversacionId));
    return enviar(
      ctx,
      usuario,
      { tipo: "IMAGEN", texto, clientId, foto: { ruta, ancho, alto } },
      await urlsFirmadas([ruta]),
    );
  },
});

/** Adelanta la marca de lectura (nunca la atrasa) y le avisa al otro para el doble check. */
export const marcarLeido = createAction({
  schema: marcarLeidoSchema,
  roles: ROLES_CHAT,
  handler: async ({ conversacionId, hasta }, { usuario }) => {
    const ctx = await contexto(conversacionId, usuario);
    const instante = new Date(Math.min(new Date(hasta).getTime(), Date.now()));
    const campo = ctx.miRol === "CLIENTE" ? "leidoHastaCliente" : "leidoHastaFletero";
    const { data: actual, error: errorActual } = await db()
      .from("conversaciones")
      .select("leidoHastaCliente, leidoHastaFletero")
      .match(ctx.filtroParticipante)
      .maybeSingle();
    fallar(errorActual);
    const marca = (actual?.[campo] as string | null | undefined) ?? null;
    const atrasa = marca != null && new Date(marca).getTime() >= instante.getTime();
    let tocadas = 0;
    if (actual && !atrasa) {
      let q = db()
        .from("conversaciones")
        .update({ [campo]: instante.toISOString() })
        .match(ctx.filtroParticipante);
      q = marca == null ? q.is(campo, null) : q.lt(campo, instante.toISOString());
      const { data, error } = await q.select("id");
      fallar(error);
      tocadas = data?.length ?? 0;
    }
    if (tocadas > 0) {
      const leidaEn = ahoraIso();
      const { error: errorAviso } = await db()
        .from("notificaciones")
        .update({ leidaEn, updatedAt: leidaEn })
        .eq("userId", usuario.id)
        .eq("clave", `chat:${conversacionId}`)
        .is("leidaEn", null);
      fallar(errorAviso);
      await publicar([
        {
          topic: `conversacion:${conversacionId}`,
          event: "mensajes.leidos",
          payload: { rol: ctx.miRol, hasta: instante.toISOString() },
        },
        { topic: `usuario:${usuario.id}`, event: "bandeja.actualizada", payload: { conversacionId } },
      ]);
    }
    return { hasta: instante.toISOString() };
  },
});

/** Propone una fecha/franja. Anula la propuesta pendiente anterior de la conversación. */
export const proponerHorario = createAction({
  schema: proponerHorarioSchema,
  roles: ROLES_CHAT,
  handler: async ({ conversacionId, clientId, fecha, franja }, { usuario }) => {
    const ctx = await contextoEscribible(conversacionId, usuario);
    if (!admitePropuestas(ctx.estado, ctx.fleteEtapa)) {
      throw new ActionError("La fecha ya no se puede cambiar: el flete está en curso.");
    }
    await consumirLimite(LIMITES.propuestas(usuario.id));
    try {
      const tx = db();
      const { data: mensajes, error: errorMensajes } = await tx
        .from("mensajes")
        .select("id")
        .eq("conversacionId", conversacionId);
      fallar(errorMensajes);
      const ids = (mensajes ?? []).map((m) => m.id as string);
      if (ids.length > 0) {
        const { error: errorAnula } = await tx
          .from("propuestas_horario")
          .update({ estado: "ANULADA" })
          .in("mensajeId", ids)
          .eq("estado", "PENDIENTE");
        fallar(errorAnula);
      }
      const { mensaje, publicaciones } = await insertarMensaje(tx, emisorDesdeContexto(ctx, usuario), {
        tipo: "PROPUESTA",
        clientId,
        fecha: diaDesdeIso(fecha),
        franja,
      });
      await publicar(publicaciones);
      return mensaje;
    } catch (error) {
      if (esViolacionUnica(error)) throw new ActionError("Esa propuesta ya se envió.");
      throw error;
    }
  },
});

/**
 * Acepta o rechaza una propuesta de la otra parte. Aceptada con el flete confirmado, cambia la
 * fecha del flete al instante; en negociación queda acordada y se aplica si el cliente elige
 * ese presupuesto.
 */
export const responderPropuesta = createAction({
  schema: responderPropuestaSchema,
  roles: ROLES_CHAT,
  handler: async ({ propuestaId, aceptar }, { usuario }) => {
    const { data: fila, error: errorPropuesta } = await db()
      .from("propuestas_horario")
      .select("estado, fecha, franja, propuestaPorId, mensaje:mensajes!propuestas_horario_mensajeId_fkey(conversacionId)")
      .eq("id", propuestaId)
      .maybeSingle();
    fallar(errorPropuesta);
    const mensajePropuesta = fila
      ? (Array.isArray(fila.mensaje) ? fila.mensaje[0] : fila.mensaje)
      : null;
    const propuesta = fila
      ? {
          estado: fila.estado as string,
          fecha: new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(String(fila.fecha)) ? `${fila.fecha}T00:00:00.000Z` : String(fila.fecha),
          ),
          franja: fila.franja as ContextoChat["solicitud"]["franja"],
          propuestaPorId: fila.propuestaPorId as string,
          conversacionId: (mensajePropuesta?.conversacionId as string | undefined) ?? null,
        }
      : null;
    // Si no es participante, la propuesta "no existe" para él.
    const ctx = propuesta?.conversacionId ? await getContextoChat(propuesta.conversacionId, usuario) : null;
    if (!propuesta || !ctx) throw new ActionError("No encontramos esa propuesta.");
    if (propuesta.propuestaPorId === usuario.id)
      throw new ActionError("No podés responder tu propia propuesta.");
    if (propuesta.estado !== "PENDIENTE")
      throw new ActionError("Esa propuesta ya fue respondida o reemplazada.");
    if (!puedeEscribir(ctx.estado) || !admitePropuestas(ctx.estado, ctx.fleteEtapa)) {
      throw new ActionError("La fecha ya no se puede cambiar.");
    }

    const estado: "ACEPTADA" | "RECHAZADA" = aceptar ? "ACEPTADA" : "RECHAZADA";
    await conEventos(async (tx, { emitir, publicarDespues }) => {
      const respondidaEn = ahoraIso();
      const { data: tocadas, error: errorEstado } = await tx
        .from("propuestas_horario")
        .update({ estado, respondidaPorId: usuario.id, respondidaEn })
        .eq("id", propuestaId)
        .eq("estado", "PENDIENTE")
        .select("id");
      fallar(errorEstado);
      if (!tocadas?.length) throw new ActionError("Esa propuesta ya fue respondida o reemplazada.");

      if (aceptar) {
        // Con el flete confirmado (y todavía sin cargar) se aplica ya.
        const { data: fleteConfirmado, error: errorFlete } = await tx
          .from("fletes")
          .select("id")
          .eq("solicitudId", ctx.solicitudId)
          .eq("fleteroId", ctx.fleteroId)
          .eq("etapa", "CONFIRMADO")
          .maybeSingle();
        fallar(errorFlete);
        if (fleteConfirmado) {
          const { error: errorSolicitud } = await tx
            .from("solicitudes")
            .update({
              fecha: propuesta.fecha.toISOString().slice(0, 10),
              franja: propuesta.franja,
              updatedAt: respondidaEn,
            })
            .eq("id", ctx.solicitudId);
          fallar(errorSolicitud);
          const { error: errorAplicada } = await tx
            .from("propuestas_horario")
            .update({ aplicadaEn: respondidaEn })
            .eq("id", propuestaId);
          fallar(errorAplicada);
        }
        await emitir(
          {
            solicitudId: ctx.solicitudId,
            fleteroId: ctx.fleteroId,
            evento: "FECHA_ACORDADA",
            datos: {
              fecha: propuesta.fecha.toISOString().slice(0, 10),
              franja: propuesta.franja,
              aplicada: Boolean(fleteConfirmado),
            },
          },
          { notificarA: ctx.otro.rol },
        );
      } else {
        publicarDespues(
          await notificar(tx, {
            userId: ctx.otro.userId,
            tipo: "PROPUESTA",
            titulo: `${nombrePublico(usuario.nombre, usuario.apellido)} no aceptó la fecha propuesta`,
            cuerpo: ctx.titulo,
            href: hrefConversacion(ctx.otro.rol, ctx.solicitudId, ctx.fleteroId),
          }),
        );
      }
      publicarDespues([
        {
          topic: `conversacion:${ctx.conversacionId}`,
          event: "propuesta.actualizada",
          payload: { propuestaId, estado },
        },
      ]);
    });
    revalidatePath("/fletero", "layout");
    return { estado };
  },
});

/** Token de 15 minutos para Realtime, con los canales que el usuario puede usar. Null si no hay Supabase. */
export const obtenerTokenRealtime = createAction({
  schema: z.object({}),
  roles: ROLES_CHAT,
  handler: async (_input, { usuario }) => {
    const config = configPublicaSupabase();
    if (!config) return null;
    const topics = await topicsRealtime(usuario);
    const firmado = firmarTokenRealtime(usuario.id, topics);
    return firmado ? { ...firmado, ...config, topics } : null;
  },
});
