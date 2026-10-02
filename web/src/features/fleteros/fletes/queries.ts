import "server-only";
import { idsEnConflicto } from "@/domain/agenda";
import { fechaIsoDeDia } from "@/domain/fechas";
import { ETAPAS_ACTIVAS } from "@/domain/maquina-estados";
import { nombrePublico } from "@/lib/formato";
import { prisma } from "@/lib/prisma";

/** Fletes en curso del fletero como turnos de agenda (fecha + franja). */
export async function getTurnosActivos(fleteroId: string) {
  const fletes = await prisma.flete.findMany({
    where: { fleteroId, etapa: { in: [...ETAPAS_ACTIVAS] } },
    select: {
      id: true,
      etapa: true,
      precioAcordado: true,
      solicitudId: true,
      vehiculo: { select: { marca: true, modelo: true, tipo: true } },
      solicitud: {
        select: {
          titulo: true,
          tipoFlete: true,
          fecha: true,
          franja: true,
          origenDireccion: true,
          destinoDireccion: true,
        },
      },
    },
  });
  return fletes.map((f) => ({
    id: f.id,
    solicitudId: f.solicitudId,
    etapa: f.etapa,
    precioAcordado: f.precioAcordado.toNumber(),
    titulo: f.solicitud.titulo,
    tipoFlete: f.solicitud.tipoFlete,
    fecha: fechaIsoDeDia(f.solicitud.fecha),
    franja: f.solicitud.franja,
    origen: f.solicitud.origenDireccion,
    destino: f.solicitud.destinoDireccion,
    vehiculo: `${f.vehiculo.marca} ${f.vehiculo.modelo}`,
    tipoVehiculo: f.vehiculo.tipo,
  }));
}

export type TurnoAgenda = Awaited<ReturnType<typeof getTurnosActivos>>[number];

export async function getAgenda(fleteroId: string) {
  const turnos = await getTurnosActivos(fleteroId);
  return { turnos, enConflicto: idsEnConflicto(turnos) };
}

/** Detalle de un flete del fletero, o `null` si no es suyo (la página responde 404). */
export async function getFleteParaFletero(fleteroId: string, fleteId: string) {
  const f = await prisma.flete.findFirst({
    where: { id: fleteId, fleteroId },
    select: {
      id: true,
      etapa: true,
      precioAcordado: true,
      recepcionConfirmadaEn: true,
      vehiculo: { select: { marca: true, modelo: true, tipo: true, patente: true } },
      presupuesto: { select: { incluyeAyudantes: true } },
      calificacion: { select: { puntaje: true, comentario: true } },
      historial: {
        orderBy: { createdAt: "asc" },
        select: { id: true, etapa: true, createdAt: true, nota: true, autor: { select: { rol: true } } },
      },
      solicitud: {
        select: {
          id: true,
          titulo: true,
          descripcion: true,
          tipoFlete: true,
          fecha: true,
          franja: true,
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
          cliente: { select: { user: { select: { nombre: true, apellido: true } } } },
          items: {
            orderBy: { orden: "asc" },
            select: {
              id: true,
              nombre: true,
              cantidad: true,
              fragil: true,
              notas: true,
              cargadoEn: true,
              descargadoEn: true,
            },
          },
        },
      },
    },
  });
  if (!f) return null;
  const conversacion = await prisma.conversacion.findUnique({
    where: { solicitudId_fleteroId: { solicitudId: f.solicitud.id, fleteroId } },
    select: { id: true },
  });

  const { solicitud: s } = f;
  return {
    id: f.id,
    etapa: f.etapa,
    precioAcordado: f.precioAcordado.toNumber(),
    recepcionConfirmadaEn: f.recepcionConfirmadaEn,
    vehiculo: f.vehiculo,
    ayudantes: f.presupuesto.incluyeAyudantes,
    calificacion: f.calificacion,
    historial: f.historial.map((h) => ({
      id: h.id,
      etapa: h.etapa,
      fecha: h.createdAt,
      nota: h.nota,
      porCliente: h.autor.rol === "CLIENTE",
    })),
    solicitudId: s.id,
    titulo: s.titulo,
    descripcion: s.descripcion,
    tipoFlete: s.tipoFlete,
    fecha: fechaIsoDeDia(s.fecha),
    franja: s.franja,
    cliente: nombrePublico(s.cliente.user.nombre, s.cliente.user.apellido),
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
    items: s.items,
    conversacionId: conversacion?.id ?? null,
  };
}

export type FleteParaFletero = NonNullable<Awaited<ReturnType<typeof getFleteParaFletero>>>;
