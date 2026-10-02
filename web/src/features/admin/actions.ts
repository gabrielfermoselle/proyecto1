"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hrefFlete, topicFlete } from "@/features/fletes/rutas";
import { notificar } from "@/features/notificaciones/servidor";
import { ActionError, createAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { publicar, type Publicacion } from "@/lib/supabase";

const id = z.string().min(1).max(40);
const SOLO_ADMIN = ["ADMIN"] as const;

/** Activa o desactiva una cuenta. Desactivada, la sesión se corta en el próximo request. */
export const cambiarEstadoUsuario = createAction({
  schema: z.object({ userId: id, activo: z.boolean() }),
  roles: SOLO_ADMIN,
  handler: async ({ userId, activo }, { usuario }) => {
    if (userId === usuario.id) throw new ActionError("No podés desactivar tu propia cuenta.");
    const { count } = await prisma.user.updateMany({
      // Otro admin no se desactiva desde acá: evita quedarse sin administradores por error.
      where: { id: userId, rol: { not: "ADMIN" } },
      data: { activo },
    });
    if (count === 0) throw new ActionError("No encontramos esa cuenta o no se puede modificar.");
    revalidatePath("/admin", "layout");
    return { activo };
  },
});

/** La marca de verificado aparece en el perfil público, el buscador y los presupuestos. */
export const verificarFletero = createAction({
  schema: z.object({ fleteroId: id, verificado: z.boolean() }),
  roles: SOLO_ADMIN,
  handler: async ({ fleteroId, verificado }) => {
    const { count } = await prisma.fleteroProfile.updateMany({
      where: { id: fleteroId, onboardingCompletadoEn: { not: null } },
      data: { verificado },
    });
    if (count === 0) throw new ActionError("Solo se verifican fleteros con el perfil completo.");
    revalidatePath("/admin", "layout");
    revalidatePath(`/fleteros/${fleteroId}`);
    return { verificado };
  },
});

/** Cierra un reclamo con una resolución que les llega al cliente y al fletero. */
export const resolverReclamo = createAction({
  schema: z.object({
    reclamoId: id,
    resolucion: z.string().trim().min(10, "Explicá la resolución (al menos 10 caracteres)").max(500),
  }),
  roles: SOLO_ADMIN,
  handler: async ({ reclamoId, resolucion }, { usuario }) => {
    const publicaciones: Publicacion[] = [];
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.reclamo.updateMany({
        where: { id: reclamoId, estado: "ABIERTO" },
        data: { estado: "RESUELTO", resolucion, resueltoEn: new Date(), resueltoPorId: usuario.id },
      });
      if (count === 0) throw new ActionError("Ese reclamo ya fue resuelto.");
      const reclamo = await tx.reclamo.findUniqueOrThrow({
        where: { id: reclamoId },
        select: {
          item: { select: { nombre: true } },
          flete: {
            select: {
              id: true,
              cliente: { select: { userId: true } },
              fletero: { select: { userId: true } },
            },
          },
        },
      });
      const { flete } = reclamo;
      for (const [rol, userId] of [
        ["CLIENTE", flete.cliente.userId],
        ["FLETERO", flete.fletero.userId],
      ] as const) {
        publicaciones.push(
          ...(await notificar(tx, {
            userId,
            tipo: "FLETE",
            titulo: `Se resolvió el reclamo por «${reclamo.item.nombre}»`,
            cuerpo: resolucion,
            href: hrefFlete(rol, flete.id),
          })),
        );
      }
      publicaciones.push({
        topic: topicFlete(flete.id),
        event: "flete.actualizado",
        payload: { motivo: "reclamo" },
      });
    });
    await publicar(publicaciones);
    revalidatePath("/admin", "layout");
    return null;
  },
});
