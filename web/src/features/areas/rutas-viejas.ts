import "server-only";
import { notFound, redirect } from "next/navigation";
import { hrefConversacion } from "@/features/chat/acceso-rutas";
import { perfilChat } from "@/features/chat/acceso";
import { hrefPedido } from "@/features/fletes/rutas";
import { db, fallar } from "@/lib/db";
import type { UsuarioActual } from "@/lib/session";

// Las rutas viejas por id de flete o de conversación (notificaciones guardadas, links compartidos)
// llevan al pedido o al chat nuevo. Solo si el usuario participa: si no, 404 como antes.

const delUsuario = (usuario: UsuarioActual) => {
  const perfil = perfilChat(usuario);
  if (!perfil) notFound();
  return {
    perfil,
    columna: perfil.rol === "CLIENTE" ? ("clienteId" as const) : ("fleteroId" as const),
  };
};

export async function redirigirFlete(fleteId: string, usuario: UsuarioActual): Promise<never> {
  const { perfil, columna } = delUsuario(usuario);
  const { data, error } = await db()
    .from("fletes")
    .select("solicitudId")
    .eq("id", fleteId)
    .eq(columna, perfil.perfilId)
    .maybeSingle();
  fallar(error);
  if (!data) notFound();
  redirect(hrefPedido(perfil.rol, data.solicitudId));
}

export async function redirigirConversacion(conversacionId: string, usuario: UsuarioActual): Promise<never> {
  const { perfil, columna } = delUsuario(usuario);
  const { data, error } = await db()
    .from("conversaciones")
    .select("solicitudId, fleteroId")
    .eq("id", conversacionId)
    .eq(columna, perfil.perfilId)
    .maybeSingle();
  fallar(error);
  if (!data) notFound();
  redirect(hrefConversacion(perfil.rol, data.solicitudId, data.fleteroId));
}
