import "server-only";
import type { Prisma, TipoNotificacion } from "@prisma/client";
import { notificar } from "@/features/notificaciones/servidor";
import { formatearPesos, nombrePublico } from "@/lib/formato";
import { hrefPedido } from "@/features/fletes/rutas";
import { prisma } from "@/lib/prisma";
import { publicar, type Publicacion } from "@/lib/supabase";
import { hrefConversacion } from "./acceso";
import { aMensajeDto, SELECT_MENSAJE, type RolChat } from "./dto";
import type { DatosEvento, EventoChat } from "./eventos-catalogo";

// Eventos de negocio → mensaje de sistema en el chat + notificación a la otra parte.
// Se registran DENTRO de la transacción que los provoca (si la operación falla, no queda un
// "Flete confirmado" huérfano) y los avisos en vivo se publican DESPUÉS del commit.

type Tx = Prisma.TransactionClient;

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
  const solicitud = await tx.solicitud.findUniqueOrThrow({
    where: { id: e.solicitudId },
    select: {
      titulo: true,
      clienteId: true,
      cliente: { select: { userId: true, user: { select: { nombre: true, apellido: true } } } },
    },
  });
  const fletero = await tx.fleteroProfile.findUniqueOrThrow({
    where: { id: e.fleteroId },
    select: { userId: true, user: { select: { nombre: true, apellido: true } } },
  });

  const conversacion = await tx.conversacion.upsert({
    where: { solicitudId_fleteroId: { solicitudId: e.solicitudId, fleteroId: e.fleteroId } },
    create: { solicitudId: e.solicitudId, fleteroId: e.fleteroId, clienteId: solicitud.clienteId },
    update: {},
    select: { id: true },
  });
  const mensaje = await tx.mensaje.create({
    data: {
      conversacionId: conversacion.id,
      tipo: "SISTEMA",
      evento: e.evento,
      datos: e.datos as Prisma.InputJsonValue,
    },
    select: SELECT_MENSAJE,
  });
  await tx.conversacion.update({
    where: { id: conversacion.id },
    data: { ultimaActividadEn: mensaje.createdAt },
  });

  const partes: Partes = {
    titulo: solicitud.titulo,
    cliente: nombrePublico(solicitud.cliente.user.nombre, solicitud.cliente.user.apellido),
    fletero: nombrePublico(fletero.user.nombre, fletero.user.apellido),
  };
  const config = NOTIFICACION[e.evento] as {
    para: (d: unknown) => RolChat;
    tipo: TipoNotificacion;
    titulo: (p: Partes, d: unknown) => string;
    aFlete?: true;
  };
  const destinatario = opciones.notificarA ?? config.para(e.datos);
  const flete = config.aFlete
    ? await tx.flete.findFirst({
        where: { solicitudId: e.solicitudId, fleteroId: e.fleteroId },
        select: { id: true },
      })
    : null;
  const avisos = await notificar(tx, {
    userId: destinatario === "CLIENTE" ? solicitud.cliente.userId : fletero.userId,
    tipo: config.tipo,
    titulo: config.titulo(partes, e.datos),
    cuerpo: solicitud.titulo,
    href: flete
      ? hrefPedido(destinatario, e.solicitudId)
      : hrefConversacion(destinatario, e.solicitudId, e.fleteroId),
  });

  // Los mensajes de sistema no tienen datos de contacto ni fotos: no hace falta ocultar ni firmar.
  const dto = aMensajeDto(mensaje, true, new Map());
  return {
    conversacionId: conversacion.id,
    publicaciones: [
      ...publicacionesDeMensaje(conversacion.id, dto, [solicitud.cliente.userId, fletero.userId]),
      ...avisos,
    ],
  };
}

export interface ContextoEventos {
  /** Registra un evento de negocio y devuelve el id de la conversación del par. */
  emitir: <E extends EventoChat>(e: EventoNegocio<E>, opciones?: { notificarA?: RolChat }) => Promise<string>;
  /** Encola avisos en vivo propios (se publican después del commit). */
  publicarDespues: (publicaciones: Publicacion[]) => void;
}

/**
 * Corre `fn` en una transacción con acceso a `emitir`. Los avisos en vivo se publican solo si
 * la transacción se confirmó.
 */
export async function conEventos<T>(
  fn: (tx: Tx, ctx: ContextoEventos) => Promise<T>,
  opciones?: { timeout?: number },
): Promise<T> {
  const pendientes: Publicacion[] = [];
  const resultado = await prisma.$transaction(
    async (tx) =>
      fn(tx, {
        emitir: async (e, opcionesEvento) => {
          const { conversacionId, publicaciones } = await registrarEvento(tx, e, opcionesEvento);
          pendientes.push(...publicaciones);
          return conversacionId;
        },
        publicarDespues: (publicaciones) => pendientes.push(...publicaciones),
      }),
    opciones,
  );
  await publicar(pendientes);
  return resultado;
}
