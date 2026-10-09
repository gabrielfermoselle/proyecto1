import "server-only";
import type { EstadoPresupuesto, EtapaFlete, FranjaHoraria } from "@/domain/catalogos";
import { contactoVisible, estadoConversacion, type EstadoConversacion } from "@/domain/chat";
import { fechaIsoDeDia } from "@/domain/fechas";
import type { EstadoSolicitudPedido } from "@/domain/pedido";
import { db, fallar, numero, relacion } from "@/lib/db";
import { nombrePublico } from "@/lib/formato";
import type { UsuarioActual } from "@/lib/session";
import type { RolChat } from "./dto";

// Única puerta de entrada a una conversación: todo (páginas, endpoints, acciones) pasa por acá.
// Si el usuario no es participante, la conversación "no existe" para él.

type EstadoSolicitud = EstadoSolicitudPedido;

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
  /** Restringe la conversación al participante (para actualizar la marca de lectura). */
  filtroParticipante: { id: string; clienteId: string } | { id: string; fleteroId: string };
}

interface UsuarioNombre {
  nombre: string;
  apellido: string;
}

interface PerfilChat {
  userId: string;
  user: UsuarioNombre | UsuarioNombre[] | null;
}

function comoFecha(valor: unknown): Date {
  if (valor instanceof Date) return valor;
  const texto = String(valor);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00.000Z` : texto);
}

function comoFechaONull(valor: unknown): Date | null {
  return valor == null ? null : comoFecha(valor);
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

  const { data: c, error } = await db()
    .from("conversaciones")
    .select(
      `id, solicitudId, fleteroId, clienteId, leidoHastaCliente, leidoHastaFletero,
       solicitud:solicitudes!conversaciones_solicitudId_fkey(titulo, estado, fecha, franja),
       cliente:perfiles_cliente!conversaciones_clienteId_fkey(userId, user:usuarios!cliente_profiles_userId_fkey(nombre, apellido)),
       fletero:perfiles_fletero!conversaciones_fleteroId_fkey(userId, user:usuarios!fletero_profiles_userId_fkey(nombre, apellido))`,
    )
    .match(filtroParticipante)
    .maybeSingle();
  fallar(error);
  if (!c) return null;

  const solicitud = relacion(
    c.solicitud as
      | { titulo: string; estado: EstadoSolicitud; fecha: string; franja: FranjaHoraria }
      | { titulo: string; estado: EstadoSolicitud; fecha: string; franja: FranjaHoraria }[]
      | null,
  );
  const cliente = relacion(c.cliente as PerfilChat | PerfilChat[] | null);
  const fletero = relacion(c.fletero as PerfilChat | PerfilChat[] | null);
  const clienteUser = relacion(cliente?.user);
  const fleteroUser = relacion(fletero?.user);
  if (!solicitud || !cliente || !fletero || !clienteUser || !fleteroUser) return null;

  const [presupuestoRes, fleteRes] = await Promise.all([
    db()
      .from("presupuestos")
      .select("id, monto, estado, validoHasta")
      .eq("solicitudId", c.solicitudId as string)
      .eq("fleteroId", c.fleteroId as string)
      .maybeSingle(),
    db().from("fletes").select("id, etapa, fleteroId").eq("solicitudId", c.solicitudId as string).maybeSingle(),
  ]);
  fallar(presupuestoRes.error);
  fallar(fleteRes.error);
  const presupuesto = presupuestoRes.data;
  const flete = fleteRes.data;
  // El flete de la solicitud cuenta solo si es con ESTE fletero.
  const fleteDelPar = flete?.fleteroId === c.fleteroId ? flete : null;
  const fleteEtapa = (fleteDelPar?.etapa as EtapaFlete | undefined) ?? null;

  const otroEsFletero = perfil.rol === "CLIENTE";
  const otro = otroEsFletero ? fletero : cliente;
  const otroUser = otroEsFletero ? fleteroUser : clienteUser;

  return {
    conversacionId: c.id as string,
    solicitudId: c.solicitudId as string,
    fleteroId: c.fleteroId as string,
    clienteId: c.clienteId as string,
    titulo: solicitud.titulo,
    miRol: perfil.rol,
    miUserId: usuario.id,
    otro: {
      userId: otro.userId,
      nombre: nombrePublico(otroUser.nombre, otroUser.apellido),
      rol: otroEsFletero ? "FLETERO" : "CLIENTE",
    },
    estado: estadoConversacion({
      solicitudEstado: solicitud.estado,
      presupuesto: presupuesto
        ? {
            estado: presupuesto.estado as EstadoPresupuesto,
            validoHasta: comoFecha(presupuesto.validoHasta),
          }
        : null,
      fleteEtapa,
    }),
    fleteId: (fleteDelPar?.id as string | undefined) ?? null,
    fleteEtapa,
    contactoVisible: contactoVisible(fleteEtapa),
    leidoHastaMio: comoFechaONull(perfil.rol === "CLIENTE" ? c.leidoHastaCliente : c.leidoHastaFletero),
    leidoHastaOtro: comoFechaONull(perfil.rol === "CLIENTE" ? c.leidoHastaFletero : c.leidoHastaCliente),
    solicitud: {
      fecha: fechaIsoDeDia(comoFecha(solicitud.fecha)),
      franja: solicitud.franja,
      estado: solicitud.estado,
    },
    presupuesto: presupuesto
      ? {
          id: presupuesto.id as string,
          monto: numero(presupuesto.monto),
          estado: presupuesto.estado as EstadoPresupuesto,
          validoHasta: comoFecha(presupuesto.validoHasta),
        }
      : null,
    filtroParticipante,
  };
}
