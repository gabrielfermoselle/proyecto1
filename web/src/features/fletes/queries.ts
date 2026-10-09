import "server-only";
import { contactoVisible } from "@/domain/chat";
import type { EstadoInicialItem, EtapaFlete, ResultadoControl, Rol } from "@prisma/client";
import {
  esEtapaEnMovimiento,
  pasosDelCiclo,
  resumenInventario,
  type EtapaCiclo,
  type ResumenInventario,
} from "@/domain/ciclo-flete";
import { fechaIsoDeDia } from "@/domain/fechas";
import { perfilChat } from "@/features/chat/acceso";
import type { RolChat } from "@/features/chat/dto";
import { urlsFirmadas } from "@/features/uploads/storage";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";
import type { UsuarioActual } from "@/lib/session";
import { aItemControlado, controlesPorFase } from "./inventario";

// Detalle de un flete para cualquiera de sus participantes: lo usan la gestión del fletero,
// el seguimiento del cliente y el comprobante PDF. Si no participa, el flete "no existe".

export interface FotoDto {
  id: string;
  url: string;
  ancho: number | null;
  alto: number | null;
}

export interface ControlDto {
  resultado: ResultadoControl;
  observacion: string | null;
  fecha: Date;
  fotos: FotoDto[];
}

export interface ItemDto {
  id: string;
  nombre: string;
  cantidad: number;
  fragil: boolean;
  notas: string | null;
  estadoInicial: EstadoInicialItem;
  fotos: FotoDto[];
  carga: ControlDto | null;
  descarga: ControlDto | null;
  recepcion: ControlDto | null;
  reclamo: {
    descripcion: string;
    estado: string;
    fecha: Date;
    fotos: FotoDto[];
    resolucion: string | null;
    resueltoEn: Date | null;
  } | null;
}

