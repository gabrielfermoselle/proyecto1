"use server";

import { z } from "zod";
import { createAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";

/** Marca como leídas las notificaciones indicadas (o todas). Solo las propias. */
export const marcarNotificacionesLeidas = createAction({
  schema: z.object({ ids: z.array(z.string().min(1).max(40)).max(100).optional() }),
  roles: ["CLIENTE", "FLETERO", "ADMIN"],
  handler: async ({ ids }, { usuario }) => {
    const { count } = await prisma.notificacion.updateMany({
      where: { userId: usuario.id, leidaEn: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { leidaEn: new Date() },
    });
    return { marcadas: count };
  },
});
