import "server-only";
import type { FranjaHoraria, Prisma } from "@prisma/client";
import { contactoVisible as calcularContactoVisible, ocultarContacto, sanitizarTexto } from "@/domain/chat";
import { notificar } from "@/features/notificaciones/servidor";
import { nombrePublico } from "@/lib/formato";
import type { Publicacion } from "@/lib/supabase";
import type { UsuarioActual } from "@/lib/session";
import { hrefConversacion, type ContextoChat } from "./acceso";
import { aMensajeDto, SELECT_MENSAJE, type MensajeDto, type RolChat } from "./dto";
import { publicacionesDeMensaje } from "./eventos";

type Tx = Prisma.TransactionClient;

/** Quién escribe, a quién le llega y si los datos de contacto ya se pueden mostrar. */
export interface Emisor {
  conversacionId: string;
  solicitudId: string;
  fleteroId: string;
  autorId: string;
  autorRol: RolChat;
  autorNombre: string;
  destinatarioUserId: string;
  destinatarioRol: RolChat;
  contactoVisible: boolean;
}

export function emisorDesdeContexto(
  ctx: ContextoChat,
  autor: Pick<UsuarioActual, "nombre" | "apellido">,
): Emisor {
  return {
    conversacionId: ctx.conversacionId,
    solicitudId: ctx.solicitudId,
    fleteroId: ctx.fleteroId,
    autorId: ctx.miUserId,
    autorRol: ctx.miRol,
    autorNombre: nombrePublico(autor.nombre, autor.apellido),
    destinatarioUserId: ctx.otro.userId,
    destinatarioRol: ctx.otro.rol,
    contactoVisible: ctx.contactoVisible,
  };
}

export type ContenidoMensaje =
  | { tipo: "TEXTO"; texto: string; clientId?: string | null }
  | {
      tipo: "IMAGEN";
      texto: string | null;
      clientId: string;
      foto: { ruta: string; ancho: number; alto: number };
    }
  | { tipo: "PROPUESTA"; clientId: string; fecha: Date; franja: FranjaHoraria };

function vistaPrevia(c: ContenidoMensaje, contactoVisible: boolean): string {
  if (c.tipo === "IMAGEN") return c.texto ? `📷 ${c.texto}` : "📷 Foto";
  if (c.tipo === "PROPUESTA") return "Propuso una nueva fecha para el flete";
  return contactoVisible ? c.texto : ocultarContacto(c.texto);
}

/**
 * Inserta un mensaje de un participante: actualiza la actividad de la conversación, adelanta la
 * marca de lectura del autor (lo propio cuenta como leído), agrupa la notificación del otro y
 * devuelve el DTO y los avisos en vivo a publicar después del commit.
 */
export async function insertarMensaje(
  tx: Tx,
  emisor: Emisor,
  contenido: ContenidoMensaje,
  urlsFotos: Map<string, string> = new Map(),
): Promise<{ mensaje: MensajeDto; publicaciones: Publicacion[] }> {
  const creado = await tx.mensaje.create({
    data: {
      conversacionId: emisor.conversacionId,
      autorId: emisor.autorId,
      tipo: contenido.tipo,
      contenido: contenido.tipo === "PROPUESTA" ? null : contenido.texto,
      clientId: contenido.clientId ?? null,
      ...(contenido.tipo === "IMAGEN" ? { fotos: { create: contenido.foto } } : {}),
      ...(contenido.tipo === "PROPUESTA"
        ? {
            propuesta: {
              create: { fecha: contenido.fecha, franja: contenido.franja, propuestaPorId: emisor.autorId },
            },
          }
        : {}),
    },
    select: SELECT_MENSAJE,
  });

  await tx.conversacion.update({
    where: { id: emisor.conversacionId },
    data: {
      ultimaActividadEn: creado.createdAt,
      ...(emisor.autorRol === "CLIENTE"
        ? { leidoHastaCliente: creado.createdAt }
        : { leidoHastaFletero: creado.createdAt }),
    },
  });

  const avisos = await notificar(tx, {
    userId: emisor.destinatarioUserId,
    tipo: "MENSAJE",
    titulo: `Mensajes de ${emisor.autorNombre}`,
    cuerpo: vistaPrevia(contenido, emisor.contactoVisible),
    href: hrefConversacion(emisor.destinatarioRol, emisor.solicitudId, emisor.fleteroId),
    // Una sola notificación por conversación: se actualiza con el último mensaje.
    clave: `chat:${emisor.conversacionId}`,
  });

  const mensaje = aMensajeDto(creado, emisor.contactoVisible, urlsFotos);
  return {
    mensaje,
    publicaciones: [
      ...publicacionesDeMensaje(emisor.conversacionId, mensaje, [emisor.autorId, emisor.destinatarioUserId]),
      ...avisos,
    ],
  };
}

/**
 * Mensaje de texto escrito desde otra operación (p. ej. el mensaje que acompaña un presupuesto),
 * dentro de su transacción: la conversación puede haberse creado recién y todavía no ser visible
 * afuera de ella.
 */
export async function crearMensajeDeTexto(
  tx: Tx,
  { conversacionId, autor, texto }: { conversacionId: string; autor: UsuarioActual; texto: string },
): Promise<Publicacion[]> {
  const limpio = sanitizarTexto(texto);
  if (!limpio) return [];
  const c = await tx.conversacion.findUniqueOrThrow({
    where: { id: conversacionId },
    select: {
      solicitudId: true,
      fleteroId: true,
      cliente: { select: { userId: true } },
      fletero: { select: { userId: true } },
    },
  });
  const flete = await tx.flete.findUnique({
    where: { solicitudId: c.solicitudId },
    select: { etapa: true, fleteroId: true },
  });
  const esCliente = autor.rol === "CLIENTE";
  const { publicaciones } = await insertarMensaje(
    tx,
    {
      conversacionId,
      solicitudId: c.solicitudId,
      fleteroId: c.fleteroId,
      autorId: autor.id,
      autorRol: esCliente ? "CLIENTE" : "FLETERO",
      autorNombre: nombrePublico(autor.nombre, autor.apellido),
      destinatarioUserId: esCliente ? c.fletero.userId : c.cliente.userId,
      destinatarioRol: esCliente ? "FLETERO" : "CLIENTE",
      contactoVisible: calcularContactoVisible(flete?.fleteroId === c.fleteroId ? flete.etapa : null),
    },
    { tipo: "TEXTO", texto: limpio },
  );
  return publicaciones;
}
