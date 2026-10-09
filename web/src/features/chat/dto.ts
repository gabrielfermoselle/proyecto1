// Forma en la que un mensaje viaja al navegador (respuesta de una acción, página o aviso en
// vivo). Es neutral respecto de quién lo mira: lleva el rol del autor y cada cliente decide si
// es propio. El texto ya viene con los datos de contacto ocultos si corresponde.

import { ocultarContacto } from "@/domain/chat";
import type { FranjaHoraria } from "@/domain/catalogos";
import { fechaIsoDeDia } from "@/domain/fechas";
import type { Rol } from "@/domain/roles";
import { codificarCursor } from "./cursor";
import { textoEvento } from "./eventos-catalogo";

export type RolChat = Extract<Rol, "CLIENTE" | "FLETERO">;

export type TipoMensaje = "TEXTO" | "IMAGEN" | "SISTEMA" | "PROPUESTA";

export type EstadoPropuesta = "PENDIENTE" | "ACEPTADA" | "RECHAZADA" | "ANULADA";

export interface PropuestaDto {
  id: string;
  fecha: string;
  franja: FranjaHoraria;
  estado: EstadoPropuesta;
  propuestaPorRol: RolChat;
}

export interface MensajeDto {
  id: string;
  clientId: string | null;
  tipo: TipoMensaje;
  /** null en los mensajes de sistema. */
  autorRol: RolChat | null;
  texto: string | null;
  fotos: { id: string; url: string; ancho: number | null; alto: number | null }[];
  propuesta: PropuestaDto | null;
  creadoEn: string;
  cursor: string;
}

/**
 * Columnas (y relaciones) que hay que cargar para armar un MensajeDto.
 * Se pasa a `.select()` del cliente de Supabase.
 */
export const SELECT_MENSAJE = `
  id, clientId, tipo, contenido, evento, datos, createdAt,
  autor:usuarios!mensajes_autorId_fkey(rol),
  fotos!fotos_mensajeId_fkey(id, ruta, ancho, alto),
  propuesta:propuestas_horario!propuestas_horario_mensajeId_fkey(
    id, fecha, franja, estado,
    propuestaPor:usuarios!propuestas_horario_propuestaPorId_fkey(rol)
  )
`;

export interface MensajeCrudo {
  id: string;
  clientId: string | null;
  tipo: TipoMensaje;
  contenido: string | null;
  evento: string | null;
  datos: unknown;
  createdAt: Date;
  autor: { rol: Rol } | null;
  fotos: { id: string; ruta: string; ancho: number | null; alto: number | null }[];
  propuesta: {
    id: string;
    fecha: Date;
    franja: FranjaHoraria;
    estado: EstadoPropuesta;
    propuestaPor: { rol: Rol };
  } | null;
}

interface FilaFoto {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

interface FilaPropuesta {
  id: string;
  fecha: string;
  franja: FranjaHoraria;
  estado: EstadoPropuesta;
  propuestaPor: { rol: Rol } | { rol: Rol }[] | null;
}

interface FilaMensaje {
  id: string;
  clientId: string | null;
  tipo: TipoMensaje;
  contenido: string | null;
  evento: string | null;
  datos: unknown;
  createdAt: string;
  autor: { rol: Rol } | { rol: Rol }[] | null;
  fotos: FilaFoto[] | FilaFoto | null;
  propuesta: FilaPropuesta | FilaPropuesta[] | null;
}

function uno<T>(valor: T | T[] | null | undefined): T | null {
  if (valor == null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function varias<T>(valor: T | T[] | null | undefined): T[] {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

/** Una columna `date` llega como YYYY-MM-DD: medianoche UTC, igual que Prisma. */
function comoDia(valor: unknown): Date {
  if (valor instanceof Date) return valor;
  const texto = String(valor);
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00.000Z` : texto);
}

/** Arma el MensajeCrudo que espera aMensajeDto a partir de la fila de PostgREST. */
export function aMensajeCrudo(fila: unknown): MensajeCrudo {
  const m = fila as FilaMensaje;
  const propuesta = uno(m.propuesta);
  const propuestaPor = propuesta ? uno(propuesta.propuestaPor) : null;
  return {
    id: m.id,
    clientId: m.clientId,
    tipo: m.tipo,
    contenido: m.contenido,
    evento: m.evento,
    datos: m.datos,
    createdAt: new Date(m.createdAt),
    autor: uno(m.autor),
    fotos: varias(m.fotos),
    propuesta:
      propuesta && propuestaPor
        ? {
            id: propuesta.id,
            fecha: comoDia(propuesta.fecha),
            franja: propuesta.franja,
            estado: propuesta.estado,
            propuestaPor,
          }
        : null,
  };
}

const comoRolChat = (rol: Rol | undefined): RolChat | null =>
  rol === "CLIENTE" || rol === "FLETERO" ? rol : null;

/**
 * @param contactoVisible si es false, se ocultan teléfonos y emails del texto.
 * @param urls URLs firmadas de las fotos (ruta → url); las que falten no se muestran.
 */
export function aMensajeDto(
  m: MensajeCrudo,
  contactoVisible: boolean,
  urls: Map<string, string>,
): MensajeDto {
  const texto =
    m.tipo === "SISTEMA"
      ? textoEvento(m.evento, m.datos)
      : m.contenido && !contactoVisible
        ? ocultarContacto(m.contenido)
        : m.contenido;
  return {
    id: m.id,
    clientId: m.clientId,
    tipo: m.tipo,
    autorRol: comoRolChat(m.autor?.rol),
    texto,
    fotos: m.fotos.flatMap(({ ruta, ...f }) => {
      const url = urls.get(ruta);
      return url ? [{ ...f, url }] : [];
    }),
    propuesta: m.propuesta
      ? {
          id: m.propuesta.id,
          fecha: fechaIsoDeDia(m.propuesta.fecha),
          franja: m.propuesta.franja,
          estado: m.propuesta.estado,
          propuestaPorRol: comoRolChat(m.propuesta.propuestaPor.rol) ?? "CLIENTE",
        }
      : null,
    creadoEn: m.createdAt.toISOString(),
    cursor: codificarCursor({ createdAt: m.createdAt, id: m.id }),
  };
}

export const rutasDeFotos = (mensajes: MensajeCrudo[]) => mensajes.flatMap((m) => m.fotos.map((f) => f.ruta));
