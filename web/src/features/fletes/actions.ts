"use server";

import { revalidatePath } from "next/cache";
import type { EtapaFlete } from "@/domain/catalogos";
import { ACTOR_DE_FASE, FASE_DE_ETAPA } from "@/domain/ciclo-flete";
import { redondear } from "@/domain/geo";
import { perfilChat } from "@/features/chat/acceso";
import { BUCKET_PRIVADO, prepararSubida, rutaSubidaValida } from "@/features/uploads/storage";
import { ActionError, createAction, esViolacionUnica } from "@/lib/action";
import { db, fallar, nuevoId, numero } from "@/lib/db";
import { consumirLimite, LIMITES } from "@/lib/limite-tasa";
import type { UsuarioActual } from "@/lib/session";
import { configPublicaSupabase } from "@/lib/supabase";
import { patronPedido } from "./rutas";
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

// Las dos partes ven el cambio: cada una en su página del pedido.
function refrescar() {
  revalidatePath(patronPedido("CLIENTE"), "page");
  revalidatePath(patronPedido("FLETERO"), "page");
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
    refrescar();
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
    refrescar();
    return resultado;
  },
});

/** Reserva una ruta en el bucket privado para la foto de un control o un reclamo. */
export const prepararFotoFlete = createAction({
  schema: prepararFotoSchema,
  roles: ROLES,
  handler: async ({ fleteId }, { usuario }) => {
    const actor = actorDe(usuario);
    const columna = actor.rol === "CLIENTE" ? "clienteId" : "fleteroId";
    const { data: flete, error } = await db()
      .from("fletes")
      .select("etapa")
      .eq("id", fleteId)
      .eq(columna, actor.perfilId)
      .maybeSingle();
    fallar(error);
    if (!flete) throw new ActionError("No encontramos ese flete.");
    // Solo quien está registrando la fase actual puede sumar fotos.
    const fase = FASE_DE_ETAPA[flete.etapa as EtapaFlete];
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
    refrescar();
    return null;
  },
});

export const marcarTodos = createAction({
  schema: marcarTodosSchema,
  roles: ROLES,
  handler: async ({ fleteId, fase }, { usuario }) => {
    const actor = actorDe(usuario);
    const cantidad = await marcarTodosServicio({ fleteId, actor, fase });
    refrescar();
    return { cantidad };
  },
});

export const quitarControl = createAction({
  schema: quitarControlSchema,
  roles: ROLES,
  handler: async ({ fleteId, itemId, fase }, { usuario }) => {
    const actor = actorDe(usuario);
    await quitarControlServicio({ fleteId, actor, itemId, fase });
    refrescar();
    return null;
  },
});

/** Una calificación por flete, solo del cliente y con el flete cerrado. */
export const calificarFlete = createAction({
  schema: calificarSchema,
  roles: ["CLIENTE"],
  handler: async ({ fleteId, puntaje, comentario }, { usuario }) => {
    const actor = actorDe(usuario);
    const { data: flete, error: errorFlete } = await db()
      .from("fletes")
      .select("etapa, fleteroId")
      .eq("id", fleteId)
      .eq("clienteId", actor.perfilId)
      .maybeSingle();
    fallar(errorFlete);
    if (!flete) throw new ActionError("No encontramos ese flete.");
    if (flete.etapa !== "CERRADO") throw new ActionError("Vas a poder calificar cuando cierres el flete.");
    try {
      const { error: errorCalificacion } = await db().from("calificaciones").insert({
        id: nuevoId(),
        fleteId,
        clienteId: actor.perfilId,
        fleteroId: flete.fleteroId,
        puntaje,
        comentario,
      });
      if (errorCalificacion) throw errorCalificacion;
      // El promedio vive desnormalizado en el perfil (feed, búsqueda y perfil público lo leen).
      const { data: notas, error: errorNotas } = await db()
        .from("calificaciones")
        .select("puntaje")
        .eq("fleteroId", flete.fleteroId as string);
      fallar(errorNotas);
      const puntajes = (notas ?? []).map((n) => numero(n.puntaje));
      const promedio = puntajes.length ? redondear(puntajes.reduce((suma, n) => suma + n, 0) / puntajes.length, 2) : 0;
      const { error: errorPerfil } = await db()
        .from("perfiles_fletero")
        .update({ ratingPromedio: promedio, cantidadCalificaciones: puntajes.length })
        .eq("id", flete.fleteroId as string);
      fallar(errorPerfil);
    } catch (error) {
      if (esViolacionUnica(error)) throw new ActionError("Ya calificaste este flete.");
      throw error;
    }
    refrescar();
    revalidatePath(`/fleteros/${flete.fleteroId}`);
    return null;
  },
});
