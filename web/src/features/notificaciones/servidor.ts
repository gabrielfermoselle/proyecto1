import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { esViolacionUnica } from "@/lib/action";
import { ahoraIso, fallar, nuevoId } from "@/lib/db";
import type { Publicacion } from "@/lib/supabase";

export type TipoNotificacion = "MENSAJE" | "PRESUPUESTO" | "FLETE" | "PROPUESTA";

export interface NuevaNotificacion {
  userId: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo?: string | null;
  href: string;
  /** Si viene, reemplaza a la notificación anterior con la misma clave (y la vuelve a marcar no leída). */
  clave?: string;
}

const recortar = (texto: string, largo: number) =>
  texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;

export async function notificar(tx: SupabaseClient, n: NuevaNotificacion): Promise<Publicacion[]> {
  const datos = {
    tipo: n.tipo,
    titulo: recortar(n.titulo, 120),
    cuerpo: n.cuerpo ? recortar(n.cuerpo, 300) : null,
    href: n.href,
    leidaEn: null,
    updatedAt: ahoraIso(),
  };
  if (n.clave) {
    const { data: previa, error: errorPrevia } = await tx
      .from("notificaciones")
      .select("id")
      .eq("userId", n.userId)
      .eq("clave", n.clave)
      .maybeSingle();
    fallar(errorPrevia);
    // El id se reutiliza: el upsert por (userId, clave) no debe cambiar la clave primaria.
    const { error } = await tx.from("notificaciones").upsert(
      { id: (previa?.id as string | undefined) ?? nuevoId(), userId: n.userId, clave: n.clave, ...datos },
      { onConflict: "userId,clave" },
    );
    if (esViolacionUnica(error)) {
      const { error: errorUpdate } = await tx
        .from("notificaciones")
        .update(datos)
        .eq("userId", n.userId)
        .eq("clave", n.clave);
      fallar(errorUpdate);
    } else {
      fallar(error);
    }
  } else {
    const { error } = await tx.from("notificaciones").insert({ id: nuevoId(), userId: n.userId, ...datos });
    fallar(error);
  }
  return [{ topic: `usuario:${n.userId}`, event: "notificacion.creada", payload: {} }];
}
