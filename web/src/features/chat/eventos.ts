import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notificar, type TipoNotificacion } from "@/features/notificaciones/servidor";
import { hrefPedido } from "@/features/fletes/rutas";
import { db, fallar, nuevoId, relacion } from "@/lib/db";
import { formatearPesos, nombrePublico } from "@/lib/formato";
import { publicar, type Publicacion } from "@/lib/supabase";
import { hrefConversacion } from "./acceso";
import { aMensajeDto, type RolChat } from "./dto";
import type { DatosEvento, EventoChat } from "./eventos-catalogo";
import { cargarMensaje } from "./mensaje-fila";

// Eventos de negocio → mensaje de sistema en el chat + notificación a la otra parte.
// Se registran en la misma operación que los provoca y los avisos en vivo se publican
// solo si esa operación terminó bien.

export type Tx = SupabaseClient;

export interface EventoNegocio<E extends EventoChat = EventoChat> {
  solicitudId: string;
  fleteroId: string;
  evento: E;
  datos: DatosEvento<E>;
}

interface Partes {
  titulo: string;
  cliente: string;
  fletero: string;
}

interface UsuarioNombre {
  nombre: string;
  apellido: string;
}

const NOTIFICACION: {
  [E in EventoChat]: {
    para: (d: DatosEvento<E>) => RolChat;
    tipo: TipoNotificacion;
    titulo: (p: Partes, d: DatosEvento<E>) => string;
    /** Lleva a la página del flete en lugar del chat (los avisos de la operación). */
    aFlete?: true;
  };
} = {
  PRESUPUESTO_ENVIADO: {
    para: () => "CLIENTE",
    tipo: "PRESUPUESTO",
    titulo: (p, d) => `${p.fletero} te envió un presupuesto de ${formatearPesos(d.monto)}`,
  },
  PRESUPUESTO_RETIRADO: {
    para: () => "CLIENTE",
    tipo: "PRESUPUESTO",
    titulo: (p) => `${p.fletero} retiró su presupuesto`,
  },
  PRESUPUESTO_NO_ELEGIDO: {
    para: () => "FLETERO",
    tipo: "PRESUPUESTO",
    titulo: () => "El cliente eligió otro presupuesto",
  },
  FLETE_CONFIRMADO: {
    para: () => "FLETERO",
    tipo: "FLETE",
    titulo: (p) => `¡${p.cliente} aceptó tu presupuesto!`,
    aFlete: true,
  },
  EN_CAMINO_A_ORIGEN: {
    para: () => "CLIENTE",
    tipo: "FLETE",
    titulo: (p) => `${p.fletero} salió a buscar tu carga`,
    aFlete: true,
  },
  LLEGADA_ORIGEN: {
    para: () => "CLIENTE",
    tipo: "FLETE",
    titulo: (p) => `${p.fletero} llegó y está cargando`,
    aFlete: true,
  },
  CARGA_REGISTRADA: {
    para: () => "CLIENTE",
    tipo: "FLETE",
    titulo: (p) => `${p.fletero} cargó tus cosas y va al destino`,
    aFlete: true,
  },
  LLEGADA_DESTINO: {
    para: () => "CLIENTE",
    tipo: "FLETE",
    titulo: (p) => `${p.fletero} llegó al destino`,
    aFlete: true,
  },
  DESCARGA_REGISTRADA: {
    para: () => "CLIENTE",
    tipo: "FLETE",
    titulo: (p) => `${p.fletero} registró la entrega: revisá y confirmá la recepción`,
    aFlete: true,
  },
  RECLAMO_ABIERTO: {
    para: () => "FLETERO",
    tipo: "FLETE",
    titulo: (p, d) => `${p.cliente} abrió un reclamo por «${d.item}»`,
    aFlete: true,
  },
  FLETE_CERRADO: {
    para: () => "FLETERO",
    tipo: "FLETE",
    titulo: (p, d) =>
      d.reclamos ? `${p.cliente} cerró el flete con reclamos` : `${p.cliente} confirmó la recepción`,
    aFlete: true,
  },
  EN_VIAJE: { para: () => "CLIENTE", tipo: "FLETE", titulo: (p) => `${p.fletero} va en camino al destino` },
  RECEPCION_CONFIRMADA: {
    para: () => "FLETERO",
    tipo: "FLETE",
    titulo: (p) => `${p.cliente} confirmó la recepción`,
  },
  FLETE_CANCELADO: {
    para: (d) => (d.por === "CLIENTE" ? "FLETERO" : "CLIENTE"),
    tipo: "FLETE",
    titulo: (p, d) => `${d.por === "CLIENTE" ? p.cliente : p.fletero} canceló el flete`,
  },
  FECHA_ACORDADA: { para: () => "CLIENTE", tipo: "PROPUESTA", titulo: () => "Nueva fecha acordada" },
  SOLICITUD_CANCELADA: {
    para: () => "FLETERO",
    tipo: "PRESUPUESTO",
    titulo: () => "El cliente canceló la solicitud",
  },
};

