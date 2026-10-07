import "server-only";
import type { Prisma } from "@prisma/client";
import { direccionAproximada } from "@/domain/direccion";
import { fechaIsoDeDia } from "@/domain/fechas";
import { prisma } from "@/lib/prisma";

export const TABS_PRESUPUESTOS = ["pendientes", "aceptados", "historial"] as const;
export type TabPresupuestos = (typeof TABS_PRESUPUESTOS)[number];

function filtro(fleteroId: string, tab: TabPresupuestos, ahora: Date): Prisma.PresupuestoWhereInput {
  switch (tab) {
    case "pendientes":
      return { fleteroId, estado: "PENDIENTE", validoHasta: { gte: ahora } };
    case "aceptados":
      return { fleteroId, estado: "ACEPTADO" };
    case "historial":
      return {
        fleteroId,
        OR: [
          { estado: { in: ["RECHAZADO", "RETIRADO"] } },
          { estado: "PENDIENTE", validoHasta: { lt: ahora } },
        ],
      };
  }
}

export async function getMisPresupuestos(fleteroId: string, tab: TabPresupuestos) {
  const ahora = new Date();
  const [presupuestos, ...conteos] = await Promise.all([
    prisma.presupuesto.findMany({
      where: filtro(fleteroId, tab, ahora),
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        monto: true,
        estado: true,
        validoHasta: true,
        createdAt: true,
        flete: { select: { id: true } },
        solicitud: {
          select: {
            id: true,
            titulo: true,
            fecha: true,
            franja: true,
            origenDireccion: true,
            destinoDireccion: true,
          },
        },
      },
    }),
    ...TABS_PRESUPUESTOS.map((t) => prisma.presupuesto.count({ where: filtro(fleteroId, t, ahora) })),
  ]);

  return {
    presupuestos: presupuestos.map((p) => ({
      id: p.id,
      monto: p.monto.toNumber(),
      estado: p.estado,
      validoHasta: p.validoHasta,
      enviadoEn: p.createdAt,
      fleteId: p.flete?.id ?? null,
      solicitudId: p.solicitud.id,
      titulo: p.solicitud.titulo,
      fecha: fechaIsoDeDia(p.solicitud.fecha),
      franja: p.solicitud.franja,
      // El detalle exacto solo está en el flete; acá alcanza con la zona.
      zonaOrigen: direccionAproximada(p.solicitud.origenDireccion),
      zonaDestino: direccionAproximada(p.solicitud.destinoDireccion),
    })),
    conteos: Object.fromEntries(TABS_PRESUPUESTOS.map((t, i) => [t, conteos[i] ?? 0])) as Record<
      TabPresupuestos,
      number
    >,
  };
}
