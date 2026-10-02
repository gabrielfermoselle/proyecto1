import type { NextRequest } from "next/server";
import { getContextoChat } from "@/features/chat/acceso";
import { decodificarCursor } from "@/features/chat/cursor";
import { getMensajes, getMetaConversacion } from "@/features/chat/queries";
import { json, noAutenticado, noEncontrado } from "@/lib/api";
import { getUsuarioActual } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * ?antes=<cursor>   página anterior (scroll infinito hacia arriba)
 * ?despues=<cursor> mensajes nuevos (reconexión o consulta periódica), con el estado actualizado
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioActual();
  if (!usuario) return noAutenticado();
  const { id } = await params;
  const ctx = await getContextoChat(id, usuario);
  if (!ctx) return noEncontrado();

  const busqueda = request.nextUrl.searchParams;
  const antes = decodificarCursor(busqueda.get("antes"));
  const despues = decodificarCursor(busqueda.get("despues"));
  const pagina = await getMensajes(ctx, { antes, despues });
  // Junto con lo nuevo va la meta: estado, marca de lectura del otro, propuestas en conflicto.
  return json(despues || !antes ? { ...pagina, meta: await getMetaConversacion(ctx) } : pagina);
}
