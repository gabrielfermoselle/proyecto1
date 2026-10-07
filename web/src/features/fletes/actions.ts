"use server";

import { revalidatePath } from "next/cache";
import { ACTOR_DE_FASE, FASE_DE_ETAPA } from "@/domain/ciclo-flete";
import { redondear } from "@/domain/geo";
import { perfilChat } from "@/features/chat/acceso";
import { BUCKET_PRIVADO, prepararSubida, rutaSubidaValida } from "@/features/uploads/storage";
import { ActionError, createAction, esViolacionUnica } from "@/lib/action";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import { prisma } from "@/lib/prisma";
import type { UsuarioActual } from "@/lib/session";
import { configPublicaSupabase } from "@/lib/supabase";
import { hrefFlete } from "./rutas";
import {
  avanzarEtapaSchema,
  calificarSchema,
  cancelarFleteSchema,
  marcarTodosSchema,
  prepararFotoSchema,
  quitarControlSchema,
  registrarControlSchema,
} from "./schemas";
import {
  marcarTodos as marcarTodosServicio,
  quitarControl as quitarControlServicio,
  registrarControl as registrarControlServicio,
  transicionar,
  type ActorFlete,
} from "./servicio";

// Acciones del flete para las dos partes. Toda la lógica está en el servicio; acá se
// identifica al actor, se validan las fotos contra el bucket y se refresca la página.

const ROLES = ["CLIENTE", "FLETERO"] as const;

function actorDe(usuario: UsuarioActual): ActorFlete {
  const perfil = perfilChat(usuario);
  if (!perfil) throw new ActionError("No encontramos tu perfil.");
  return { rol: perfil.rol, userId: usuario.id, perfilId: perfil.perfilId };
}

function refrescar(actor: ActorFlete, fleteId: string) {
  revalidatePath(hrefFlete(actor.rol, fleteId));
}

const carpetaFotos = (fleteId: string, userId: string) => `fletes/${fleteId}/${userId}`;

export const avanzarEtapa = createAction({
  schema: avanzarEtapaSchema,
  roles: ROLES,
  handler: async ({ fleteId, hacia, ubicacion, conformidad }, { usuario }) => {
    if (hacia === "CANCELADO") throw new ActionError("Para cancelar, indicá el motivo.");
    const actor = actorDe(usuario);
    const resultado = await transicionar({
      fleteId,
      actor,
      hacia,
      ubicacion: ubicacion ?? null,
      conformidad: conformidad ?? false,
    });
    refrescar(actor, fleteId);
    return resultado;
  },
});

export const cancelarFlete = createAction({
  schema: cancelarFleteSchema,
  roles: ROLES,
  handler: async ({ fleteId, motivo, ubicacion }, { usuario }) => {
    const actor = actorDe(usuario);
    const resultado = await transicionar({
      fleteId,
      actor,
      hacia: "CANCELADO",
      motivo,
      ubicacion: ubicacion ?? null,
    });
    refrescar(actor, fleteId);
    return resultado;
  },
});

/** Reserva una ruta en el bucket privado para la foto de un control o un reclamo. */
export const prepararFotoFlete = createAction({
  schema: prepararFotoSchema,
  roles: ROLES,
  handler: async ({ fleteId }, { usuario }) => {
    const actor = actorDe(usuario);
    const flete = await prisma.flete.findFirst({
      where: {
        id: fleteId,
        ...(actor.rol === "CLIENTE" ? { clienteId: actor.perfilId } : { fleteroId: actor.perfilId }),
      },
      select: { etapa: true },
    });
    if (!flete) throw new ActionError("No encontramos ese flete.");
    // Solo quien está registrando la fase actual puede sumar fotos.
    const fase = FASE_DE_ETAPA[flete.etapa];
    if (!fase || ACTOR_DE_FASE[fase] !== actor.rol) throw new ActionError("En esta etapa no se suben fotos.");
    await consumirLimite(LIMITES.imagenes(usuario.id));
    const subida = await prepararSubida(BUCKET_PRIVADO, carpetaFotos(fleteId, usuario.id));
    const storage = configPublicaSupabase();
    if (!subida || !storage) throw new ActionError("La carga de fotos todavía no está habilitada.");
    return { subida, storage };
  },
});

export const registrarControl = createAction({
  schema: registrarControlSchema,
  roles: ROLES,
  handler: async ({ fleteId, itemId, fase, resultado, observacion, foto }, { usuario }) => {
    const actor = actorDe(usuario);
    // Solo una foto que este usuario subió a este flete y que existe de verdad.
    if (foto && !(await rutaSubidaValida(BUCKET_PRIVADO, foto.ruta, carpetaFotos(fleteId, usuario.id)))) {
      throw new ActionError("No pudimos verificar la foto. Probá de nuevo.");
    }
    try {
      await registrarControlServicio({
        fleteId,
        actor,
        itemId,
        fase,
        resultado,
        observacion,
        foto: foto ?? null,
      });
    } catch (error) {
      // Dos registros simultáneos del mismo ítem (doble toque): el segundo choca con el índice único.
      if (esViolacionUnica(error))
        throw new ActionError("Ese ítem se acaba de actualizar. Recargá la página.");
      throw error;
    }
    refrescar(actor, fleteId);
    return null;
  },
});

export const marcarTodos = createAction({
  schema: marcarTodosSchema,
  roles: ROLES,
  handler: async ({ fleteId, fase }, { usuario }) => {
    const actor = actorDe(usuario);
    const cantidad = await marcarTodosServicio({ fleteId, actor, fase });
    refrescar(actor, fleteId);
    return { cantidad };
  },
});

export const quitarControl = createAction({
  schema: quitarControlSchema,
  roles: ROLES,
  handler: async ({ fleteId, itemId, fase }, { usuario }) => {
    const actor = actorDe(usuario);
    await quitarControlServicio({ fleteId, actor, itemId, fase });
    refrescar(actor, fleteId);
    return null;
  },
});

/** Una calificación por flete, solo del cliente y con el flete cerrado. */
export const calificarFlete = createAction({
  schema: calificarSchema,
  roles: ["CLIENTE"],
  handler: async ({ fleteId, puntaje, comentario }, { usuario }) => {
    const actor = actorDe(usuario);
    const flete = await prisma.flete.findFirst({
      where: { id: fleteId, clienteId: actor.perfilId },
      select: { etapa: true, fleteroId: true },
    });
    if (!flete) throw new ActionError("No encontramos ese flete.");
    if (flete.etapa !== "CERRADO") throw new ActionError("Vas a poder calificar cuando cierres el flete.");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.calificacion.create({
          data: { fleteId, clienteId: actor.perfilId, fleteroId: flete.fleteroId, puntaje, comentario },
        });
        // El promedio vive desnormalizado en el perfil (feed, búsqueda y perfil público lo leen).
        const { _avg, _count } = await tx.calificacion.aggregate({
          where: { fleteroId: flete.fleteroId },
          _avg: { puntaje: true },
          _count: true,
        });
        await tx.fleteroProfile.update({
          where: { id: flete.fleteroId },
          data: { ratingPromedio: redondear(_avg.puntaje ?? 0, 2), cantidadCalificaciones: _count },
        });
      });
    } catch (error) {
      if (esViolacionUnica(error)) throw new ActionError("Ya calificaste este flete.");
      throw error;
    }
    refrescar(actor, fleteId);
    revalidatePath(`/fleteros/${flete.fleteroId}`);
    return null;
  },
});
