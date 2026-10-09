import "server-only";
import type { EstadoPresupuesto, EstadoSolicitud, EtapaFlete, FranjaHoraria } from "@prisma/client";
import { contactoVisible, estadoConversacion, type EstadoConversacion } from "@/domain/chat";
import { fechaIsoDeDia } from "@/domain/fechas";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import type { UsuarioActual } from "@/lib/session";
import type { RolChat } from "./dto";

// Única puerta de entrada a una conversación: todo (páginas, endpoints, acciones) pasa por acá.
// Si el usuario no es participante, la conversación "no existe" para él.

export function perfilChat(usuario: UsuarioActual): { rol: RolChat; perfilId: string } | null {
  if (usuario.rol === "CLIENTE" && usuario.clienteProfile)
    return { rol: "CLIENTE", perfilId: usuario.clienteProfile.id };
  if (usuario.rol === "FLETERO" && usuario.fleteroProfile)
    return { rol: "FLETERO", perfilId: usuario.fleteroProfile.id };
  return null;
}

export { hrefConversacion } from "./acceso-rutas";

export interface ContextoChat {
  conversacionId: string;
  solicitudId: string;
  fleteroId: string;
  clienteId: string;
  titulo: string;
  miRol: RolChat;
  miUserId: string;
  otro: { userId: string; nombre: string; rol: RolChat };
  estado: EstadoConversacion;
  fleteId: string | null;
  fleteEtapa: EtapaFlete | null;
  contactoVisible: boolean;
  leidoHastaMio: Date | null;
  leidoHastaOtro: Date | null;
  solicitud: { fecha: string; franja: FranjaHoraria; estado: EstadoSolicitud };
  presupuesto: { id: string; monto: number; estado: EstadoPresupuesto; validoHasta: Date } | null;
  /** Filtro de Prisma que restringe la conversación al participante (para updateMany). */
  filtroParticipante: { id: string; clienteId: string } | { id: string; fleteroId: string };
}

export async function getContextoChat(
  conversacionId: string,
  usuario: UsuarioActual,
): Promise<ContextoChat | null> {
  const perfil = perfilChat(usuario);
  if (!perfil) return null;
  const filtroParticipante =
    perfil.rol === "CLIENTE"
      ? { id: conversacionId, clienteId: perfil.perfilId }
      : { id: conversacionId, fleteroId: perfil.perfilId };

  const c = await prisma.conversacion.findFirst({
    where: filtroParticipante,
    select: {
      id: true,
      solicitudId: true,
      fleteroId: true,
      clienteId: true,
      leidoHastaCliente: true,
      leidoHastaFletero: true,
      solicitud: { select: { titulo: true, estado: true, fecha: true, franja: true } },
      cliente: { select: { userId: true, user: { select: { nombre: true, apellido: true } } } },
      fletero: { select: { userId: true, user: { select: { nombre: true, apellido: true } } } },
    },
  });
  if (!c) return null;

  const [presupuesto, flete] = await Promise.all([
    prisma.presupuesto.findUnique({
      where: { solicitudId_fleteroId: { solicitudId: c.solicitudId, fleteroId: c.fleteroId } },
      select: { id: true, monto: true, estado: true, validoHasta: true },
    }),
    prisma.flete.findUnique({
      where: { solicitudId: c.solicitudId },
      select: { id: true, etapa: true, fleteroId: true },
    }),
  ]);
  // El flete de la solicitud cuenta solo si es con ESTE fletero.
  const fleteDelPar = flete?.fleteroId === c.fleteroId ? flete : null;
  const fleteEtapa = fleteDelPar?.etapa ?? null;

  const otroEsFletero = perfil.rol === "CLIENTE";
  const otro = otroEsFletero ? c.fletero : c.cliente;

  return {
    conversacionId: c.id,
    solicitudId: c.solicitudId,
    fleteroId: c.fleteroId,
    clienteId: c.clienteId,
    titulo: c.solicitud.titulo,
    miRol: perfil.rol,
    miUserId: usuario.id,
    otro: {
      userId: otro.userId,
      nombre: nombrePublico(otro.user.nombre, otro.user.apellido),
      rol: otroEsFletero ? "FLETERO" : "CLIENTE",
    },
    estado: estadoConversacion({
      solicitudEstado: c.solicitud.estado,
      presupuesto: presupuesto ? { estado: presupuesto.estado, validoHasta: presupuesto.validoHasta } : null,
      fleteEtapa,
    }),
    fleteId: fleteDelPar?.id ?? null,
    fleteEtapa,
    contactoVisible: contactoVisible(fleteEtapa),
    leidoHastaMio: perfil.rol === "CLIENTE" ? c.leidoHastaCliente : c.leidoHastaFletero,
    leidoHastaOtro: perfil.rol === "CLIENTE" ? c.leidoHastaFletero : c.leidoHastaCliente,
    solicitud: {
      fecha: fechaIsoDeDia(c.solicitud.fecha),
      franja: c.solicitud.franja,
      estado: c.solicitud.estado,
    },
    presupuesto: presupuesto
      ? {
          id: presupuesto.id,
          monto: presupuesto.monto.toNumber(),
          estado: presupuesto.estado,
          validoHasta: presupuesto.validoHasta,
        }
      : null,
    filtroParticipante,
  };
}
