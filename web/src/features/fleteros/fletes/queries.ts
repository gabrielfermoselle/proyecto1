import "server-only";
import { idsEnConflicto } from "@/domain/agenda";
import { fechaIsoDeDia } from "@/domain/fechas";
import { ETAPAS_ACTIVAS } from "@/domain/ciclo-flete";
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