/** Publicaciones que avisan a ambos participantes de un mensaje nuevo en la conversación. */
export function publicacionesDeMensaje(
  conversacionId: string,
  mensaje: ReturnType<typeof aMensajeDto>,
  userIds: string[],
): Publicacion[] {
  return [
    { topic: `conversacion:${conversacionId}`, event: "mensaje.creado", payload: { mensaje } },
    ...userIds.map((userId) => ({
      topic: `usuario:${userId}`,
      event: "bandeja.actualizada",
      payload: { conversacionId },
    })),
  ];
}

/** Crea la conversación del par si no existe. En conflicto no pisa el id que ya tenía. */
async function asegurarConversacion(
  tx: Tx,
  campos: { solicitudId: string; fleteroId: string; clienteId: string },
): Promise<string> {
  const { data, error } = await tx
    .from("conversaciones")
    .upsert(
      { id: nuevoId(), ...campos },
      { onConflict: "solicitudId,fleteroId", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error && error.code !== "PGRST116") fallar(error);
  if (data?.id) return data.id as string;

  const { data: existente, error: errorExistente } = await tx
    .from("conversaciones")
    .select("id")
    .eq("solicitudId", campos.solicitudId)
    .eq("fleteroId", campos.fleteroId)
    .single();
  fallar(errorExistente);
  if (!existente?.id) throw new Error("No se pudo abrir la conversación");
  return existente.id as string;
}

/**
 * Registra el evento en el chat del par (solicitud, fletero). Si la conversación no existe, la
 * crea: así el chat se habilita cuando el fletero presupuesta. `notificarA` permite elegir el
 * destinatario cuando depende de quién actuó (p. ej. una fecha que acepta el fletero).
 */
export async function registrarEvento<E extends EventoChat>(
  tx: Tx,
  e: EventoNegocio<E>,
  opciones: { notificarA?: RolChat } = {},
): Promise<{ conversacionId: string; publicaciones: Publicacion[] }> {
  const { data: solicitud, error: errorSolicitud } = await tx
    .from("solicitudes")
    .select(
      "titulo, clienteId, cliente:perfiles_cliente!solicitudes_clienteId_fkey(userId, user:usuarios!cliente_profiles_userId_fkey(nombre, apellido))",
    )
    .eq("id", e.solicitudId)
    .single();
  fallar(errorSolicitud);
  if (!solicitud) throw new Error(`No existe la solicitud ${e.solicitudId}`);
  const cliente = relacion(
    solicitud.cliente as { userId: string; user: UsuarioNombre | UsuarioNombre[] } | { userId: string; user: UsuarioNombre | UsuarioNombre[] }[] | null,
  );
  const clienteUser = relacion(cliente?.user);
  if (!cliente || !clienteUser) throw new Error(`La solicitud ${e.solicitudId} no tiene cliente`);

  const { data: fletero, error: errorFletero } = await tx
    .from("perfiles_fletero")
    .select("userId, user:usuarios!fletero_profiles_userId_fkey(nombre, apellido)")
    .eq("id", e.fleteroId)
    .single();
  fallar(errorFletero);
  if (!fletero) throw new Error(`No existe el fletero ${e.fleteroId}`);
  const fleteroUser = relacion(fletero.user as UsuarioNombre | UsuarioNombre[] | null);
  if (!fleteroUser) throw new Error(`El fletero ${e.fleteroId} no tiene usuario`);

  const conversacionId = await asegurarConversacion(tx, {
    solicitudId: e.solicitudId,
    fleteroId: e.fleteroId,
    clienteId: solicitud.clienteId as string,
  });
  const mensajeId = nuevoId();
  const { error: errorMensaje } = await tx.from("mensajes").insert({
    id: mensajeId,
    conversacionId,
    tipo: "SISTEMA",
    evento: e.evento,
    datos: e.datos,
  });
  fallar(errorMensaje);
  const mensaje = await cargarMensaje(tx, mensajeId);
  const { error: errorActividad } = await tx
    .from("conversaciones")
    .update({ ultimaActividadEn: mensaje.createdAt.toISOString() })
    .eq("id", conversacionId);
  fallar(errorActividad);

  const partes: Partes = {
    titulo: solicitud.titulo as string,
    cliente: nombrePublico(clienteUser.nombre, clienteUser.apellido),
    fletero: nombrePublico(fleteroUser.nombre, fleteroUser.apellido),
  };
  const config = NOTIFICACION[e.evento] as {
    para: (d: unknown) => RolChat;
    tipo: TipoNotificacion;
    titulo: (p: Partes, d: unknown) => string;
    aFlete?: true;
  };
  const destinatario = opciones.notificarA ?? config.para(e.datos);
  const flete = config.aFlete
    ? await (async () => {
        const { data, error } = await tx
          .from("fletes")
          .select("id")
          .eq("solicitudId", e.solicitudId)
          .eq("fleteroId", e.fleteroId)
          .maybeSingle();
        fallar(error);
        return data;
      })()
    : null;
  const avisos = await notificar(tx, {
    userId: destinatario === "CLIENTE" ? cliente.userId : (fletero.userId as string),
    tipo: config.tipo,
    titulo: config.titulo(partes, e.datos),
    cuerpo: solicitud.titulo as string,
    href: flete
      ? hrefPedido(destinatario, e.solicitudId)
      : hrefConversacion(destinatario, e.solicitudId, e.fleteroId),
  });

  // Los mensajes de sistema no tienen datos de contacto ni fotos: no hace falta ocultar ni firmar.
  const dto = aMensajeDto(mensaje, true, new Map());
  return {
    conversacionId,
    publicaciones: [
      ...publicacionesDeMensaje(conversacionId, dto, [cliente.userId, fletero.userId as string]),
      ...avisos,
    ],
  };
}

export interface ContextoEventos {
  /** Registra un evento de negocio y devuelve el id de la conversación del par. */
  emitir: <E extends EventoChat>(e: EventoNegocio<E>, opciones?: { notificarA?: RolChat }) => Promise<string>;
  /** Encola avisos en vivo propios (se publican si la operación termina bien). */
  publicarDespues: (publicaciones: Publicacion[]) => void;
}

/**
 * Corre `fn` con el cliente de la base y acceso a `emitir`. Los avisos en vivo se publican
 * solo si `fn` terminó bien.
 */
export async function conEventos<T>(fn: (tx: Tx, ctx: ContextoEventos) => Promise<T>): Promise<T> {
  const tx = db();
  const pendientes: Publicacion[] = [];
  const resultado = await fn(tx, {
    emitir: async (e, opcionesEvento) => {
      const { conversacionId, publicaciones } = await registrarEvento(tx, e, opcionesEvento);
      pendientes.push(...publicaciones);
      return conversacionId;
    },
    publicarDespues: (publicaciones) => pendientes.push(...publicaciones),
  });
  await publicar(pendientes);
  return resultado;
}
