import "server-only";
import type { EtapaFlete, FranjaHoraria } from "@/domain/catalogos";
import { contactoVisible as calcularContactoVisible, ocultarContacto, sanitizarTexto } from "@/domain/chat";
import { notificar } from "@/features/notificaciones/servidor";
import { fallar, nuevoId, relacion } from "@/lib/db";
import { nombrePublico } from "@/lib/formato";
import type { Publicacion } from "@/lib/supabase";
import type { UsuarioActual } from "@/lib/session";
import { hrefConversacion, type ContextoChat } from "./acceso";
import { aMensajeDto, type MensajeDto, type RolChat } from "./dto";
import { publicacionesDeMensaje, type Tx } from "./eventos";
import { cargarMensaje } from "./mensaje-fila";

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
 * devuelve el DTO y los avisos en vivo a publicar después.
 */
export async function insertarMensaje(
  tx: Tx,
  emisor: Emisor,
  contenido: ContenidoMensaje,
  urlsFotos: Map<string, string> = new Map(),
): Promise<{ mensaje: MensajeDto; publicaciones: Publicacion[] }> {
  const id = nuevoId();
  const { error: errorMensaje } = await tx.from("mensajes").insert({
    id,
    conversacionId: emisor.conversacionId,
    autorId: emisor.autorId,
    tipo: contenido.tipo,
    contenido: contenido.tipo === "PROPUESTA" ? null : contenido.texto,
    clientId: contenido.clientId ?? null,
  });
  fallar(errorMensaje);

  if (contenido.tipo === "IMAGEN") {
    const { error } = await tx.from("fotos").insert({
      id: nuevoId(),
      ruta: contenido.foto.ruta,
      ancho: contenido.foto.ancho,
      alto: contenido.foto.alto,
      mensajeId: id,
    });
    fallar(error);
  }
  if (contenido.tipo === "PROPUESTA") {
    const { error } = await tx.from("propuestas_horario").insert({
      id: nuevoId(),
      mensajeId: id,
      fecha: contenido.fecha.toISOString().slice(0, 10),
      franja: contenido.franja,
      propuestaPorId: emisor.autorId,
    });
    fallar(error);
  }

  const creado = await cargarMensaje(tx, id);
  const marca = creado.createdAt.toISOString();
  const { error: errorConversacion } = await tx
    .from("conversaciones")
    .update({
      ultimaActividadEn: marca,
      ...(emisor.autorRol === "CLIENTE" ? { leidoHastaCliente: marca } : { leidoHastaFletero: marca }),
    })
    .eq("id", emisor.conversacionId);
  fallar(errorConversacion);

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
 * Mensaje de texto escrito desde otra operación (p. ej. el mensaje que acompaña un presupuesto).
 * La conversación puede haberse creado recién en la misma operación.
 */
export async function crearMensajeDeTexto(
  tx: Tx,
  { conversacionId, autor, texto }: { conversacionId: string; autor: UsuarioActual; texto: string },
): Promise<Publicacion[]> {
  const limpio = sanitizarTexto(texto);
  if (!limpio) return [];
  const { data, error } = await tx
    .from("conversaciones")
    .select(
      "solicitudId, fleteroId, cliente:perfiles_cliente!conversaciones_clienteId_fkey(userId), fletero:perfiles_fletero!conversaciones_fleteroId_fkey(userId)",
    )
    .eq("id", conversacionId)
    .single();
  fallar(error);
  if (!data) throw new Error(`No existe la conversación ${conversacionId}`);
  const cliente = relacion(data.cliente as { userId: string } | { userId: string }[] | null);
  const fletero = relacion(data.fletero as { userId: string } | { userId: string }[] | null);
  if (!cliente || !fletero) throw new Error(`La conversación ${conversacionId} no tiene participantes`);

  const { data: flete, error: errorFlete } = await tx
    .from("fletes")
    .select("etapa, fleteroId")
    .eq("solicitudId", data.solicitudId as string)
    .maybeSingle();
  fallar(errorFlete);

  const esCliente = autor.rol === "CLIENTE";
  const { publicaciones } = await insertarMensaje(
    tx,
    {
      conversacionId,
      solicitudId: data.solicitudId as string,
      fleteroId: data.fleteroId as string,
      autorId: autor.id,
      autorRol: esCliente ? "CLIENTE" : "FLETERO",
      autorNombre: nombrePublico(autor.nombre, autor.apellido),
      destinatarioUserId: esCliente ? fletero.userId : cliente.userId,
      destinatarioRol: esCliente ? "FLETERO" : "CLIENTE",
      contactoVisible: calcularContactoVisible(
        flete && flete.fleteroId === data.fleteroId ? (flete.etapa as EtapaFlete) : null,
      ),
    },
    { tipo: "TEXTO", texto: limpio },
  );
  return publicaciones;
}