interface FotoFila {
  id: string;
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

const SELECT_FOTO = { select: { id: true, ruta: true, ancho: true, alto: true } } as const;

const SELECT_LUGAR = {
  origenDireccion: true,
  origenLat: true,
  origenLng: true,
  origenPiso: true,
  origenAscensor: true,
  destinoDireccion: true,
  destinoLat: true,
  destinoLng: true,
  destinoPiso: true,
  destinoAscensor: true,
} as const;

const comoRol = (rol: Rol): RolChat => (rol === "CLIENTE" ? "CLIENTE" : "FLETERO");

/**
 * Detalle del flete para una de sus partes, por su id o por el de su solicitud (así la página del
 * pedido lo pide en paralelo con la solicitud). `null` si no existe o no participa.
 */
export async function getFleteDetalle(
  ref: string | { solicitudId: string },
  usuario: UsuarioActual,
  { firmarFotos = true }: { firmarFotos?: boolean } = {},
) {
  const perfil = perfilChat(usuario);
  if (!perfil) return null;
  const f = await prisma.flete.findFirst({
    where: {
      ...(typeof ref === "string" ? { id: ref } : { solicitudId: ref.solicitudId }),
      ...(perfil.rol === "CLIENTE" ? { clienteId: perfil.perfilId } : { fleteroId: perfil.perfilId }),
    },
    select: {
      id: true,
      etapa: true,
      precioAcordado: true,
      createdAt: true,
      fleteroId: true,
      vehiculo: { select: { marca: true, modelo: true, tipo: true, patente: true } },
      presupuesto: { select: { incluyeAyudantes: true } },
      calificacion: { select: { puntaje: true, comentario: true, createdAt: true } },
      fletero: { select: { user: { select: { nombre: true, apellido: true, telefono: true } } } },
      historial: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          etapa: true,
          createdAt: true,
          nota: true,
          lat: true,
          lng: true,
          precisionM: true,
          autor: { select: { rol: true } },
        },
      },
      conformidades: {
        orderBy: { aceptadaEn: "asc" },
        select: {
          rol: true,
          texto: true,
          aceptadaEn: true,
          user: { select: { nombre: true, apellido: true } },
        },
      },
      controles: {
        select: {
          itemId: true,
          fase: true,
          resultado: true,
          observacion: true,
          updatedAt: true,
          fotos: SELECT_FOTO,
        },
      },
      reclamos: {
        select: {
          itemId: true,
          descripcion: true,
          estado: true,
          createdAt: true,
          resolucion: true,
          resueltoEn: true,
          fotos: SELECT_FOTO,
        },
      },
      solicitud: {
        select: {
          id: true,
          titulo: true,
          descripcion: true,
          tipoFlete: true,
          fecha: true,
          franja: true,
          createdAt: true,
          ...SELECT_LUGAR,
          cliente: { select: { user: { select: { nombre: true, apellido: true, telefono: true } } } },
          items: {
            orderBy: { orden: "asc" },
            select: {
              id: true,
              nombre: true,
              cantidad: true,
              fragil: true,
              notas: true,
              estadoInicial: true,
              fotos: SELECT_FOTO,
            },
          },
        },
      },
    },
  });
  if (!f) return null;
  const s = f.solicitud;

  const [primerPresupuesto, conversacion] = await Promise.all([
    prisma.presupuesto.findFirst({
      where: { solicitudId: s.id },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.conversacion.findUnique({
      where: { solicitudId_fleteroId: { solicitudId: s.id, fleteroId: f.fleteroId } },
      select: { id: true },
    }),
  ]);

  // Fotos privadas: URLs firmadas en una sola llamada (el PDF no las necesita).
  const todasLasFotos: FotoFila[] = [
    ...s.items.flatMap((i) => i.fotos),
    ...f.controles.flatMap((c) => c.fotos),
    ...f.reclamos.flatMap((r) => r.fotos),
  ];
  const urls = firmarFotos ? await urlsFirmadas(todasLasFotos.map((x) => x.ruta)) : new Map<string, string>();
  const fotos = (filas: FotoFila[]): FotoDto[] =>
    filas.flatMap(({ ruta, ...x }) => {
      const url = urls.get(ruta);
      return url ? [{ ...x, url }] : [];
    });

  const items: ItemDto[] = s.items.map((i) => {
    const propios = f.controles.filter((c) => c.itemId === i.id);
    const porFase = controlesPorFase(propios);
    const dto = (c: (typeof propios)[number] | null): ControlDto | null =>
      c
        ? { resultado: c.resultado, observacion: c.observacion, fecha: c.updatedAt, fotos: fotos(c.fotos) }
        : null;
    const reclamo = f.reclamos.find((r) => r.itemId === i.id);
    return {
      id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      fragil: i.fragil,
      notas: i.notas,
      estadoInicial: i.estadoInicial,
      fotos: fotos(i.fotos),
      carga: dto(porFase.carga),
      descarga: dto(porFase.descarga),
      recepcion: dto(porFase.recepcion),
      reclamo: reclamo
        ? {
            descripcion: reclamo.descripcion,
            estado: reclamo.estado,
            fecha: reclamo.createdAt,
            fotos: fotos(reclamo.fotos),
            resolucion: reclamo.resolucion,
            resueltoEn: reclamo.resueltoEn,
          }
        : null,
    };
  });
  const resumen: ResumenInventario = resumenInventario(
    s.items.map((i) =>
      aItemControlado(
        i.id,
        f.controles.filter((c) => c.itemId === i.id),
      ),
    ),
  );

  // Hora de cada etapa: la primera vez que se llegó (el historial está en orden).
  const fechas: Partial<Record<EtapaCiclo, Date>> = { SOLICITADO: s.createdAt };
  if (primerPresupuesto) fechas.PRESUPUESTADO = primerPresupuesto.createdAt;
  for (const h of f.historial) fechas[h.etapa] ??= h.createdAt;

  const historial = f.historial.map((h) => ({
    id: h.id,
    etapa: h.etapa,
    fecha: h.createdAt,
    nota: h.nota,
    porRol: comoRol(h.autor.rol),
    ubicacion: h.lat !== null && h.lng !== null ? { lat: h.lat, lng: h.lng, precisionM: h.precisionM } : null,
  }));
  const ultimaConUbicacion = historial.findLast((h) => h.ubicacion);
  const cancelacion = historial.find((h) => h.etapa === "CANCELADO") ?? null;

  const cliente = nombrePublico(s.cliente.user.nombre, s.cliente.user.apellido);
  const fletero = nombrePublico(f.fletero.user.nombre, f.fletero.user.apellido);

  return {
    id: f.id,
    etapa: f.etapa as EtapaFlete,
    miRol: perfil.rol,
    fleteroId: f.fleteroId,
    cliente,
    fletero,
    contraparte: perfil.rol === "CLIENTE" ? fletero : cliente,
    /** Con el flete confirmado (y no cancelado) las partes pueden hablar por WhatsApp o teléfono. */
    telefonoContraparte: contactoVisible(f.etapa)
      ? ((perfil.rol === "CLIENTE" ? f.fletero.user.telefono : s.cliente.user.telefono) ?? null)
      : null,
    solicitudId: s.id,
    titulo: s.titulo,
    descripcion: s.descripcion,
    tipoFlete: s.tipoFlete,
    fecha: fechaIsoDeDia(s.fecha),
    franja: s.franja,
    confirmadoEn: f.createdAt,
    precioAcordado: f.precioAcordado.toNumber(),
    vehiculo: f.vehiculo,
    ayudantes: f.presupuesto.incluyeAyudantes,
    origen: {
      direccion: s.origenDireccion,
      lat: s.origenLat,
      lng: s.origenLng,
      piso: s.origenPiso,
      ascensor: s.origenAscensor,
    },
    destino: {
      direccion: s.destinoDireccion,
      lat: s.destinoLat,
      lng: s.destinoLng,
      piso: s.destinoPiso,
      ascensor: s.destinoAscensor,
    },
    pasos: pasosDelCiclo(f.etapa, fechas),
    historial,
    /** Solo mientras el fletero está en la calle: después no hace falta saber dónde está. */
    ultimaUbicacion:
      esEtapaEnMovimiento(f.etapa) && ultimaConUbicacion?.ubicacion
        ? { ...ultimaConUbicacion.ubicacion, fecha: ultimaConUbicacion.fecha }
        : null,
    cancelacion: cancelacion
      ? { fecha: cancelacion.fecha, nota: cancelacion.nota, porRol: cancelacion.porRol }
      : null,
    items,
    resumen,
    conformidades: f.conformidades.map((c) => ({
      rol: comoRol(c.rol),
      texto: c.texto,
      aceptadaEn: c.aceptadaEn,
      nombre: nombrePublico(c.user.nombre, c.user.apellido),
    })),
    calificacion: f.calificacion,
    conversacionId: conversacion?.id ?? null,
  };
}

export type FleteDetalle = NonNullable<Awaited<ReturnType<typeof getFleteDetalle>>>;

/** Fletes del cliente para su inicio: los en curso primero, después los últimos terminados. */
export async function getFletesDelCliente(clienteId: string) {
  const fletes = await prisma.flete.findMany({
    where: { clienteId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      etapa: true,
      precioAcordado: true,
      calificacion: { select: { id: true } },
      fletero: { select: { user: { select: { nombre: true, apellido: true } } } },
      solicitud: {
        select: { titulo: true, fecha: true, franja: true, origenDireccion: true, destinoDireccion: true },
      },
    },
  });
  return fletes.map((f) => ({
    id: f.id,
    etapa: f.etapa,
    precioAcordado: f.precioAcordado.toNumber(),
    calificado: f.calificacion !== null,
    fletero: nombrePublico(f.fletero.user.nombre, f.fletero.user.apellido),
    titulo: f.solicitud.titulo,
    fecha: fechaIsoDeDia(f.solicitud.fecha),
    franja: f.solicitud.franja,
    origen: f.solicitud.origenDireccion,
    destino: f.solicitud.destinoDireccion,
  }));
}
