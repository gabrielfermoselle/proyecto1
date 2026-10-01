import "server-only";
import { ordenarTurnos } from "@/domain/agenda";
import { fechaIsoAr } from "@/domain/fechas";
import { calcularMetricas } from "@/domain/metricas";
import { getAgenda } from "@/features/fleteros/fletes/queries";
import { consultaConteosFeed } from "@/features/fleteros/solicitudes/consultas-sql";
import { prisma } from "@/lib/prisma";

export async function getPanelFletero(fleteroId: string) {
  const hoy = fechaIsoAr();
  const [fletes, presupuestos, perfil, agenda, conteos] = await Promise.all([
    prisma.flete.findMany({
      where: { fleteroId },
      select: { etapa: true, precioAcordado: true, recepcionConfirmadaEn: true },
    }),
    prisma.presupuesto.findMany({ where: { fleteroId }, select: { estado: true } }),
    prisma.fleteroProfile.findUniqueOrThrow({
      where: { id: fleteroId },
      select: { ratingPromedio: true, cantidadCalificaciones: true, disponible: true },
    }),
    getAgenda(fleteroId),
    prisma.$queryRaw<{ nuevas: number }[]>(consultaConteosFeed({ fleteroId, hoy })),
  ]);

  const metricas = calcularMetricas(
    fletes.map((f) => ({
      etapa: f.etapa,
      precioAcordado: f.precioAcordado.toNumber(),
      completadoEn: f.recepcionConfirmadaEn,
    })),
    presupuestos.map((p) => p.estado),
  );

  return {
    metricas,
    rating: perfil.ratingPromedio.toNumber(),
    cantidadCalificaciones: perfil.cantidadCalificaciones,
    disponible: perfil.disponible,
    solicitudesNuevas: conteos[0]?.nuevas ?? 0,
    proximos: ordenarTurnos(agenda.turnos.filter((t) => t.fecha >= hoy)).slice(0, 3),
    enConflicto: agenda.enConflicto,
  };
}
