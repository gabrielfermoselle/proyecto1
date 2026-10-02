// Forma en la que un mensaje viaja al navegador (respuesta de una acción, página o aviso en
// vivo). Es neutral respecto de quién lo mira: lleva el rol del autor y cada cliente decide si
// es propio. El texto ya viene con los datos de contacto ocultos si corresponde.

import type { EstadoPropuesta, FranjaHoraria, Rol, TipoMensaje } from "@prisma/client";
import { ocultarContacto } from "@/domain/chat";
import { fechaIsoDeDia } from "@/domain/fechas";
import { codificarCursor } from "./cursor";
import { textoEvento } from "./eventos-catalogo";

export type RolChat = Extract<Rol, "CLIENTE" | "FLETERO">;

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

/** Lo que hay que pedirle a Prisma para armar un MensajeDto. */
export const SELECT_MENSAJE = {
  id: true,
  clientId: true,
  tipo: true,
  contenido: true,
  evento: true,
  datos: true,
  createdAt: true,
  autor: { select: { rol: true } },
  fotos: { select: { id: true, ruta: true, ancho: true, alto: true } },
  propuesta: {
    select: { id: true, fecha: true, franja: true, estado: true, propuestaPor: { select: { rol: true } } },
  },
} as const;

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
