"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hrefPedido, topicFlete } from "@/features/fletes/rutas";
import { ActionError, createAction } from "@/lib/action";
import { ahoraIso, db, fallar, nuevoId, relacion } from "@/lib/db";
import { publicar, type Publicacion } from "@/lib/supabase";

const id = z.string().min(1).max(40);
const SOLO_ADMIN = ["ADMIN"] as const;

const recortar = (texto: string, largo: number) =>
  texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;

function uno<T>(valor: T | T[] | null | undefined): T {
  const fila = relacion(valor);
  if (!fila) throw new Error("Falta un dato relacionado");
  return fila;
}

/** Misma notificación que armaba `notificar` sin clave: un insert y el aviso de realtime. */
async function avisarResolucion(
  userId: string,
  titulo: string,
  cuerpo: string,
  href: string,
): Promise<Publicacion> {
  const { error } = await db()
    .from("notificaciones")
    .insert({
      id: nuevoId(),
      userId,
      tipo: "FLETE",
      titulo: recortar(titulo, 120),
      cuerpo: recortar(cuerpo, 300),
      href,
      leidaEn: null,
      updatedAt: ahoraIso(),
    });
  fallar(error);
  return { topic: `usuario:${userId}`, event: "notificacion.creada", payload: {} };
}

/** Activa o desactiva una cuenta. Desactivada, la sesión se corta en el próximo request. */
export const cambiarEstadoUsuario = createAction({
  schema: z.object({ userId: id, activo: z.boolean() }),
  roles: SOLO_ADMIN,
  handler: async ({ userId, activo }, { usuario }) => {
    if (userId === usuario.id) throw new ActionError("No podés desactivar tu propia cuenta.");
    const { data, error } = await db()
      .from("usuarios")
      .update({ activo, updatedAt: ahoraIso() })
      // Otro admin no se desactiva desde acá: evita quedarse sin administradores por error.
      .eq("id", userId)
      .neq("rol", "ADMIN")
      .select("id");
    fallar(error);
    if (!data?.length) throw new ActionError("No encontramos esa cuenta o no se puede modificar.");
    revalidatePath("/admin", "layout");
    return { activo };
  },
});

/** La marca de verificado aparece en el perfil público, el buscador y los presupuestos. */
export const verificarFletero = createAction({
  schema: z.object({ fleteroId: id, verificado: z.boolean() }),
  roles: SOLO_ADMIN,
  handler: async ({ fleteroId, verificado }) => {
    const { data, error } = await db()
      .from("perfiles_fletero")
      .update({ verificado })
      .eq("id", fleteroId)
      .not("onboardingCompletadoEn", "is", null)
      .select("id");
    fallar(error);
    if (!data?.length) throw new ActionError("Solo se verifican fleteros con el perfil completo.");
    revalidatePath("/admin", "layout");
    revalidatePath(`/fleteros/${fleteroId}`);
    return { verificado };
  },
});

interface ReclamoParaAvisar {
  items_inventario: { nombre: string } | { nombre: string }[] | null;
  fletes:
    | {
        id: string;
        solicitudId: string;
        perfiles_cliente: { userId: string } | { userId: string }[] | null;
        perfiles_fletero: { userId: string } | { userId: string }[] | null;
      }
    | {
        id: string;
        solicitudId: string;
        perfiles_cliente: { userId: string } | { userId: string }[] | null;
        perfiles_fletero: { userId: string } | { userId: string }[] | null;
      }[]
    | null;
}

/** Cierra un reclamo con una resolución que les llega al cliente y al fletero. */
export const resolverReclamo = createAction({
  schema: z.object({
    reclamoId: id,
    resolucion: z.string().trim().min(10, "Explicá la resolución (al menos 10 caracteres)").max(500),
  }),
  roles: SOLO_ADMIN,
  handler: async ({ reclamoId, resolucion }, { usuario }) => {
    const publicaciones: Publicacion[] = [];
    const { data: actualizados, error: errorUpdate } = await db()
      .from("reclamos")
      .update({
        estado: "RESUELTO",
        resolucion,
        resueltoEn: ahoraIso(),
        resueltoPorId: usuario.id,
      })
      .eq("id", reclamoId)
      .eq("estado", "ABIERTO")
      .select("id");
    fallar(errorUpdate);
    if (!actualizados?.length) throw new ActionError("Ese reclamo ya fue resuelto.");

    const { data, error: errorReclamo } = await db()
      .from("reclamos")
      .select(
        `items_inventario (nombre),
        fletes (
          id, solicitudId,
          perfiles_cliente (userId),
          perfiles_fletero (userId)
        )`,
      )
      .eq("id", reclamoId)
      .maybeSingle();
    fallar(errorReclamo);
    const reclamo = data as ReclamoParaAvisar | null;
    if (!reclamo) throw new Error("Falta un dato relacionado");
    const item = uno(reclamo.items_inventario);
    const flete = uno(reclamo.fletes);
    for (const [rol, userId] of [
      ["CLIENTE", uno(flete.perfiles_cliente).userId],
      ["FLETERO", uno(flete.perfiles_fletero).userId],
    ] as const) {
      publicaciones.push(
        await avisarResolucion(
          userId,
          `Se resolvió el reclamo por «${item.nombre}»`,
          resolucion,
          hrefPedido(rol, flete.solicitudId),
        ),
      );
    }
    publicaciones.push({
      topic: topicFlete(flete.id),
      event: "flete.actualizado",
      payload: { motivo: "reclamo" },
    });
    await publicar(publicaciones);
    revalidatePath("/admin", "layout");
    return null;
  },
});
