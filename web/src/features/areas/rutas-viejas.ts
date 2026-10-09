import "server-only";
import { notFound, redirect } from "next/navigation";
import { hrefConversacion } from "@/features/chat/acceso-rutas";
import { perfilChat } from "@/features/chat/acceso";
import { hrefPedido } from "@/features/fletes/rutas";
import { prisma } from "@/lib/prisma";
import type { UsuarioActual } from "@/lib/session";

// Las rutas viejas por id de flete o de conversación (notificaciones guardadas, links compartidos)
// llevan al pedido o al chat nuevo. Solo si el usuario participa: si no, 404 como antes.

const delUsuario = (usuario: UsuarioActual) => {
  const perfil = perfilChat(usuario);
  if (!perfil) notFound();
  return {
    perfil,
    filtro: perfil.rol === "CLIENTE" ? { clienteId: perfil.perfilId } : { fleteroId: perfil.perfilId },
  };
};

export async function redirigirFlete(fleteId: string, usuario: UsuarioActual): Promise<never> {
  const { perfil, filtro } = delUsuario(usuario);
  const flete = await prisma.flete.findFirst({
    where: { id: fleteId, ...filtro },
    select: { solicitudId: true },
  });
  if (!flete) notFound();
  redirect(hrefPedido(perfil.rol, flete.solicitudId));
}

export async function redirigirConversacion(conversacionId: string, usuario: UsuarioActual): Promise<never> {
  const { perfil, filtro } = delUsuario(usuario);
  const c = await prisma.conversacion.findFirst({
    where: { id: conversacionId, ...filtro },
    select: { solicitudId: true, fleteroId: true },
  });
  if (!c) notFound();
  redirect(hrefConversacion(perfil.rol, c.solicitudId, c.fleteroId));
}
