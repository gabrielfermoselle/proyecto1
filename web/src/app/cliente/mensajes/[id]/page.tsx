import { redirigirConversacion } from "@/features/areas/rutas-viejas";
import { requireRol } from "@/lib/session";

/** Ruta vieja de una conversación: ahora el chat es por pedido, en /chat. */
export default async function ConversacionViejaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return redirigirConversacion(id, await requireRol("CLIENTE"));
}
